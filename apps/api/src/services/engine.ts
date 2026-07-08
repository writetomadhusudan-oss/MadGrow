// MadCoins paper-trading engine. Executes virtual orders against live-ish
// quotes with simulated slippage and Indian-market fees. Nothing here can
// reach a real broker: fills only mutate local Wallet/Position/Trade rows.
import type { PaperOrder, PaperPosition } from "@prisma/client";
import {
  applyFill,
  applySlippage,
  computeFees,
  marginUsed,
  shouldTrigger,
  unrealizedPnl,
  type OrderSide,
  type OrderType,
} from "@market-cap/shared";
import { prisma } from "../db";
import { marketData } from "../providers/marketData";
import { FEE_CONFIG, MONITOR_INTERVAL_MS } from "../config/trading";

export class TradingError extends Error {
  status = 400;
}

function fail(message: string): never {
  throw new TradingError(message);
}

export async function getOrCreateWallet(userId: string) {
  return prisma.wallet.upsert({
    where: { userId },
    create: { userId, balance: FEE_CONFIG.startingBalance },
    update: {},
  });
}

async function availableBalance(userId: string): Promise<{ balance: number; available: number }> {
  const wallet = await getOrCreateWallet(userId);
  const positions = await prisma.paperPosition.findMany({ where: { userId } });
  const margin = marginUsed(positions);
  return { balance: wallet.balance, available: wallet.balance - margin };
}

export interface PlaceOrderInput {
  symbol: string;
  name?: string;
  side: OrderSide;
  type: OrderType;
  quantity: number;
  limitPrice?: number;
  stopPrice?: number;
}

/**
 * Execute a fill: updates position, wallet, and writes the trade row.
 * Returns the realized P&L of the fill.
 */
async function settleFill(
  userId: string,
  order: { id: string; symbol: string; name: string | null; side: string; quantity: number },
  price: number
): Promise<{ fees: number; realizedPnl: number }> {
  const side = order.side as OrderSide;
  const fees = computeFees(FEE_CONFIG, side, order.quantity, price).total;
  const existing = await prisma.paperPosition.findUnique({
    where: { userId_symbol: { userId, symbol: order.symbol } },
  });
  const pos = existing ?? { quantity: 0, avgPrice: 0 };
  const fx = applyFill(
    { quantity: pos.quantity, avgPrice: pos.avgPrice },
    side,
    order.quantity,
    price,
    fees
  );

  const closingQty =
    side === "BUY" ? Math.min(order.quantity, Math.max(0, -pos.quantity)) : Math.min(order.quantity, Math.max(0, pos.quantity));
  const holdingMs =
    closingQty > 0 && existing ? Date.now() - existing.openedAt.getTime() : null;

  await prisma.$transaction([
    prisma.wallet.update({
      where: { userId },
      data: { balance: { increment: fx.cashDelta }, realizedPnl: { increment: fx.realizedPnl } },
    }),
    fx.position.quantity === 0
      ? prisma.paperPosition.deleteMany({ where: { userId, symbol: order.symbol } })
      : prisma.paperPosition.upsert({
          where: { userId_symbol: { userId, symbol: order.symbol } },
          create: {
            userId,
            symbol: order.symbol,
            name: order.name,
            quantity: fx.position.quantity,
            avgPrice: fx.position.avgPrice,
          },
          update: {
            quantity: fx.position.quantity,
            avgPrice: fx.position.avgPrice,
            name: order.name ?? undefined,
            // direction flip resets the holding clock and protective levels
            ...(Math.sign(fx.position.quantity) !== Math.sign(pos.quantity || fx.position.quantity)
              ? { openedAt: new Date(), stopLoss: null, target: null }
              : {}),
          },
        }),
    prisma.paperTrade.create({
      data: {
        userId,
        orderId: order.id,
        symbol: order.symbol,
        name: order.name,
        side,
        quantity: order.quantity,
        price,
        fees,
        pnl: closingQty > 0 ? fx.realizedPnl : null,
        holdingMs,
      },
    }),
  ]);
  return { fees, realizedPnl: fx.realizedPnl };
}

async function validateFunds(
  userId: string,
  side: OrderSide,
  symbol: string,
  quantity: number,
  price: number
) {
  const { available } = await availableBalance(userId);
  const fees = computeFees(FEE_CONFIG, side, quantity, price).total;
  const pos = await prisma.paperPosition.findUnique({
    where: { userId_symbol: { userId, symbol } },
  });
  const q0 = pos?.quantity ?? 0;
  if (side === "BUY") {
    const openQty = quantity - Math.min(quantity, Math.max(0, -q0));
    const required = openQty * price + fees;
    if (required > available + 1e-6)
      fail(`Insufficient MadCoins: need ${required.toFixed(2)}, available ${available.toFixed(2)}`);
  } else {
    const shortQty = quantity - Math.min(quantity, Math.max(0, q0));
    const required = shortQty * price + fees; // margin for the short leg
    if (required > available + 1e-6)
      fail(
        `Insufficient margin for short: need ${required.toFixed(2)}, available ${available.toFixed(2)}`
      );
  }
}

async function notify(userId: string, type: string, symbol: string | null, message: string) {
  await prisma.tradeAlert.create({ data: { userId, type, symbol, message } });
}

export async function placeOrder(userId: string, input: PlaceOrderInput): Promise<PaperOrder> {
  if (input.type === "LIMIT" && input.limitPrice == null) fail("limitPrice required for LIMIT");
  if ((input.type === "STOP" || input.type === "STOP_LIMIT") && input.stopPrice == null)
    fail("stopPrice required for STOP orders");
  if (input.type === "STOP_LIMIT" && input.limitPrice == null)
    fail("limitPrice required for STOP_LIMIT");

  const quote = await marketData.getQuote(input.symbol).catch(() => fail("Symbol not found"));
  if (!quote.price || quote.price <= 0) fail("No price available for symbol");

  const order = await prisma.paperOrder.create({
    data: {
      userId,
      symbol: input.symbol,
      name: input.name ?? quote.name,
      side: input.side,
      type: input.type,
      quantity: input.quantity,
      limitPrice: input.limitPrice,
      stopPrice: input.stopPrice,
    },
  });

  if (input.type === "MARKET") {
    return fillOrder(order, quote.price);
  }
  // Resting order — funds re-checked at trigger time by the monitor.
  await validateFunds(userId, input.side, input.symbol, input.quantity, referencePrice(order, quote.price));
  return order;
}

function referencePrice(order: PaperOrder, ltp: number): number {
  return order.limitPrice ?? order.stopPrice ?? ltp;
}

async function fillOrder(order: PaperOrder, ltp: number): Promise<PaperOrder> {
  const side = order.side as OrderSide;
  const fillPrice =
    order.type === "LIMIT" || order.type === "STOP_LIMIT"
      ? order.limitPrice ?? ltp // limit fills at limit price, no slippage past it
      : applySlippage(FEE_CONFIG, side, ltp);

  try {
    await validateFunds(order.userId, side, order.symbol, order.quantity, fillPrice);
  } catch (err) {
    const rejected = await prisma.paperOrder.update({
      where: { id: order.id },
      data: { status: "REJECTED", note: (err as Error).message },
    });
    await notify(
      order.userId,
      "ORDER_REJECTED",
      order.symbol,
      `${order.side} ${order.quantity} ${order.symbol} rejected: ${(err as Error).message}`
    );
    return rejected;
  }

  const { fees } = await settleFill(order.userId, order, fillPrice);
  const filled = await prisma.paperOrder.update({
    where: { id: order.id },
    data: { status: "FILLED", filledPrice: fillPrice, fees, filledAt: new Date() },
  });
  await notify(
    order.userId,
    "ORDER_FILLED",
    order.symbol,
    `${order.side} ${order.quantity} ${order.symbol} filled @ ₹${fillPrice.toFixed(2)} (fees ₹${fees.toFixed(2)})`
  );
  return filled;
}

export async function cancelOrder(userId: string, orderId: string): Promise<PaperOrder> {
  const order = await prisma.paperOrder.findFirst({ where: { id: orderId, userId } });
  if (!order) fail("Order not found");
  if (order.status !== "OPEN") fail(`Order is ${order.status}, only OPEN orders can be cancelled`);
  return prisma.paperOrder.update({ where: { id: orderId }, data: { status: "CANCELLED" } });
}

export async function modifyOrder(
  userId: string,
  orderId: string,
  patch: { quantity?: number; limitPrice?: number; stopPrice?: number }
): Promise<PaperOrder> {
  const order = await prisma.paperOrder.findFirst({ where: { id: orderId, userId } });
  if (!order) fail("Order not found");
  if (order.status !== "OPEN") fail(`Order is ${order.status}, only OPEN orders can be modified`);
  return prisma.paperOrder.update({ where: { id: orderId }, data: patch });
}

export async function setProtection(
  userId: string,
  symbol: string,
  patch: { stopLoss?: number | null; target?: number | null }
): Promise<PaperPosition> {
  const pos = await prisma.paperPosition.findUnique({
    where: { userId_symbol: { userId, symbol } },
  });
  if (!pos) fail("No open position for symbol");
  return prisma.paperPosition.update({ where: { id: pos.id }, data: patch });
}

export async function closePosition(userId: string, symbol: string): Promise<PaperOrder> {
  const pos = await prisma.paperPosition.findUnique({
    where: { userId_symbol: { userId, symbol } },
  });
  if (!pos || pos.quantity === 0) fail("No open position for symbol");
  return placeOrder(userId, {
    symbol,
    name: pos.name ?? undefined,
    side: pos.quantity > 0 ? "SELL" : "BUY",
    type: "MARKET",
    quantity: Math.abs(pos.quantity),
  });
}

export async function walletSummary(userId: string) {
  const wallet = await getOrCreateWallet(userId);
  const positions = await prisma.paperPosition.findMany({ where: { userId } });
  const quotes = await marketData
    .getQuotes(positions.map((p) => p.symbol))
    .catch(() => []);

  let unrealized = 0;
  let dayPnl = 0;
  const enriched = positions.map((p) => {
    const quote = quotes.find((q) => q.symbol === p.symbol) ?? null;
    const u = quote ? unrealizedPnl({ quantity: p.quantity, avgPrice: p.avgPrice }, quote.price) : 0;
    unrealized += u;
    if (quote) dayPnl += quote.change * p.quantity; // sign-aware for shorts
    return {
      ...p,
      lastPrice: quote?.price ?? null,
      dayChangePercent: quote?.changePercent ?? null,
      unrealizedPnl: quote ? u : null,
      value: quote ? quote.price * p.quantity : null,
    };
  });

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const todayTrades = await prisma.paperTrade.aggregate({
    where: { userId, createdAt: { gte: startOfDay }, pnl: { not: null } },
    _sum: { pnl: true },
  });

  const margin = marginUsed(positions);
  return {
    startingBalance: FEE_CONFIG.startingBalance,
    balance: wallet.balance,
    available: wallet.balance - margin,
    usedMargin: margin,
    unrealizedPnl: unrealized,
    realizedPnl: wallet.realizedPnl,
    todayRealizedPnl: todayTrades._sum.pnl ?? 0,
    todayPnl: (todayTrades._sum.pnl ?? 0) + dayPnl,
    equity: wallet.balance + unrealized,
    lifetimePnl: wallet.balance + unrealized - FEE_CONFIG.startingBalance,
    positions: enriched,
    feeConfig: FEE_CONFIG,
  };
}

// ---------- monitor loop: resting orders + SL/target ----------

let monitorTimer: NodeJS.Timeout | null = null;

export async function runMonitorOnce(): Promise<void> {
  const openOrders = await prisma.paperOrder.findMany({ where: { status: "OPEN" } });
  const protectedPositions = await prisma.paperPosition.findMany({
    where: { OR: [{ stopLoss: { not: null } }, { target: { not: null } }] },
  });
  const symbols = [
    ...new Set([...openOrders.map((o) => o.symbol), ...protectedPositions.map((p) => p.symbol)]),
  ];
  if (symbols.length === 0) return;
  const quotes = await marketData.getQuotes(symbols).catch(() => []);
  const price = (symbol: string) => quotes.find((q) => q.symbol === symbol)?.price;

  for (const order of openOrders) {
    const ltp = price(order.symbol);
    if (!ltp) continue;
    if (
      shouldTrigger(
        order.type as OrderType,
        order.side as OrderSide,
        ltp,
        order.limitPrice,
        order.stopPrice
      )
    ) {
      await fillOrder(order, ltp).catch((err) => console.error("monitor fill failed:", err));
    }
  }

  for (const pos of protectedPositions) {
    const ltp = price(pos.symbol);
    if (!ltp || pos.quantity === 0) continue;
    const long = pos.quantity > 0;
    const slHit = pos.stopLoss != null && (long ? ltp <= pos.stopLoss : ltp >= pos.stopLoss);
    const targetHit = pos.target != null && (long ? ltp >= pos.target : ltp <= pos.target);
    if (!slHit && !targetHit) continue;
    const kind = slHit ? "STOP_LOSS_HIT" : "TARGET_HIT";
    try {
      await prisma.paperPosition.update({
        where: { id: pos.id },
        data: { stopLoss: null, target: null },
      });
      await closePosition(pos.userId, pos.symbol);
      await notify(
        pos.userId,
        kind,
        pos.symbol,
        `${slHit ? "Stop loss" : "Target"} hit on ${pos.symbol} @ ₹${ltp.toFixed(2)} — position closed`
      );
    } catch (err) {
      console.error("monitor protection failed:", err);
    }
  }
}

export function startMonitor(): void {
  if (monitorTimer) return;
  monitorTimer = setInterval(() => {
    runMonitorOnce().catch((err) => console.error("order monitor error:", err));
  }, MONITOR_INTERVAL_MS);
  monitorTimer.unref();
}
