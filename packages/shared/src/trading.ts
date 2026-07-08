// MadCoins paper-trading domain: fee model, slippage, and position fill
// accounting. Pure functions only — the API's engine service persists the
// results. All trading here is virtual; no real-money path exists.

export type OrderSide = "BUY" | "SELL";
export type OrderType = "MARKET" | "LIMIT" | "STOP" | "STOP_LIMIT";
export type OrderStatus = "OPEN" | "FILLED" | "CANCELLED" | "REJECTED";

/** All rates in percent unless noted. Modeled on Indian equity delivery charges. */
export interface FeeConfig {
  startingBalance: number; // MadCoins granted to every new wallet
  brokeragePct: number; // % of turnover per leg
  brokerageCap: number; // absolute cap per leg (₹-style)
  sttPct: number; // securities transaction tax, both legs
  exchangePct: number; // exchange transaction charges
  sebiPct: number; // SEBI turnover fee
  gstPct: number; // GST applied on (brokerage + exchange + SEBI)
  stampDutyPctBuy: number; // stamp duty, buy leg only
  slippageMaxPct: number; // max adverse slippage applied to market orders
}

export const DEFAULT_FEE_CONFIG: FeeConfig = {
  startingBalance: 1_000_000,
  brokeragePct: 0.03,
  brokerageCap: 20,
  sttPct: 0.1,
  exchangePct: 0.00297,
  sebiPct: 0.0001,
  gstPct: 18,
  stampDutyPctBuy: 0.015,
  slippageMaxPct: 0.05,
};

export interface FeeBreakdown {
  brokerage: number;
  stt: number;
  exchange: number;
  sebi: number;
  gst: number;
  stampDuty: number;
  total: number;
}

export function computeFees(
  cfg: FeeConfig,
  side: OrderSide,
  quantity: number,
  price: number
): FeeBreakdown {
  const turnover = quantity * price;
  const brokerage = Math.min((cfg.brokeragePct / 100) * turnover, cfg.brokerageCap);
  const stt = (cfg.sttPct / 100) * turnover;
  const exchange = (cfg.exchangePct / 100) * turnover;
  const sebi = (cfg.sebiPct / 100) * turnover;
  const gst = (cfg.gstPct / 100) * (brokerage + exchange + sebi);
  const stampDuty = side === "BUY" ? (cfg.stampDutyPctBuy / 100) * turnover : 0;
  const total = brokerage + stt + exchange + sebi + gst + stampDuty;
  const round = (v: number) => Math.round(v * 100) / 100;
  return {
    brokerage: round(brokerage),
    stt: round(stt),
    exchange: round(exchange),
    sebi: round(sebi),
    gst: round(gst),
    stampDuty: round(stampDuty),
    total: round(total),
  };
}

/** Adverse-only slippage: buys fill slightly higher, sells slightly lower. */
export function applySlippage(
  cfg: FeeConfig,
  side: OrderSide,
  price: number,
  rand: number = Math.random()
): number {
  const pct = (cfg.slippageMaxPct / 100) * rand;
  const slipped = side === "BUY" ? price * (1 + pct) : price * (1 - pct);
  return Math.round(slipped * 100) / 100;
}

/**
 * Position state uses a signed quantity: positive = long, negative = short.
 * avgPrice is the average entry price of the open position (0 when flat).
 *
 * Cash model (kept deliberately simple for education):
 * - Long buys debit cost; long sells credit proceeds.
 * - Shorts move no principal: opening a short blocks margin (|qty| × avgPrice,
 *   derived — see marginUsed), covering credits/debits only the realized P&L.
 * - Fees always debit cash.
 */
export interface PositionState {
  quantity: number;
  avgPrice: number;
}

export interface FillEffect {
  position: PositionState;
  realizedPnl: number;
  /** Signed change to wallet balance, fees included. */
  cashDelta: number;
  /** True if this fill closed the position completely. */
  closed: boolean;
}

export function applyFill(
  pos: PositionState,
  side: OrderSide,
  quantity: number,
  price: number,
  fees: number
): FillEffect {
  if (quantity <= 0) throw new Error("quantity must be positive");
  const q0 = pos.quantity;
  let realizedPnl = 0;
  let cashDelta = 0;
  let newQty: number;
  let newAvg: number;

  if (side === "BUY") {
    const coverQty = Math.min(quantity, Math.max(0, -q0)); // closing short
    const openQty = quantity - coverQty; // opening/adding long
    realizedPnl += (pos.avgPrice - price) * coverQty;
    cashDelta += realizedPnl; // shorts settle P&L only
    cashDelta -= openQty * price; // longs pay principal
    newQty = q0 + quantity;
    if (newQty > 0) {
      const priorLong = Math.max(0, q0);
      newAvg =
        priorLong > 0
          ? (priorLong * pos.avgPrice + openQty * price) / (priorLong + openQty)
          : price;
    } else {
      newAvg = newQty < 0 ? pos.avgPrice : 0; // short partially covered / flat
    }
  } else {
    const closeQty = Math.min(quantity, Math.max(0, q0)); // closing long
    const shortQty = quantity - closeQty; // opening/adding short
    realizedPnl += (price - pos.avgPrice) * closeQty;
    cashDelta += closeQty * price; // long principal + pnl returns via proceeds
    newQty = q0 - quantity;
    if (newQty < 0) {
      const priorShort = Math.max(0, -q0);
      newAvg =
        priorShort > 0
          ? (priorShort * pos.avgPrice + shortQty * price) / (priorShort + shortQty)
          : price;
    } else {
      newAvg = newQty > 0 ? pos.avgPrice : 0;
    }
  }

  cashDelta -= fees;
  return {
    position: { quantity: newQty, avgPrice: newQty === 0 ? 0 : newAvg },
    realizedPnl,
    cashDelta,
    closed: q0 !== 0 && newQty === 0,
  };
}

/** Margin blocked by short positions (entry value). */
export function marginUsed(positions: PositionState[]): number {
  return positions
    .filter((p) => p.quantity < 0)
    .reduce((sum, p) => sum + Math.abs(p.quantity) * p.avgPrice, 0);
}

export function unrealizedPnl(pos: PositionState, lastPrice: number): number {
  if (pos.quantity >= 0) return (lastPrice - pos.avgPrice) * pos.quantity;
  return (pos.avgPrice - lastPrice) * Math.abs(pos.quantity);
}

/** Should an open LIMIT/STOP order fill at this price? */
export function shouldTrigger(
  type: OrderType,
  side: OrderSide,
  price: number,
  limitPrice: number | null,
  stopPrice: number | null
): boolean {
  switch (type) {
    case "LIMIT":
      return limitPrice != null && (side === "BUY" ? price <= limitPrice : price >= limitPrice);
    case "STOP":
      return stopPrice != null && (side === "BUY" ? price >= stopPrice : price <= stopPrice);
    case "STOP_LIMIT": {
      if (stopPrice == null || limitPrice == null) return false;
      const triggered = side === "BUY" ? price >= stopPrice : price <= stopPrice;
      const within = side === "BUY" ? price <= limitPrice : price >= limitPrice;
      return triggered && within;
    }
    default:
      return true; // MARKET
  }
}

export const EDUCATION_DISCLAIMER =
  "This application is provided solely for educational and trading practice purposes using virtual currency (MadCoins). It does not facilitate or execute trades involving real money, securities, derivatives, or any regulated financial instruments. All trade signals, analytics, and recommendations are educational estimates only and should not be considered financial or investment advice.";
