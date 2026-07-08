import { Router } from "express";
import { z } from "zod";
import { computeFees, EDUCATION_DISCLAIMER } from "@market-cap/shared";
import { prisma } from "../db";
import { requireAuth, type AuthedRequest } from "../middleware/auth";
import { FEE_CONFIG } from "../config/trading";
import {
  cancelOrder,
  closePosition,
  getOrCreateWallet,
  modifyOrder,
  placeOrder,
  setProtection,
  TradingError,
  walletSummary,
} from "../services/engine";

export const tradingRouter = Router();
tradingRouter.use(requireAuth);

function handle(err: unknown, res: Parameters<typeof tradingRouter.get>[1] extends never ? never : any, next: (e: unknown) => void) {
  if (err instanceof TradingError) return res.status(400).json({ error: err.message });
  next(err);
}

// ---- wallet & positions ----

tradingRouter.get("/wallet", async (req: AuthedRequest, res, next) => {
  try {
    res.json({ ...(await walletSummary(req.userId!)), disclaimer: EDUCATION_DISCLAIMER });
  } catch (err) {
    handle(err, res, next);
  }
});

const protectionSchema = z.object({
  symbol: z.string().min(1),
  stopLoss: z.number().positive().nullable().optional(),
  target: z.number().positive().nullable().optional(),
});

tradingRouter.post("/positions/protection", async (req: AuthedRequest, res, next) => {
  const parsed = protectionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  try {
    const { symbol, ...patch } = parsed.data;
    res.json(await setProtection(req.userId!, symbol, patch));
  } catch (err) {
    handle(err, res, next);
  }
});

tradingRouter.post("/positions/:symbol/close", async (req: AuthedRequest, res, next) => {
  try {
    res.json(await closePosition(req.userId!, req.params.symbol));
  } catch (err) {
    handle(err, res, next);
  }
});

// ---- orders ----

const orderSchema = z.object({
  symbol: z.string().min(1).max(40),
  name: z.string().max(200).optional(),
  side: z.enum(["BUY", "SELL"]),
  type: z.enum(["MARKET", "LIMIT", "STOP", "STOP_LIMIT"]),
  quantity: z.number().positive(),
  limitPrice: z.number().positive().optional(),
  stopPrice: z.number().positive().optional(),
});

tradingRouter.post("/orders", async (req: AuthedRequest, res, next) => {
  const parsed = orderSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  try {
    const order = await placeOrder(req.userId!, parsed.data);
    res.status(order.status === "REJECTED" ? 400 : 201).json(order);
  } catch (err) {
    handle(err, res, next);
  }
});

tradingRouter.get("/orders", async (req: AuthedRequest, res, next) => {
  try {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    res.json(
      await prisma.paperOrder.findMany({
        where: { userId: req.userId!, ...(status ? { status } : {}) },
        orderBy: { createdAt: "desc" },
        take: 200,
      })
    );
  } catch (err) {
    next(err);
  }
});

const modifySchema = z.object({
  quantity: z.number().positive().optional(),
  limitPrice: z.number().positive().optional(),
  stopPrice: z.number().positive().optional(),
});

tradingRouter.patch("/orders/:id", async (req: AuthedRequest, res, next) => {
  const parsed = modifySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  try {
    res.json(await modifyOrder(req.userId!, req.params.id, parsed.data));
  } catch (err) {
    handle(err, res, next);
  }
});

tradingRouter.delete("/orders/:id", async (req: AuthedRequest, res, next) => {
  try {
    res.json(await cancelOrder(req.userId!, req.params.id));
  } catch (err) {
    handle(err, res, next);
  }
});

// ---- fee preview (used by the trade ticket) ----

tradingRouter.get("/fees/preview", async (req: AuthedRequest, res) => {
  const side = req.query.side === "SELL" ? "SELL" : "BUY";
  const quantity = Number(req.query.quantity);
  const price = Number(req.query.price);
  if (!Number.isFinite(quantity) || !Number.isFinite(price) || quantity <= 0 || price <= 0) {
    return res.status(400).json({ error: "quantity and price required" });
  }
  res.json(computeFees(FEE_CONFIG, side, quantity, price));
});

// ---- trade history ----

tradingRouter.get("/trades", async (req: AuthedRequest, res, next) => {
  try {
    res.json(
      await prisma.paperTrade.findMany({
        where: { userId: req.userId! },
        orderBy: { createdAt: "desc" },
        take: 500,
      })
    );
  } catch (err) {
    next(err);
  }
});

// ---- performance analytics ----

tradingRouter.get("/analytics", async (req: AuthedRequest, res, next) => {
  try {
    const wallet = await getOrCreateWallet(req.userId!);
    const closing = await prisma.paperTrade.findMany({
      where: { userId: req.userId!, pnl: { not: null } },
      orderBy: { createdAt: "asc" },
    });

    const wins = closing.filter((t) => (t.pnl ?? 0) > 0);
    const losses = closing.filter((t) => (t.pnl ?? 0) < 0);
    const grossProfit = wins.reduce((s, t) => s + (t.pnl ?? 0), 0);
    const grossLoss = Math.abs(losses.reduce((s, t) => s + (t.pnl ?? 0), 0));

    // Equity curve of realized P&L by day, plus drawdown off its running peak.
    const daily = new Map<string, number>();
    for (const t of closing) {
      const day = t.createdAt.toISOString().slice(0, 10);
      daily.set(day, (daily.get(day) ?? 0) + (t.pnl ?? 0));
    }
    const dailyPnl = [...daily.entries()].map(([date, pnl]) => ({ date, pnl }));
    let equity = FEE_CONFIG.startingBalance;
    let peak = equity;
    let maxDrawdown = 0;
    const equityCurve = dailyPnl.map(({ date, pnl }) => {
      equity += pnl;
      peak = Math.max(peak, equity);
      maxDrawdown = Math.max(maxDrawdown, peak - equity);
      return { date, equity };
    });

    const monthly = new Map<string, number>();
    for (const { date, pnl } of dailyPnl) {
      const month = date.slice(0, 7);
      monthly.set(month, (monthly.get(month) ?? 0) + pnl);
    }

    // Sharpe (optional): daily realized returns vs starting balance, annualized.
    const returns = dailyPnl.map((d) => d.pnl / FEE_CONFIG.startingBalance);
    const mean = returns.length ? returns.reduce((s, r) => s + r, 0) / returns.length : 0;
    const variance = returns.length
      ? returns.reduce((s, r) => s + (r - mean) ** 2, 0) / returns.length
      : 0;
    const sharpe = variance > 0 ? (mean / Math.sqrt(variance)) * Math.sqrt(252) : null;

    const holdTimes = closing.filter((t) => t.holdingMs != null).map((t) => t.holdingMs!);
    res.json({
      totalClosedTrades: closing.length,
      winRatio: closing.length ? wins.length / closing.length : null,
      lossRatio: closing.length ? losses.length / closing.length : null,
      profitFactor: grossLoss > 0 ? grossProfit / grossLoss : null,
      avgProfit: wins.length ? grossProfit / wins.length : null,
      avgLoss: losses.length ? grossLoss / losses.length : null,
      bestTrade: closing.reduce((b, t) => Math.max(b, t.pnl ?? 0), 0),
      worstTrade: closing.reduce((w, t) => Math.min(w, t.pnl ?? 0), 0),
      avgHoldingMs: holdTimes.length
        ? holdTimes.reduce((s, v) => s + v, 0) / holdTimes.length
        : null,
      maxDrawdown,
      sharpeRatio: sharpe,
      lifetimeRealizedPnl: wallet.realizedPnl,
      equityCurve,
      dailyPnl,
      monthlyPnl: [...monthly.entries()].map(([month, pnl]) => ({ month, pnl })),
      disclaimer: EDUCATION_DISCLAIMER,
    });
  } catch (err) {
    next(err);
  }
});

// ---- leaderboard (opt-in ready; masked identities) ----

tradingRouter.get("/leaderboard", async (_req, res, next) => {
  try {
    const wallets = await prisma.wallet.findMany({
      orderBy: { realizedPnl: "desc" },
      take: 20,
      include: { user: { select: { name: true, email: true } } },
    });
    res.json(
      wallets.map((w, i) => ({
        rank: i + 1,
        trader:
          w.user.name ??
          w.user.email.replace(/^(.{2}).*(@.*)$/, (_m, a, b) => `${a}•••${b}`),
        realizedPnl: w.realizedPnl,
      }))
    );
  } catch (err) {
    next(err);
  }
});

// ---- alerts ----

tradingRouter.get("/alerts", async (req: AuthedRequest, res, next) => {
  try {
    res.json(
      await prisma.tradeAlert.findMany({
        where: { userId: req.userId! },
        orderBy: { createdAt: "desc" },
        take: 50,
      })
    );
  } catch (err) {
    next(err);
  }
});

tradingRouter.post("/alerts/read", async (req: AuthedRequest, res, next) => {
  try {
    await prisma.tradeAlert.updateMany({
      where: { userId: req.userId!, read: false },
      data: { read: true },
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
