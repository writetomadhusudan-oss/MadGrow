// Modular strategy engine. Every strategy is independent, can be toggled by
// the client, and emits: a current signal with confidence + reasoning, and
// historical entry/exit events used for chart markers.
//
// IMPORTANT: outputs are probability-based educational estimates. They never
// claim certainty and must always be displayed with the app disclaimer.
import type { Candle } from "./types";
import {
  adx,
  atr,
  bollinger,
  donchian,
  ema,
  macd,
  mfi,
  rsi,
  stochastic,
  superTrend,
  supportResistance,
  vwap,
} from "./indicators";

export type SignalDirection = "BUY" | "SELL" | "NEUTRAL";
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export interface SignalEvent {
  index: number; // candle index
  kind: "entry" | "exit";
  confidence: number; // 0–100, estimate only
  reasons: string[];
}

export interface StrategyResult {
  id: string;
  name: string;
  category: string;
  riskLevel: RiskLevel;
  signal: SignalDirection;
  confidence: number; // 0–100, estimate only
  reasons: string[];
  stopLoss: number | null;
  target: number | null;
  riskReward: number | null;
  /** Suggested quantity risking ~1% of a 100k MadCoins account. */
  positionSizePer100k: number | null;
  events: SignalEvent[];
}

interface Context {
  candles: Candle[];
  closes: number[];
  ema20: ReturnType<typeof ema>;
  ema50: ReturnType<typeof ema>;
  rsi14: ReturnType<typeof rsi>;
  macdR: ReturnType<typeof macd>;
  atr14: ReturnType<typeof atr>;
  boll: ReturnType<typeof bollinger>;
  st: ReturnType<typeof superTrend>;
  stoch: ReturnType<typeof stochastic>;
  adxR: ReturnType<typeof adx>;
  vwapS: ReturnType<typeof vwap>;
  mfi14: ReturnType<typeof mfi>;
  donch: ReturnType<typeof donchian>;
  avgVol: number[];
}

function buildContext(candles: Candle[]): Context {
  const closes = candles.map((c) => c.close);
  const vols = candles.map((c) => c.volume ?? 0);
  const avgVol = vols.map((_, i) =>
    i >= 20 ? vols.slice(i - 20, i).reduce((s, v) => s + v, 0) / 20 : 0
  );
  return {
    candles,
    closes,
    ema20: ema(closes, 20),
    ema50: ema(closes, 50),
    rsi14: rsi(closes, 14),
    macdR: macd(closes),
    atr14: atr(candles, 14),
    boll: bollinger(closes, 20, 2),
    st: superTrend(candles, 10, 3),
    stoch: stochastic(candles, 14, 3),
    adxR: adx(candles, 14),
    vwapS: vwap(candles),
    mfi14: mfi(candles, 14),
    donch: donchian(candles, 20),
    avgVol,
  };
}

/** Confidence = 50 baseline + 7 per concurring independent indicator, capped. */
function contextConfidence(ctx: Context, i: number, dir: "BUY" | "SELL"): {
  confidence: number;
  reasons: string[];
} {
  const reasons: string[] = [];
  const bull = dir === "BUY";
  const checks: Array<[boolean | null, string]> = [
    [
      ctx.ema20[i] != null && ctx.ema50[i] != null
        ? bull
          ? ctx.ema20[i]! > ctx.ema50[i]!
          : ctx.ema20[i]! < ctx.ema50[i]!
        : null,
      bull ? "EMA 20 above EMA 50 (uptrend)" : "EMA 20 below EMA 50 (downtrend)",
    ],
    [
      ctx.rsi14[i] != null ? (bull ? ctx.rsi14[i]! < 45 : ctx.rsi14[i]! > 55) : null,
      bull
        ? `RSI ${ctx.rsi14[i]?.toFixed(0)} has room to run`
        : `RSI ${ctx.rsi14[i]?.toFixed(0)} elevated`,
    ],
    [
      ctx.macdR.histogram[i] != null
        ? bull
          ? ctx.macdR.histogram[i]! > 0
          : ctx.macdR.histogram[i]! < 0
        : null,
      bull ? "MACD histogram positive" : "MACD histogram negative",
    ],
    [
      ctx.st.trend[i] != null ? (bull ? ctx.st.trend[i] === 1 : ctx.st.trend[i] === -1) : null,
      bull ? "SuperTrend bullish" : "SuperTrend bearish",
    ],
    [
      ctx.avgVol[i] > 0 ? (ctx.candles[i].volume ?? 0) > 1.5 * ctx.avgVol[i] : null,
      "Above-average volume",
    ],
    [
      ctx.adxR.adx[i] != null ? ctx.adxR.adx[i]! > 20 : null,
      `ADX ${ctx.adxR.adx[i]?.toFixed(0)} shows trend strength`,
    ],
    [
      ctx.mfi14[i] != null ? (bull ? ctx.mfi14[i]! < 65 : ctx.mfi14[i]! > 35) : null,
      "Money-flow supportive",
    ],
  ];
  let confidence = 50;
  for (const [passed, reason] of checks) {
    if (passed) {
      confidence += 7;
      reasons.push(reason);
    }
  }
  return { confidence: Math.min(confidence, 92), reasons };
}

function riskLevels(
  ctx: Context,
  i: number,
  dir: "BUY" | "SELL"
): Pick<StrategyResult, "stopLoss" | "target" | "riskReward" | "positionSizePer100k"> {
  const a = ctx.atr14[i];
  const price = ctx.closes[i];
  if (a == null || !price) {
    return { stopLoss: null, target: null, riskReward: null, positionSizePer100k: null };
  }
  const slDist = 1.5 * a;
  const tgDist = 2.5 * a;
  const stopLoss = dir === "BUY" ? price - slDist : price + slDist;
  const target = dir === "BUY" ? price + tgDist : price - tgDist;
  const round = (v: number) => Math.round(v * 100) / 100;
  return {
    stopLoss: round(stopLoss),
    target: round(target),
    riskReward: round(tgDist / slDist),
    positionSizePer100k: Math.max(1, Math.floor(1000 / slDist)), // risk 1% of 1L
  };
}

interface StrategyDef {
  id: string;
  name: string;
  category: string;
  riskLevel: RiskLevel;
  /** Return +1 for entry, -1 for exit, 0 otherwise, plus the core reason. */
  detect(ctx: Context, i: number): { kind: "entry" | "exit"; reason: string } | null;
}

const cross = (a: (number | null)[], b: (number | null)[], i: number) =>
  a[i] != null && b[i] != null && a[i - 1] != null && b[i - 1] != null
    ? a[i - 1]! <= b[i - 1]! && a[i]! > b[i]!
      ? 1
      : a[i - 1]! >= b[i - 1]! && a[i]! < b[i]!
        ? -1
        : 0
    : 0;

export const STRATEGY_DEFS: StrategyDef[] = [
  {
    id: "ema-cross",
    name: "Moving Average Cross (20/50)",
    category: "Trend Following",
    riskLevel: "MEDIUM",
    detect(ctx, i) {
      const c = cross(ctx.ema20, ctx.ema50, i);
      if (c === 1) return { kind: "entry", reason: "EMA 20 crossed above EMA 50" };
      if (c === -1) return { kind: "exit", reason: "EMA 20 crossed below EMA 50" };
      return null;
    },
  },
  {
    id: "supertrend",
    name: "SuperTrend (10, 3)",
    category: "Trend Following",
    riskLevel: "MEDIUM",
    detect(ctx, i) {
      if (ctx.st.trend[i] == null || ctx.st.trend[i - 1] == null) return null;
      if (ctx.st.trend[i - 1] === -1 && ctx.st.trend[i] === 1)
        return { kind: "entry", reason: "SuperTrend flipped bullish" };
      if (ctx.st.trend[i - 1] === 1 && ctx.st.trend[i] === -1)
        return { kind: "exit", reason: "SuperTrend flipped bearish" };
      return null;
    },
  },
  {
    id: "rsi-reversal",
    name: "RSI Reversal (30/70)",
    category: "Mean Reversion",
    riskLevel: "HIGH",
    detect(ctx, i) {
      const r0 = ctx.rsi14[i - 1];
      const r1 = ctx.rsi14[i];
      if (r0 == null || r1 == null) return null;
      if (r0 <= 30 && r1 > 30)
        return { kind: "entry", reason: `RSI recovering from oversold (${r1.toFixed(0)})` };
      if (r0 >= 70 && r1 < 70)
        return { kind: "exit", reason: `RSI falling from overbought (${r1.toFixed(0)})` };
      return null;
    },
  },
  {
    id: "macd-momentum",
    name: "MACD Momentum",
    category: "Momentum",
    riskLevel: "MEDIUM",
    detect(ctx, i) {
      const c = cross(ctx.macdR.macd, ctx.macdR.signal, i);
      if (c === 1) return { kind: "entry", reason: "MACD bullish crossover" };
      if (c === -1) return { kind: "exit", reason: "MACD bearish crossover" };
      return null;
    },
  },
  {
    id: "bollinger-breakout",
    name: "Bollinger Breakout",
    category: "Breakout",
    riskLevel: "HIGH",
    detect(ctx, i) {
      const { upper, lower } = ctx.boll;
      if (upper[i] == null || lower[i] == null) return null;
      const vol = ctx.candles[i].volume ?? 0;
      const highVol = ctx.avgVol[i] > 0 && vol > 1.3 * ctx.avgVol[i];
      if (ctx.closes[i - 1] <= upper[i - 1]! && ctx.closes[i] > upper[i]! && highVol)
        return { kind: "entry", reason: "High-volume breakout above upper Bollinger band" };
      if (ctx.closes[i - 1] >= lower[i - 1]! && ctx.closes[i] < lower[i]!)
        return { kind: "exit", reason: "Breakdown below lower Bollinger band" };
      return null;
    },
  },
  {
    id: "donchian-breakout",
    name: "Channel Breakout (20-bar)",
    category: "Breakout / Opening Range",
    riskLevel: "MEDIUM",
    detect(ctx, i) {
      const d = ctx.donch;
      if (d.upper[i] == null || d.lower[i] == null) return null;
      if (ctx.closes[i] > d.upper[i]!)
        return { kind: "entry", reason: "Close above 20-bar high (range breakout)" };
      if (ctx.closes[i] < d.lower[i]!)
        return { kind: "exit", reason: "Close below 20-bar low (range breakdown)" };
      return null;
    },
  },
  {
    id: "vwap-trend",
    name: "VWAP Reclaim",
    category: "Intraday / Scalping",
    riskLevel: "HIGH",
    detect(ctx, i) {
      const c = cross(
        ctx.closes.map((v) => v),
        ctx.vwapS,
        i
      );
      const vol = ctx.candles[i].volume ?? 0;
      if (c === 1 && ctx.avgVol[i] > 0 && vol > ctx.avgVol[i])
        return { kind: "entry", reason: "Price reclaimed VWAP on rising volume" };
      if (c === -1) return { kind: "exit", reason: "Price lost VWAP" };
      return null;
    },
  },
  {
    id: "stochastic-swing",
    name: "Stochastic Swing",
    category: "Swing Trading",
    riskLevel: "MEDIUM",
    detect(ctx, i) {
      const { k, d } = ctx.stoch;
      if (k[i] == null || d[i] == null || k[i - 1] == null || d[i - 1] == null) return null;
      if (k[i - 1]! <= d[i - 1]! && k[i]! > d[i]! && k[i]! < 30)
        return { kind: "entry", reason: "Stochastic %K crossed %D in oversold zone" };
      if (k[i - 1]! >= d[i - 1]! && k[i]! < d[i]! && k[i]! > 70)
        return { kind: "exit", reason: "Stochastic %K crossed %D in overbought zone" };
      return null;
    },
  },
];

/** Run every strategy across the candle history. */
export function runStrategies(candles: Candle[]): StrategyResult[] {
  if (candles.length < 30) return [];
  const ctx = buildContext(candles);
  const last = candles.length - 1;
  const sr = supportResistance(candles);

  return STRATEGY_DEFS.map((def) => {
    const events: SignalEvent[] = [];
    for (let i = 1; i < candles.length; i++) {
      const hit = def.detect(ctx, i);
      if (!hit) continue;
      const dir = hit.kind === "entry" ? "BUY" : "SELL";
      const { confidence, reasons } = contextConfidence(ctx, i, dir);
      const extra: string[] = [];
      if (hit.kind === "exit" && sr.resistance != null && ctx.closes[i] >= sr.resistance * 0.99)
        extra.push("Near strong resistance");
      if (hit.kind === "entry" && sr.support != null && ctx.closes[i] <= sr.support * 1.02)
        extra.push("Bouncing off support");
      events.push({
        index: i,
        kind: hit.kind,
        confidence,
        reasons: [hit.reason, ...extra, ...reasons.slice(0, 3)],
      });
    }

    // Current stance: last event within 5 bars drives the live signal.
    const recent = events[events.length - 1];
    const isRecent = recent && last - recent.index <= 5;
    const signal: SignalDirection = isRecent
      ? recent.kind === "entry"
        ? "BUY"
        : "SELL"
      : "NEUTRAL";
    const dir = signal === "SELL" ? "SELL" : "BUY";
    const { confidence, reasons } = isRecent
      ? { confidence: recent.confidence, reasons: recent.reasons }
      : { confidence: 0, reasons: ["No active setup in the last 5 bars"] };

    return {
      id: def.id,
      name: def.name,
      category: def.category,
      riskLevel: def.riskLevel,
      signal,
      confidence,
      reasons,
      ...riskLevels(ctx, last, dir),
      events: events.slice(-40),
    };
  });
}
