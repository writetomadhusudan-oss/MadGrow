// Intraday (NSE) day-trading toolkit for the MadCoins paper-trading platform.
// Pure functions only: scan rules, exit planning, position sizing, a risk gate
// and a bootstrap "time machine". Everything here is an educational estimate;
// nothing in this module can place a real order.
//
// Rule set adapted from the open-source day-trader-skill pack (MIT) and
// re-timed for the NSE session (09:15–15:30 IST).

import { atr, rsi, sma } from "./indicators";
import type { Candle } from "./types";

// ---------- NSE session clock (IST = UTC+5:30, no DST) ----------

export const SESSION = {
  openMin: 9 * 60 + 15, // 09:15
  closeMin: 15 * 60 + 30, // 15:30
  openingRangeBars: 3, // first 15 minutes of 5m bars
} as const;

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export interface IstParts {
  date: string; // YYYY-MM-DD in IST
  minutes: number; // minutes since IST midnight
  weekday: number; // 0 = Sunday … 6 = Saturday
}

export function istParts(iso: string | number | Date): IstParts {
  const d = new Date(new Date(iso).getTime() + IST_OFFSET_MS);
  return {
    date: d.toISOString().slice(0, 10),
    minutes: d.getUTCHours() * 60 + d.getUTCMinutes(),
    weekday: d.getUTCDay(),
  };
}

export function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToHhmm(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

/** Weekday + 09:15–15:30 IST, minus any configured holiday dates (YYYY-MM-DD). */
export function isMarketOpen(now: Date, holidays: readonly string[] = []): boolean {
  const p = istParts(now);
  if (p.weekday === 0 || p.weekday === 6) return false;
  if (holidays.includes(p.date)) return false;
  return p.minutes >= SESSION.openMin && p.minutes < SESSION.closeMin;
}

/** Group 5-minute candles into trading sessions keyed by IST date, oldest first. */
export function splitSessions(candles: Candle[]): Candle[][] {
  const byDay = new Map<string, Candle[]>();
  for (const c of candles) {
    const day = istParts(c.time).date;
    const list = byDay.get(day);
    if (list) list.push(c);
    else byDay.set(day, [c]);
  }
  return [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
}

// ---------- scans ----------

export interface OrbHit {
  date: string;
  rangeHigh: number;
  rangeLow: number;
  rangeMid: number;
  /** Index (within the session) of the bar that closed above the range. */
  barIndex: number;
  time: string;
  entry: number;
}

/** Opening range (first N bars) of a session, whether or not it has broken out. */
export function openingRange(
  session: Candle[],
  bars: number = SESSION.openingRangeBars
): { rangeHigh: number; rangeLow: number; rangeMid: number } | null {
  if (session.length < bars) return null;
  const r = session.slice(0, bars);
  const rangeHigh = Math.max(...r.map((c) => c.high));
  const rangeLow = Math.min(...r.map((c) => c.low));
  return { rangeHigh, rangeLow, rangeMid: round2((rangeHigh + rangeLow) / 2) };
}

export interface OrbOptions {
  /** Last minute-of-day (IST) at which a new entry is allowed. Default 14:30. */
  noEntriesAfterMin?: number;
  openingRangeBars?: number;
}

/**
 * Opening-range breakout on one session of 5m bars. The range is the first N
 * bars; a hit is the first later bar that CLOSES above the range high. Returns
 * null while the range is still forming or when nothing has broken out.
 */
export function detectOrb(session: Candle[], opts: OrbOptions = {}): OrbHit | null {
  const n = opts.openingRangeBars ?? SESSION.openingRangeBars;
  const cutoff = opts.noEntriesAfterMin ?? hhmmToMinutes("14:30");
  if (session.length <= n) return null;
  const range = session.slice(0, n);
  const rangeHigh = Math.max(...range.map((c) => c.high));
  const rangeLow = Math.min(...range.map((c) => c.low));
  for (let i = n; i < session.length; i++) {
    const bar = session[i];
    if (istParts(bar.time).minutes > cutoff) return null;
    if (bar.close > rangeHigh) {
      return {
        date: istParts(bar.time).date,
        rangeHigh,
        rangeLow,
        rangeMid: round2((rangeHigh + rangeLow) / 2),
        barIndex: i,
        time: bar.time,
        entry: bar.close,
      };
    }
  }
  return null;
}

export type DailySetupId =
  | "breakout_20d"
  | "bull_flag"
  | "reclaim_ma20"
  | "oversold"
  | "oversold_bounce";

export interface DailySetup {
  id: DailySetupId;
  label: string;
  reason: string;
}

/** Closes-only pre-market scan on daily candles (oldest first). */
export function detectDailySetups(daily: Candle[]): DailySetup[] {
  const out: DailySetup[] = [];
  const closes = daily.map((c) => c.close);
  const n = closes.length;
  if (n < 22) return out;
  const last = closes[n - 1];

  const prev20 = closes.slice(n - 21, n - 1);
  if (last > Math.max(...prev20)) {
    out.push({ id: "breakout_20d", label: "20-day breakout", reason: "Close above the previous 20 closes" });
  }

  if (n >= 16) {
    const base = closes[n - 16];
    const preFlagEnd = closes[n - 6];
    const flag = closes.slice(n - 5);
    const run = (preFlagEnd - base) / base;
    const lo = Math.min(...flag);
    const hi = Math.max(...flag);
    if (run > 0.1 && (hi - lo) / lo <= 0.05) {
      out.push({
        id: "bull_flag",
        label: "Bull flag",
        reason: `Up ${(run * 100).toFixed(1)}% then 5 closes inside a ${(((hi - lo) / lo) * 100).toFixed(1)}% range`,
      });
    }
  }

  const ma = sma(closes, 20);
  const maNow = ma[n - 1];
  const maPrev = ma[n - 2];
  if (maNow != null && maPrev != null && closes[n - 2] < maPrev && last > maNow) {
    out.push({ id: "reclaim_ma20", label: "Reclaimed 20-day average", reason: "Closed back above the 20-day average" });
  }

  const r = rsi(closes, 14);
  const rNow = r[n - 1];
  const rPrev = r[n - 2];
  if (rNow != null && rNow < 30) {
    out.push({ id: "oversold", label: "Oversold", reason: `RSI(14) is ${rNow.toFixed(1)}` });
  }
  if (rPrev != null && rPrev < 30 && last > closes[n - 2]) {
    out.push({ id: "oversold_bounce", label: "Oversold bounce", reason: "RSI was under 30 yesterday and today closed up" });
  }
  return out;
}

// ---------- exit plan ----------

export type StopMode = "or-mid" | "or-low" | "pct" | "atr" | "price";

export interface ExitPlanInput {
  entry: number;
  stopMode: StopMode;
  /** pct: percent below entry; atr: multiple of ATR; price: absolute stop. */
  stopValue?: number;
  rangeLow?: number;
  rangeMid?: number;
  atrValue?: number;
  /** Reward multiple of risk. Default 2. */
  targetR?: number;
  tickSize?: number;
}

export interface ExitPlan {
  entry: number;
  stop: number;
  target: number;
  riskPerShare: number;
  rewardPerShare: number;
  rewardRisk: number;
}

/**
 * Long-only plan. The stop is rounded AWAY from entry to the tick, and the
 * plan is refused (throws) when the stop is not below entry or risk is under
 * 0.05% of price — a stop that tight is noise, not protection.
 */
export function planExit(input: ExitPlanInput): ExitPlan {
  const { entry, stopMode, stopValue, rangeLow, rangeMid, atrValue } = input;
  const tick = input.tickSize ?? 0.05;
  const targetR = input.targetR ?? 2;
  let rawStop: number;
  switch (stopMode) {
    case "or-mid":
      if (rangeMid == null) throw new Error("Opening range required for or-mid stop");
      rawStop = rangeMid;
      break;
    case "or-low":
      if (rangeLow == null) throw new Error("Opening range required for or-low stop");
      rawStop = rangeLow;
      break;
    case "pct":
      if (!stopValue || stopValue <= 0) throw new Error("Stop percent must be positive");
      rawStop = entry * (1 - stopValue / 100);
      break;
    case "atr":
      if (!atrValue || !stopValue || stopValue <= 0) throw new Error("ATR and multiple required");
      rawStop = entry - stopValue * atrValue;
      break;
    case "price":
      if (!stopValue) throw new Error("Stop price required");
      rawStop = stopValue;
      break;
  }
  const stop = Math.floor(rawStop / tick + 1e-9) * tick; // away from entry for longs
  const stopR = round2(stop);
  if (stopR >= entry) throw new Error("Stop must be below entry for a long trade");
  const riskPerShare = round2(entry - stopR);
  if (riskPerShare < entry * 0.0005) throw new Error("Stop is too close to entry (under 0.05% risk)");
  if (targetR <= 0) throw new Error("Target multiple must be positive");
  const target = round2(entry + riskPerShare * targetR);
  return {
    entry,
    stop: stopR,
    target,
    riskPerShare,
    rewardPerShare: round2(target - entry),
    rewardRisk: round2((target - entry) / riskPerShare),
  };
}

// ---------- sizing ----------

export interface SizeInput {
  maxLoss: number;
  entry: number;
  stop: number;
  /** Optional cap on position value as % of capital. */
  capital?: number;
  maxPositionPct?: number;
}

export interface SizeResult {
  quantity: number;
  positionValue: number;
  lossAtStop: number;
  cappedBy: "risk" | "position-size" | "none";
}

/** quantity = floor(maxLoss / riskPerShare), optionally capped by position size. */
export function sizePosition(input: SizeInput): SizeResult {
  const risk = input.entry - input.stop;
  if (risk <= 0) return { quantity: 0, positionValue: 0, lossAtStop: 0, cappedBy: "none" };
  let qty = Math.floor(input.maxLoss / risk);
  let cappedBy: SizeResult["cappedBy"] = "risk";
  if (input.capital && input.maxPositionPct) {
    const maxQty = Math.floor((input.capital * (input.maxPositionPct / 100)) / input.entry);
    if (maxQty < qty) {
      qty = maxQty;
      cappedBy = "position-size";
    }
  }
  qty = Math.max(0, qty);
  return {
    quantity: qty,
    positionValue: round2(qty * input.entry),
    lossAtStop: round2(qty * risk),
    cappedBy,
  };
}

// ---------- risk gate ----------

export interface RiskLimits {
  maxLossPerTrade: number;
  maxDailyLoss: number;
  maxTradesPerDay: number;
  minRewardRisk: number;
  maxPositionPct: number;
  /** HH:MM IST windows. */
  entryFrom: string;
  entryUntil: string;
  holidays: string[];
}

/**
 * NSE equity-segment trading holidays for 2026 (weekday closures), compiled
 * from broker sites citing the NSE circular. Jan 15 (Maharashtra civic
 * elections) was a late closure that not every source lists. Verify against
 * nseindia.com and extend via DAYTRADER_HOLIDAYS. Muhurat trading on Sun 8 Nov
 * is not modelled: weekends are always treated as closed.
 */
export const NSE_HOLIDAYS_2026: readonly string[] = [
  "2026-01-15", "2026-01-26", "2026-03-03", "2026-03-26", "2026-03-31",
  "2026-04-03", "2026-04-14", "2026-05-01", "2026-05-28", "2026-06-26",
  "2026-09-14", "2026-10-02", "2026-10-20", "2026-11-10", "2026-11-24",
  "2026-12-25",
];

export const DEFAULT_RISK_LIMITS: RiskLimits = {
  maxLossPerTrade: 5_000,
  maxDailyLoss: 15_000,
  maxTradesPerDay: 3,
  minRewardRisk: 1.5,
  maxPositionPct: 20,
  entryFrom: "09:30",
  entryUntil: "14:30",
  holidays: [...NSE_HOLIDAYS_2026],
};

export interface RiskContext {
  now: Date;
  capital: number;
  cashAvailable: number;
  /** Realized P&L today (negative = loss). */
  todayPnl: number;
  tradesToday: number;
}

export interface RiskOrder {
  quantity: number;
  entry: number;
  stop: number | null;
  target: number | null;
}

export interface RiskVerdict {
  pass: boolean;
  reasons: string[];
}

/** PASS/BLOCK for a long entry. Every failed rule is reported, not just the first. */
export function checkRisk(order: RiskOrder, limits: RiskLimits, ctx: RiskContext): RiskVerdict {
  const reasons: string[] = [];
  if (order.quantity <= 0 || !Number.isInteger(order.quantity)) reasons.push("Quantity must be a whole number above zero");
  if (order.stop == null || order.stop >= order.entry) {
    reasons.push("A stop below the entry price is required");
  } else {
    const loss = (order.entry - order.stop) * order.quantity;
    if (loss > limits.maxLossPerTrade + 1e-9) {
      reasons.push(`Loss at stop ₹${Math.round(loss)} exceeds the ₹${limits.maxLossPerTrade} per-trade limit`);
    }
    if (order.target != null) {
      const rr = (order.target - order.entry) / (order.entry - order.stop);
      if (rr < limits.minRewardRisk) reasons.push(`Reward:risk ${rr.toFixed(2)} is below the minimum ${limits.minRewardRisk}`);
    } else {
      reasons.push("A profit target is required");
    }
  }
  if (-ctx.todayPnl >= limits.maxDailyLoss) reasons.push(`Daily loss limit of ₹${limits.maxDailyLoss} already reached`);
  if (ctx.tradesToday >= limits.maxTradesPerDay) reasons.push(`Already placed ${ctx.tradesToday} trades today (limit ${limits.maxTradesPerDay})`);

  const value = order.quantity * order.entry;
  if (value > ctx.cashAvailable) reasons.push("Position value exceeds available MadCoins");
  if (ctx.capital > 0 && value > ctx.capital * (limits.maxPositionPct / 100)) {
    reasons.push(`Position is more than ${limits.maxPositionPct}% of the wallet`);
  }

  if (!isMarketOpen(ctx.now, limits.holidays)) {
    reasons.push("The NSE market is closed");
  } else {
    const m = istParts(ctx.now).minutes;
    if (m < hhmmToMinutes(limits.entryFrom) || m > hhmmToMinutes(limits.entryUntil)) {
      reasons.push(`Outside the entry window ${limits.entryFrom}–${limits.entryUntil} IST`);
    }
  }
  return { pass: reasons.length === 0, reasons };
}

// ---------- time machine ----------

export interface TimeMachineInput {
  /** Historical 5m sessions (oldest first). */
  sessions: Candle[][];
  /** Index of the entry bar inside a session; future bars start at index+1. */
  fromBarIndex: number;
  entry: number;
  stop: number;
  target: number;
  runs?: number;
  /** Injectable for deterministic tests. */
  rand?: () => number;
}

export interface TimeMachineResult {
  runs: number;
  targetFirst: number;
  stopFirst: number;
  neither: number;
  /** Probability-weighted R multiple (target = +R, stop = -1, neither = marked at close). */
  expectedR: number;
  sessionsUsed: number;
}

/**
 * Bootstrap: for each run pick a random past session, replay its bar-to-bar
 * moves (high/low/close relative to the previous close) from the same time of
 * day, scaled onto today's entry. If a single bar touches both stop and target
 * the stop is assumed first (conservative). A simulation, not a prediction.
 */
export function timeMachine(input: TimeMachineInput): TimeMachineResult {
  const { fromBarIndex, entry, stop, target } = input;
  const runs = input.runs ?? 10_000;
  const rand = input.rand ?? Math.random;
  const usable = input.sessions.filter((s) => s.length > fromBarIndex + 2);
  if (usable.length === 0) throw new Error("Not enough intraday history to simulate");
  const risk = entry - stop;

  let tf = 0;
  let sf = 0;
  let nf = 0;
  let rSum = 0;
  for (let r = 0; r < runs; r++) {
    const s = usable[Math.floor(rand() * usable.length)];
    let price = entry;
    let outcome: "t" | "s" | "n" = "n";
    for (let i = fromBarIndex + 1; i < s.length; i++) {
      const prevClose = s[i - 1].close;
      const hi = price * (s[i].high / prevClose);
      const lo = price * (s[i].low / prevClose);
      if (lo <= stop) {
        outcome = "s";
        break;
      }
      if (hi >= target) {
        outcome = "t";
        break;
      }
      price = price * (s[i].close / prevClose);
    }
    if (outcome === "t") {
      tf++;
      rSum += (target - entry) / risk;
    } else if (outcome === "s") {
      sf++;
      rSum -= 1;
    } else {
      nf++;
      rSum += (price - entry) / risk;
    }
  }
  return {
    runs,
    targetFirst: tf / runs,
    stopFirst: sf / runs,
    neither: nf / runs,
    expectedR: rSum / runs,
    sessionsUsed: usable.length,
  };
}

/** Convenience: latest ATR(14) value from daily candles, or null. */
export function latestAtr(daily: Candle[]): number | null {
  const a = atr(daily, 14);
  return a.length ? a[a.length - 1] : null;
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
