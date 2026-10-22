import { describe, expect, it } from "vitest";
import {
  checkRisk,
  DEFAULT_RISK_LIMITS,
  detectDailySetups,
  detectOrb,
  isMarketOpen,
  planExit,
  sizePosition,
  timeMachine,
} from "./dayTrader";
import type { Candle } from "./types";

// 09:15 IST = 03:45 UTC. 2026-10-21 is a Wednesday.
function bar(i: number, o: number, h: number, l: number, c: number, day = "2026-10-21"): Candle {
  const t = new Date(`${day}T03:45:00Z`).getTime() + i * 5 * 60_000;
  return { time: new Date(t).toISOString(), open: o, high: h, low: l, close: c, volume: 1000 };
}

describe("market clock", () => {
  it("is open mid-session on a weekday and closed on weekends / holidays", () => {
    expect(isMarketOpen(new Date("2026-10-21T06:00:00Z"))).toBe(true); // 11:30 IST
    expect(isMarketOpen(new Date("2026-10-21T10:00:00Z"))).toBe(false); // 15:30 IST
    expect(isMarketOpen(new Date("2026-10-24T06:00:00Z"))).toBe(false); // Saturday
    expect(isMarketOpen(new Date("2026-10-21T06:00:00Z"), ["2026-10-21"])).toBe(false);
  });
});

describe("detectOrb", () => {
  const range = [bar(0, 100, 101, 99, 100), bar(1, 100, 102, 99.5, 101), bar(2, 101, 101.5, 99.8, 100.5)];
  it("returns the first bar that closes above the opening-range high", () => {
    const s = [...range, bar(3, 100.5, 102, 100, 101.9), bar(4, 101.9, 103, 101.8, 102.6)];
    const hit = detectOrb(s)!;
    expect(hit.rangeHigh).toBe(102);
    expect(hit.rangeLow).toBe(99);
    expect(hit.barIndex).toBe(4);
    expect(hit.entry).toBe(102.6);
  });
  it("ignores a wick above the range without a close, and honours the cutoff", () => {
    expect(detectOrb([...range, bar(3, 100, 105, 99, 101.5)])).toBeNull();
    const late = [...range];
    for (let i = 3; i < 60; i++) late.push(bar(i, 101, 101.5, 100.5, 101));
    late.push(bar(60, 101, 110, 101, 109)); // 14:15+... beyond cutoff? index 60 = 14:15
    late.push(bar(70, 101, 110, 101, 109)); // 15:05 — after cutoff
    expect(detectOrb(late.slice(0, 60))).toBeNull();
  });
});

describe("detectDailySetups", () => {
  const mk = (closes: number[]): Candle[] =>
    closes.map((c, i) => ({ time: `2026-09-${String(i + 1).padStart(2, "0")}`, open: c, high: c, low: c, close: c, volume: 1 }));
  it("flags a 20-day breakout", () => {
    const closes = Array.from({ length: 25 }, (_, i) => 100 + (i % 3));
    closes.push(110);
    expect(detectDailySetups(mk(closes)).map((s) => s.id)).toContain("breakout_20d");
  });
  it("flags oversold after a steady slide", () => {
    const closes = Array.from({ length: 30 }, (_, i) => 200 - i * 3);
    expect(detectDailySetups(mk(closes)).map((s) => s.id)).toContain("oversold");
  });
  it("needs enough history", () => {
    expect(detectDailySetups(mk([1, 2, 3]))).toEqual([]);
  });
});

describe("planExit", () => {
  it("uses the range midpoint rounded away from entry and a 2R target", () => {
    const p = planExit({ entry: 102.6, stopMode: "or-mid", rangeMid: 100.53 });
    expect(p.stop).toBe(100.5);
    expect(p.riskPerShare).toBe(2.1);
    expect(p.target).toBe(106.8);
    expect(p.rewardRisk).toBe(2);
  });
  it("refuses a stop at/above entry or one that is too tight", () => {
    expect(() => planExit({ entry: 100, stopMode: "price", stopValue: 100 })).toThrow();
    expect(() => planExit({ entry: 1000, stopMode: "pct", stopValue: 0.01 })).toThrow(/too close/);
  });
});

describe("sizePosition", () => {
  it("floors maxLoss / risk and respects the position cap", () => {
    expect(sizePosition({ maxLoss: 5000, entry: 100, stop: 98 }).quantity).toBe(2500);
    const capped = sizePosition({ maxLoss: 5000, entry: 100, stop: 98, capital: 100000, maxPositionPct: 20 });
    expect(capped.quantity).toBe(200);
    expect(capped.cappedBy).toBe("position-size");
  });
  it("returns zero when the stop is not below entry", () => {
    expect(sizePosition({ maxLoss: 100, entry: 100, stop: 101 }).quantity).toBe(0);
  });
});

describe("checkRisk", () => {
  const ctx = { now: new Date("2026-10-21T05:30:00Z"), capital: 1_000_000, cashAvailable: 1_000_000, todayPnl: 0, tradesToday: 0 }; // 11:00 IST
  const good = { quantity: 100, entry: 500, stop: 490, target: 520 };
  it("passes a clean order", () => {
    expect(checkRisk(good, DEFAULT_RISK_LIMITS, ctx)).toEqual({ pass: true, reasons: [] });
  });
  it("reports every broken rule", () => {
    const v = checkRisk({ quantity: 1000, entry: 500, stop: 490, target: 505 }, DEFAULT_RISK_LIMITS, { ...ctx, tradesToday: 3, todayPnl: -20000 });
    expect(v.pass).toBe(false);
    expect(v.reasons.join(" ")).toMatch(/per-trade limit/);
    expect(v.reasons.join(" ")).toMatch(/Reward:risk/);
    expect(v.reasons.join(" ")).toMatch(/Daily loss/);
    expect(v.reasons.join(" ")).toMatch(/trades today/);
  });
  it("blocks missing stops and out-of-window entries", () => {
    expect(checkRisk({ ...good, stop: null }, DEFAULT_RISK_LIMITS, ctx).pass).toBe(false);
    const late = { ...ctx, now: new Date("2026-10-21T09:30:00Z") }; // 15:00 IST
    expect(checkRisk(good, DEFAULT_RISK_LIMITS, late).reasons.join(" ")).toMatch(/entry window/);
  });
});

describe("timeMachine", () => {
  const flatSession = (): Candle[] => Array.from({ length: 20 }, (_, i) => bar(i, 100, 100.1, 99.9, 100));
  const upSession = (): Candle[] => Array.from({ length: 20 }, (_, i) => bar(i, 100 + i, 101 + i, 99 + i, 100 + i));
  it("never hits anything on a flat tape", () => {
    const r = timeMachine({ sessions: [flatSession()], fromBarIndex: 4, entry: 100, stop: 98, target: 104, runs: 200 });
    expect(r.neither).toBe(1);
    expect(r.expectedR).toBeCloseTo(0, 5);
  });
  it("hits the target first on a rising tape and the stop first on a gap down", () => {
    const up = timeMachine({ sessions: [upSession()], fromBarIndex: 4, entry: 100, stop: 90, target: 104, runs: 100 });
    expect(up.targetFirst).toBe(1);
    const down = Array.from({ length: 20 }, (_, i) => bar(i, 100 - i * 2, 101 - i * 2, 99 - i * 2, 100 - i * 2));
    const dn = timeMachine({ sessions: [down], fromBarIndex: 4, entry: 100, stop: 98, target: 110, runs: 100 });
    expect(dn.stopFirst).toBe(1);
  });
  it("is deterministic with an injected rand and rejects thin history", () => {
    const seq = [0.1, 0.9, 0.4];
    let k = 0;
    const rand = () => seq[k++ % seq.length];
    const a = timeMachine({ sessions: [flatSession(), upSession()], fromBarIndex: 4, entry: 100, stop: 95, target: 103, runs: 50, rand });
    k = 0;
    const b = timeMachine({ sessions: [flatSession(), upSession()], fromBarIndex: 4, entry: 100, stop: 95, target: 103, runs: 50, rand });
    expect(a).toEqual(b);
    expect(() => timeMachine({ sessions: [[bar(0, 1, 1, 1, 1)]], fromBarIndex: 4, entry: 1, stop: 0.5, target: 2 })).toThrow();
  });
});
