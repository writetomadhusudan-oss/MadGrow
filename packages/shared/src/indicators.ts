// Technical indicator library. All functions are pure, operate on candle
// series, and return arrays aligned with the input (leading nulls while the
// indicator warms up). Outputs are educational estimates, not advice.
import type { Candle } from "./types";

export type Series = (number | null)[];

export function sma(values: number[], period: number): Series {
  const out: Series = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

export function ema(values: number[], period: number): Series {
  const out: Series = new Array(values.length).fill(null);
  const k = 2 / (period + 1);
  let prev: number | null = null;
  for (let i = 0; i < values.length; i++) {
    if (prev == null) {
      if (i === period - 1) {
        prev = values.slice(0, period).reduce((s, v) => s + v, 0) / period;
        out[i] = prev;
      }
    } else {
      prev = values[i] * k + prev * (1 - k);
      out[i] = prev;
    }
  }
  return out;
}

/** Wilder's RSI. */
export function rsi(closes: number[], period = 14): Series {
  const out: Series = new Array(closes.length).fill(null);
  let gain = 0;
  let loss = 0;
  for (let i = 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    const up = Math.max(change, 0);
    const down = Math.max(-change, 0);
    if (i <= period) {
      gain += up;
      loss += down;
      if (i === period) {
        gain /= period;
        loss /= period;
        out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
      }
    } else {
      gain = (gain * (period - 1) + up) / period;
      loss = (loss * (period - 1) + down) / period;
      out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
    }
  }
  return out;
}

export function macd(
  closes: number[],
  fast = 12,
  slow = 26,
  signalPeriod = 9
): { macd: Series; signal: Series; histogram: Series } {
  const fastE = ema(closes, fast);
  const slowE = ema(closes, slow);
  const macdLine: Series = closes.map((_, i) =>
    fastE[i] != null && slowE[i] != null ? fastE[i]! - slowE[i]! : null
  );
  const valid = macdLine.filter((v): v is number => v != null);
  const offset = macdLine.length - valid.length;
  const sig = ema(valid, signalPeriod);
  const signal: Series = macdLine.map((_, i) => (i >= offset ? sig[i - offset] : null));
  const histogram: Series = macdLine.map((v, i) =>
    v != null && signal[i] != null ? v - signal[i]! : null
  );
  return { macd: macdLine, signal, histogram };
}

/** Wilder's ATR. */
export function atr(candles: Candle[], period = 14): Series {
  const out: Series = new Array(candles.length).fill(null);
  let prev: number | null = null;
  let sum = 0;
  for (let i = 1; i < candles.length; i++) {
    const tr = Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - candles[i - 1].close),
      Math.abs(candles[i].low - candles[i - 1].close)
    );
    if (i <= period) {
      sum += tr;
      if (i === period) {
        prev = sum / period;
        out[i] = prev;
      }
    } else if (prev != null) {
      prev = (prev * (period - 1) + tr) / period;
      out[i] = prev;
    }
  }
  return out;
}

export function bollinger(
  closes: number[],
  period = 20,
  mult = 2
): { upper: Series; middle: Series; lower: Series } {
  const middle = sma(closes, period);
  const upper: Series = new Array(closes.length).fill(null);
  const lower: Series = new Array(closes.length).fill(null);
  for (let i = period - 1; i < closes.length; i++) {
    const window = closes.slice(i - period + 1, i + 1);
    const mean = middle[i]!;
    const sd = Math.sqrt(window.reduce((s, v) => s + (v - mean) ** 2, 0) / period);
    upper[i] = mean + mult * sd;
    lower[i] = mean - mult * sd;
  }
  return { upper, middle, lower };
}

/** Cumulative VWAP over the provided series (use intraday candles for session VWAP). */
export function vwap(candles: Candle[]): Series {
  const out: Series = new Array(candles.length).fill(null);
  let pv = 0;
  let vol = 0;
  for (let i = 0; i < candles.length; i++) {
    const typical = (candles[i].high + candles[i].low + candles[i].close) / 3;
    const v = candles[i].volume ?? 0;
    pv += typical * v;
    vol += v;
    out[i] = vol > 0 ? pv / vol : null;
  }
  return out;
}

export function stochastic(
  candles: Candle[],
  kPeriod = 14,
  dPeriod = 3
): { k: Series; d: Series } {
  const k: Series = new Array(candles.length).fill(null);
  for (let i = kPeriod - 1; i < candles.length; i++) {
    const window = candles.slice(i - kPeriod + 1, i + 1);
    const high = Math.max(...window.map((c) => c.high));
    const low = Math.min(...window.map((c) => c.low));
    k[i] = high === low ? 50 : ((candles[i].close - low) / (high - low)) * 100;
  }
  const validK = k.filter((v): v is number => v != null);
  const offset = k.length - validK.length;
  const dRaw = sma(validK, dPeriod);
  const d: Series = k.map((_, i) => (i >= offset ? dRaw[i - offset] : null));
  return { k, d };
}

export function adx(
  candles: Candle[],
  period = 14
): { adx: Series; plusDI: Series; minusDI: Series } {
  const n = candles.length;
  const out = {
    adx: new Array(n).fill(null) as Series,
    plusDI: new Array(n).fill(null) as Series,
    minusDI: new Array(n).fill(null) as Series,
  };
  if (n < period * 2) return out;
  let trSum = 0;
  let plusSum = 0;
  let minusSum = 0;
  let adxPrev: number | null = null;
  let dxSum = 0;
  for (let i = 1; i < n; i++) {
    const upMove = candles[i].high - candles[i - 1].high;
    const downMove = candles[i - 1].low - candles[i].low;
    const plusDM = upMove > downMove && upMove > 0 ? upMove : 0;
    const minusDM = downMove > upMove && downMove > 0 ? downMove : 0;
    const tr = Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - candles[i - 1].close),
      Math.abs(candles[i].low - candles[i - 1].close)
    );
    if (i <= period) {
      trSum += tr;
      plusSum += plusDM;
      minusSum += minusDM;
    } else {
      trSum = trSum - trSum / period + tr;
      plusSum = plusSum - plusSum / period + plusDM;
      minusSum = minusSum - minusSum / period + minusDM;
    }
    if (i >= period) {
      const pDI = trSum > 0 ? (plusSum / trSum) * 100 : 0;
      const mDI = trSum > 0 ? (minusSum / trSum) * 100 : 0;
      out.plusDI[i] = pDI;
      out.minusDI[i] = mDI;
      const dx = pDI + mDI > 0 ? (Math.abs(pDI - mDI) / (pDI + mDI)) * 100 : 0;
      if (i < period * 2) {
        dxSum += dx;
        if (i === period * 2 - 1) {
          adxPrev = dxSum / period;
          out.adx[i] = adxPrev;
        }
      } else if (adxPrev != null) {
        adxPrev = (adxPrev * (period - 1) + dx) / period;
        out.adx[i] = adxPrev;
      }
    }
  }
  return out;
}

/** SuperTrend: trend[i] = 1 (bullish) or -1 (bearish). */
export function superTrend(
  candles: Candle[],
  period = 10,
  mult = 3
): { trend: (1 | -1 | null)[]; line: Series } {
  const atrS = atr(candles, period);
  const n = candles.length;
  const trend: (1 | -1 | null)[] = new Array(n).fill(null);
  const line: Series = new Array(n).fill(null);
  let upper = 0;
  let lower = 0;
  let dir: 1 | -1 = 1;
  let started = false;
  for (let i = 0; i < n; i++) {
    const a = atrS[i];
    if (a == null) continue;
    const mid = (candles[i].high + candles[i].low) / 2;
    const bUpper = mid + mult * a;
    const bLower = mid - mult * a;
    if (!started) {
      upper = bUpper;
      lower = bLower;
      dir = candles[i].close >= mid ? 1 : -1;
      started = true;
    } else {
      upper = bUpper < upper || candles[i - 1].close > upper ? bUpper : upper;
      lower = bLower > lower || candles[i - 1].close < lower ? bLower : lower;
      if (dir === 1 && candles[i].close < lower) dir = -1;
      else if (dir === -1 && candles[i].close > upper) dir = 1;
    }
    trend[i] = dir;
    line[i] = dir === 1 ? lower : upper;
  }
  return { trend, line };
}

export function obv(candles: Candle[]): Series {
  const out: Series = new Array(candles.length).fill(null);
  let acc = 0;
  out[0] = 0;
  for (let i = 1; i < candles.length; i++) {
    const v = candles[i].volume ?? 0;
    if (candles[i].close > candles[i - 1].close) acc += v;
    else if (candles[i].close < candles[i - 1].close) acc -= v;
    out[i] = acc;
  }
  return out;
}

export function mfi(candles: Candle[], period = 14): Series {
  const out: Series = new Array(candles.length).fill(null);
  const typical = candles.map((c) => (c.high + c.low + c.close) / 3);
  for (let i = period; i < candles.length; i++) {
    let pos = 0;
    let neg = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const flow = typical[j] * (candles[j].volume ?? 0);
      if (typical[j] > typical[j - 1]) pos += flow;
      else if (typical[j] < typical[j - 1]) neg += flow;
    }
    out[i] = neg === 0 ? 100 : 100 - 100 / (1 + pos / neg);
  }
  return out;
}

export function roc(closes: number[], period = 10): Series {
  return closes.map((v, i) =>
    i >= period && closes[i - period] !== 0 ? ((v - closes[i - period]) / closes[i - period]) * 100 : null
  );
}

export function donchian(
  candles: Candle[],
  period = 20
): { upper: Series; lower: Series } {
  const upper: Series = new Array(candles.length).fill(null);
  const lower: Series = new Array(candles.length).fill(null);
  for (let i = period; i < candles.length; i++) {
    const window = candles.slice(i - period, i); // exclude current bar
    upper[i] = Math.max(...window.map((c) => c.high));
    lower[i] = Math.min(...window.map((c) => c.low));
  }
  return { upper, lower };
}

export function cmf(candles: Candle[], period = 20): Series {
  const out: Series = new Array(candles.length).fill(null);
  for (let i = period - 1; i < candles.length; i++) {
    let mfv = 0;
    let vol = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const c = candles[j];
      const range = c.high - c.low;
      const mult = range > 0 ? (c.close - c.low - (c.high - c.close)) / range : 0;
      mfv += mult * (c.volume ?? 0);
      vol += c.volume ?? 0;
    }
    out[i] = vol > 0 ? mfv / vol : null;
  }
  return out;
}

/** Classic floor-trader pivots from the most recent completed candle. */
export function pivotPoints(candle: Candle): {
  pivot: number;
  r1: number;
  r2: number;
  s1: number;
  s2: number;
} {
  const pivot = (candle.high + candle.low + candle.close) / 3;
  return {
    pivot,
    r1: 2 * pivot - candle.low,
    r2: pivot + (candle.high - candle.low),
    s1: 2 * pivot - candle.high,
    s2: pivot - (candle.high - candle.low),
  };
}

/** Fractal swing highs/lows (strength bars on each side). */
export function swings(
  candles: Candle[],
  strength = 2
): { highs: number[]; lows: number[] } {
  const highs: number[] = [];
  const lows: number[] = [];
  for (let i = strength; i < candles.length - strength; i++) {
    const isHigh = candles
      .slice(i - strength, i + strength + 1)
      .every((c, j) => j === strength || c.high <= candles[i].high);
    const isLow = candles
      .slice(i - strength, i + strength + 1)
      .every((c, j) => j === strength || c.low >= candles[i].low);
    if (isHigh) highs.push(i);
    if (isLow) lows.push(i);
  }
  return { highs, lows };
}

/** Nearest support/resistance derived from recent swing levels. */
export function supportResistance(
  candles: Candle[],
  lookback = 120
): { support: number | null; resistance: number | null } {
  const slice = candles.slice(-lookback);
  const { highs, lows } = swings(slice, 2);
  const price = slice[slice.length - 1]?.close;
  if (price == null) return { support: null, resistance: null };
  const resistLevels = highs.map((i) => slice[i].high).filter((h) => h > price);
  const supportLevels = lows.map((i) => slice[i].low).filter((l) => l < price);
  return {
    support: supportLevels.length ? Math.max(...supportLevels) : null,
    resistance: resistLevels.length ? Math.min(...resistLevels) : null,
  };
}
