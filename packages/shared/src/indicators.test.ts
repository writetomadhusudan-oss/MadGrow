import { describe, expect, it } from "vitest";
import type { Candle } from "./types";
import { atr, bollinger, ema, macd, resampleCandles, rsi, sma, superTrend, vwap } from "./indicators";
import { runStrategies } from "./strategies";
import { blackScholesGreeks } from "./blackScholes";

const candle = (close: number, i: number, volume = 1000): Candle => ({
  time: new Date(2026, 0, 1 + i).toISOString(),
  open: close - 1,
  high: close + 2,
  low: close - 2,
  close,
  volume,
});

const rampCandles = (n: number, start = 100, step = 1) =>
  Array.from({ length: n }, (_, i) => candle(start + i * step, i));

describe("sma / ema", () => {
  it("computes simple average over the window", () => {
    const out = sma([1, 2, 3, 4, 5], 3);
    expect(out).toEqual([null, null, 2, 3, 4]);
  });
  it("ema warms up with sma then smooths", () => {
    const out = ema([1, 2, 3, 4, 5], 3);
    expect(out[2]).toBe(2);
    expect(out[3]).toBeCloseTo(3); // 4*0.5 + 2*0.5
    expect(out[4]).toBeCloseTo(4);
  });
});

describe("rsi", () => {
  it("is 100 for a pure uptrend and low for a downtrend", () => {
    const up = rsi(Array.from({ length: 20 }, (_, i) => 100 + i), 14);
    expect(up[19]).toBe(100);
    const down = rsi(Array.from({ length: 20 }, (_, i) => 100 - i), 14);
    expect(down[19]).toBe(0);
  });
});

describe("macd", () => {
  it("is positive in an accelerating uptrend", () => {
    const closes = Array.from({ length: 60 }, (_, i) => 100 * Math.pow(1.01, i));
    const { macd: line, histogram } = macd(closes);
    expect(line[59]).toBeGreaterThan(0);
    expect(histogram[59]).not.toBeNull();
  });
});

describe("atr / bollinger / vwap / supertrend", () => {
  it("atr reflects the constant 4-point range", () => {
    const out = atr(rampCandles(30), 14);
    expect(out[29]).toBeGreaterThan(3.5);
    expect(out[29]).toBeLessThan(5.5);
  });
  it("bollinger brackets the mean", () => {
    const { upper, middle, lower } = bollinger(rampCandles(30).map((c) => c.close), 20, 2);
    expect(upper[29]!).toBeGreaterThan(middle[29]!);
    expect(lower[29]!).toBeLessThan(middle[29]!);
  });
  it("vwap sits inside the day's range", () => {
    const out = vwap(rampCandles(10));
    expect(out[9]!).toBeGreaterThan(100 - 2);
    expect(out[9]!).toBeLessThan(110 + 2);
  });
  it("supertrend is bullish in a steady uptrend", () => {
    const { trend } = superTrend(rampCandles(60), 10, 3);
    expect(trend[59]).toBe(1);
  });
});

describe("resampleCandles", () => {
  const bar = (iso: string, o: number, h: number, l: number, c: number, v: number): Candle => ({
    time: iso, open: o, high: h, low: l, close: c, volume: v,
  });

  it("merges OHLCV in groups", () => {
    const out = resampleCandles(
      [
        bar("2026-07-08T04:00:00Z", 100, 105, 99, 103, 10),
        bar("2026-07-08T04:05:00Z", 103, 110, 102, 108, 20),
        bar("2026-07-08T04:10:00Z", 108, 109, 101, 102, 5),
      ],
      2
    );
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual(bar("2026-07-08T04:00:00Z", 100, 110, 99, 108, 30));
    expect(out[1]).toEqual(bar("2026-07-08T04:10:00Z", 108, 109, 101, 102, 5)); // partial tail
  });

  it("never merges across day boundaries", () => {
    const out = resampleCandles(
      [
        bar("2026-07-08T09:00:00Z", 1, 2, 1, 2, 1),
        bar("2026-07-09T04:00:00Z", 3, 4, 3, 4, 1),
      ],
      2
    );
    expect(out).toHaveLength(2);
  });

  it("is identity for groupSize 1", () => {
    const candles = [bar("2026-07-08T04:00:00Z", 1, 2, 1, 2, 1)];
    expect(resampleCandles(candles, 1)).toBe(candles);
  });
});

describe("runStrategies", () => {
  it("returns every strategy with required fields on real-shaped data", () => {
    // V-shaped series: downtrend then recovery — should produce some events.
    const candles = [
      ...Array.from({ length: 60 }, (_, i) => candle(200 - i, i)),
      ...Array.from({ length: 60 }, (_, i) => candle(140 + i * 1.5, 60 + i, 2500)),
    ];
    const results = runStrategies(candles);
    expect(results.length).toBeGreaterThanOrEqual(8);
    for (const r of results) {
      expect(["BUY", "SELL", "NEUTRAL"]).toContain(r.signal);
      expect(r.confidence).toBeGreaterThanOrEqual(0);
      expect(r.confidence).toBeLessThanOrEqual(100);
      expect(Array.isArray(r.reasons)).toBe(true);
      expect(["LOW", "MEDIUM", "HIGH"]).toContain(r.riskLevel);
    }
    const totalEvents = results.reduce((s, r) => s + r.events.length, 0);
    expect(totalEvents).toBeGreaterThan(0);
  });

  it("returns empty for insufficient history", () => {
    expect(runStrategies(rampCandles(10))).toEqual([]);
  });
});

describe("blackScholesGreeks", () => {
  it("ATM call delta ≈ 0.5+, put delta ≈ call - 1", () => {
    const call = blackScholesGreeks("CALL", 100, 100, 30 / 365, 0.2)!;
    const put = blackScholesGreeks("PUT", 100, 100, 30 / 365, 0.2)!;
    expect(call.delta).toBeGreaterThan(0.5);
    expect(call.delta).toBeLessThan(0.6);
    expect(put.delta).toBeCloseTo(call.delta - 1, 4);
    expect(call.gamma).toBeGreaterThan(0);
    expect(call.theta).toBeLessThan(0);
    expect(call.vega).toBeGreaterThan(0);
  });
  it("returns null for invalid inputs", () => {
    expect(blackScholesGreeks("CALL", 0, 100, 0.1, 0.2)).toBeNull();
  });
});
