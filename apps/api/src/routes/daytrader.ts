import { Router } from "express";
import { z } from "zod";
import {
  checkRisk,
  DEFAULT_RISK_LIMITS,
  detectDailySetups,
  detectOrb,
  EDUCATION_DISCLAIMER,
  hhmmToMinutes,
  istParts,
  latestAtr,
  minutesToHhmm,
  planExit,
  sizePosition,
  splitSessions,
  timeMachine,
  type RiskLimits,
} from "@market-cap/shared";
import { cached } from "../cache";
import { prisma } from "../db";
import { NIFTY_100 } from "../data/symbols";
import { marketData } from "../providers/marketData";
import { requireAuth, type AuthedRequest } from "../middleware/auth";
import { placeOrder, setProtection, TradingError, walletSummary } from "../services/engine";

export const dayTraderRouter = Router();

function envNum(key: string, fallback: number): number {
  const n = Number(process.env[key]);
  return process.env[key] != null && Number.isFinite(n) ? n : fallback;
}

/** Tunable per deployment. NSE trading holidays are NOT built in: list them in DAYTRADER_HOLIDAYS. */
export const RISK_LIMITS: RiskLimits = {
  ...DEFAULT_RISK_LIMITS,
  maxLossPerTrade: envNum("DAYTRADER_MAX_LOSS_PER_TRADE", DEFAULT_RISK_LIMITS.maxLossPerTrade),
  maxDailyLoss: envNum("DAYTRADER_MAX_DAILY_LOSS", DEFAULT_RISK_LIMITS.maxDailyLoss),
  maxTradesPerDay: envNum("DAYTRADER_MAX_TRADES_PER_DAY", DEFAULT_RISK_LIMITS.maxTradesPerDay),
  minRewardRisk: envNum("DAYTRADER_MIN_REWARD_RISK", DEFAULT_RISK_LIMITS.minRewardRisk),
  maxPositionPct: envNum("DAYTRADER_MAX_POSITION_PCT", DEFAULT_RISK_LIMITS.maxPositionPct),
  holidays: (process.env.DAYTRADER_HOLIDAYS ?? "").split(",").map((s) => s.trim()).filter(Boolean),
};

const MIN_PRICE = 50;
const MIN_VOLUME = 500_000;

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    })
  );
  return out;
}

/** GET /daytrader/config — limits shown in the UI. */
dayTraderRouter.get("/config", (_req, res) => {
  res.json({ limits: RISK_LIMITS, universe: "NIFTY 100", disclaimer: EDUCATION_DISCLAIMER });
});

/**
 * GET /daytrader/scan?mode=orb|daily
 * orb: first 5m bar of the latest session to close above the 09:15–09:30 range.
 * daily: closes-only setups on daily candles. NIFTY 100 universe.
 */
dayTraderRouter.get("/scan", async (req, res, next) => {
  const mode = req.query.mode === "daily" ? "daily" : "orb";
  try {
    const payload = await cached(`daytrader:scan:${mode}`, 2 * 60_000, async () => {
      const rows = await mapLimit(NIFTY_100, 6, async (symbol) => {
        try {
          if (mode === "orb") {
            const sessions = splitSessions(await marketData.getIntraday5m(symbol, 5));
            const latest = sessions[sessions.length - 1];
            if (!latest) return null;
            const hit = detectOrb(latest);
            if (!hit) return null;
            return { symbol, mode, setups: ["orb_breakout"], entry: hit.entry, rangeHigh: hit.rangeHigh, rangeLow: hit.rangeLow, time: hit.time, date: hit.date };
          }
          const daily = await marketData.getHistory(symbol, "6mo");
          const last = daily[daily.length - 1];
          if (!last || last.close < MIN_PRICE || (last.volume ?? 0) < MIN_VOLUME) return null;
          const setups = detectDailySetups(daily);
          if (!setups.length) return null;
          return { symbol, mode, setups: setups.map((s) => s.label), reasons: setups.map((s) => s.reason), entry: last.close, date: last.time.slice(0, 10) };
        } catch {
          return null;
        }
      });
      return {
        mode,
        scannedAt: new Date().toISOString(),
        universe: NIFTY_100.length,
        hits: rows.filter((r): r is NonNullable<typeof r> => r !== null),
        note: "Scan rules are textbook patterns, not predictions. Check the plan and the Time Machine before paper-trading.",
        disclaimer: EDUCATION_DISCLAIMER,
      };
    });
    res.json(payload);
  } catch (err) {
    next(err);
  }
});

const planSchema = z.object({
  symbol: z.string().min(1).max(40),
  stopMode: z.enum(["or-mid", "or-low", "pct", "atr", "price"]).default("or-mid"),
  stopValue: z.number().positive().optional(),
  targetR: z.number().min(0.5).max(5).default(2),
  maxLoss: z.number().positive().optional(),
});

async function todayStats(userId: string) {
  const startOfIstDay = new Date(`${istParts(new Date()).date}T00:00:00+05:30`);
  const [pnl, buys] = await Promise.all([
    prisma.paperTrade.aggregate({
      where: { userId, createdAt: { gte: startOfIstDay }, pnl: { not: null } },
      _sum: { pnl: true },
    }),
    prisma.paperOrder.count({
      where: { userId, side: "BUY", status: "FILLED", createdAt: { gte: startOfIstDay } },
    }),
  ]);
  return { todayPnl: pnl._sum.pnl ?? 0, tradesToday: buys };
}

/**
 * POST /daytrader/plan — builds exit plan, size, risk verdict and Time Machine
 * odds for a long trade. Entry is the ORB trigger if one fired in the latest
 * session, otherwise the live price.
 */
dayTraderRouter.post("/plan", requireAuth, async (req: AuthedRequest, res, next) => {
  const parsed = planSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { symbol, stopMode, stopValue, targetR } = parsed.data;
  try {
    const [candles, daily, quote, wallet, today] = await Promise.all([
      marketData.getIntraday5m(symbol, 59),
      marketData.getHistory(symbol, "6mo"),
      marketData.getQuote(symbol),
      walletSummary(req.userId!),
      todayStats(req.userId!),
    ]);
    const sessions = splitSessions(candles);
    const latest = sessions[sessions.length - 1] ?? [];
    const orb = latest.length ? detectOrb(latest) : null;
    const entry = quote.price;
    const maxLoss = Math.min(parsed.data.maxLoss ?? RISK_LIMITS.maxLossPerTrade, RISK_LIMITS.maxLossPerTrade);

    let plan;
    try {
      plan = planExit({
        entry,
        stopMode,
        stopValue,
        targetR,
        rangeLow: orb?.rangeLow,
        rangeMid: orb?.rangeMid,
        atrValue: latestAtr(daily) ?? undefined,
      });
    } catch (e) {
      return res.status(400).json({ error: (e as Error).message });
    }
    const size = sizePosition({
      maxLoss,
      entry: plan.entry,
      stop: plan.stop,
      capital: wallet.equity,
      maxPositionPct: RISK_LIMITS.maxPositionPct,
    });
    const verdict = checkRisk(
      { quantity: size.quantity, entry: plan.entry, stop: plan.stop, target: plan.target },
      RISK_LIMITS,
      { now: new Date(), capital: wallet.equity, cashAvailable: wallet.available, ...today }
    );

    // Time Machine runs from the bar the entry would fall on today (or the last bar).
    const nowMin = istParts(new Date()).minutes;
    const barsSinceOpen = Math.max(1, Math.floor((nowMin - 555) / 5));
    const fromBarIndex = Math.min(Math.max(barsSinceOpen, 3), 70);
    const history = sessions.length > 1 ? sessions.slice(0, -1) : sessions;
    let sim = null;
    try {
      sim = timeMachine({ sessions: history, fromBarIndex, entry: plan.entry, stop: plan.stop, target: plan.target, runs: 10_000 });
    } catch {
      /* not enough history — plan is still valid */
    }

    res.json({
      symbol,
      name: quote.name,
      orb: orb && { ...orb, at: minutesToHhmm(istParts(orb.time).minutes) },
      plan,
      size,
      risk: { pass: verdict.pass, reasons: verdict.reasons, limits: RISK_LIMITS },
      simulation: sim && {
        ...sim,
        fromTime: minutesToHhmm(555 + fromBarIndex * 5),
        flatBy: minutesToHhmm(hhmmToMinutes("15:15")),
        caveat: "Resamples this stock's own past 5-minute moves. A simulation, not a prediction.",
      },
      disclaimer: EDUCATION_DISCLAIMER,
    });
  } catch (err) {
    next(err);
  }
});

const orderSchema = z.object({
  symbol: z.string().min(1).max(40),
  quantity: z.number().int().positive(),
  stop: z.number().positive(),
  target: z.number().positive(),
});

/**
 * POST /daytrader/paper-order — risk gate is re-run server-side at the live
 * price; only a PASS places a MadCoins market BUY and attaches stop/target.
 */
dayTraderRouter.post("/paper-order", requireAuth, async (req: AuthedRequest, res, next) => {
  const parsed = orderSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { symbol, quantity, stop, target } = parsed.data;
  try {
    const [quote, wallet, today] = await Promise.all([
      marketData.getQuote(symbol),
      walletSummary(req.userId!),
      todayStats(req.userId!),
    ]);
    const verdict = checkRisk({ quantity, entry: quote.price, stop, target }, RISK_LIMITS, {
      now: new Date(),
      capital: wallet.equity,
      cashAvailable: wallet.available,
      ...today,
    });
    if (!verdict.pass) return res.status(422).json({ error: "Blocked by risk gate", reasons: verdict.reasons });
    const order = await placeOrder(req.userId!, { symbol, name: quote.name, side: "BUY", type: "MARKET", quantity });
    if (order.status === "FILLED") await setProtection(req.userId!, symbol, { stopLoss: stop, target });
    res.status(order.status === "REJECTED" ? 400 : 201).json({ order, stop, target });
  } catch (err) {
    if (err instanceof TradingError) return res.status(400).json({ error: err.message });
    next(err);
  }
});
