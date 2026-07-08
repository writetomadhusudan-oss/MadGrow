import { describe, expect, it } from "vitest";
import {
  applyFill,
  applySlippage,
  computeFees,
  DEFAULT_FEE_CONFIG,
  marginUsed,
  shouldTrigger,
  unrealizedPnl,
} from "./trading";

const cfg = DEFAULT_FEE_CONFIG;

describe("computeFees", () => {
  it("caps brokerage and applies buy-only stamp duty", () => {
    const fees = computeFees(cfg, "BUY", 100, 1000); // turnover 1,00,000
    expect(fees.brokerage).toBe(20); // 0.03% = 30 → capped at 20
    expect(fees.stt).toBe(100); // 0.1%
    expect(fees.stampDuty).toBe(15); // 0.015% buy only
    expect(fees.total).toBeGreaterThan(135);
    const sellFees = computeFees(cfg, "SELL", 100, 1000);
    expect(sellFees.stampDuty).toBe(0);
  });

  it("charges GST on brokerage + exchange + sebi", () => {
    const fees = computeFees(cfg, "SELL", 10, 100); // turnover 1000
    const gstBase = fees.brokerage + fees.exchange + fees.sebi;
    expect(fees.gst).toBeCloseTo(Math.round(gstBase * 0.18 * 100) / 100, 1);
  });
});

describe("applySlippage", () => {
  it("is adverse-only and bounded", () => {
    expect(applySlippage(cfg, "BUY", 100, 1)).toBeCloseTo(100.05);
    expect(applySlippage(cfg, "SELL", 100, 1)).toBeCloseTo(99.95);
    expect(applySlippage(cfg, "BUY", 100, 0)).toBe(100);
  });
});

describe("applyFill — longs", () => {
  it("opens and averages a long", () => {
    let fx = applyFill({ quantity: 0, avgPrice: 0 }, "BUY", 10, 100, 5);
    expect(fx.position).toEqual({ quantity: 10, avgPrice: 100 });
    expect(fx.cashDelta).toBe(-1005);
    fx = applyFill(fx.position, "BUY", 10, 200, 5);
    expect(fx.position).toEqual({ quantity: 20, avgPrice: 150 });
  });

  it("realizes P&L on partial sell and keeps avg", () => {
    const fx = applyFill({ quantity: 20, avgPrice: 150 }, "SELL", 5, 180, 3);
    expect(fx.realizedPnl).toBe(150); // (180-150)*5
    expect(fx.cashDelta).toBe(5 * 180 - 3);
    expect(fx.position).toEqual({ quantity: 15, avgPrice: 150 });
    expect(fx.closed).toBe(false);
  });

  it("flags full close", () => {
    const fx = applyFill({ quantity: 5, avgPrice: 100 }, "SELL", 5, 90, 1);
    expect(fx.realizedPnl).toBe(-50);
    expect(fx.position.quantity).toBe(0);
    expect(fx.position.avgPrice).toBe(0);
    expect(fx.closed).toBe(true);
  });
});

describe("applyFill — shorts", () => {
  it("opens a short with no principal movement (fees only)", () => {
    const fx = applyFill({ quantity: 0, avgPrice: 0 }, "SELL", 10, 100, 4);
    expect(fx.position).toEqual({ quantity: -10, avgPrice: 100 });
    expect(fx.cashDelta).toBe(-4);
    expect(marginUsed([fx.position])).toBe(1000);
  });

  it("covers a short and settles only P&L", () => {
    const fx = applyFill({ quantity: -10, avgPrice: 100 }, "BUY", 10, 90, 4);
    expect(fx.realizedPnl).toBe(100); // (100-90)*10
    expect(fx.cashDelta).toBe(96); // pnl - fees
    expect(fx.position.quantity).toBe(0);
    expect(fx.closed).toBe(true);
  });

  it("crosses zero: sell 15 while long 10 → short 5 at fill price", () => {
    const fx = applyFill({ quantity: 10, avgPrice: 100 }, "SELL", 15, 120, 6);
    expect(fx.realizedPnl).toBe(200); // close 10 long
    expect(fx.position).toEqual({ quantity: -5, avgPrice: 120 });
    expect(fx.cashDelta).toBe(10 * 120 - 6); // proceeds of long leg minus fees
  });

  it("crosses zero: buy 15 while short 10 → long 5 at fill price", () => {
    const fx = applyFill({ quantity: -10, avgPrice: 100 }, "BUY", 15, 80, 6);
    expect(fx.realizedPnl).toBe(200); // cover 10 @ 80
    expect(fx.position).toEqual({ quantity: 5, avgPrice: 80 });
    expect(fx.cashDelta).toBe(200 - 5 * 80 - 6);
  });
});

describe("unrealizedPnl", () => {
  it("handles both directions", () => {
    expect(unrealizedPnl({ quantity: 10, avgPrice: 100 }, 110)).toBe(100);
    expect(unrealizedPnl({ quantity: -10, avgPrice: 100 }, 110)).toBe(-100);
  });
});

describe("shouldTrigger", () => {
  it("limit orders", () => {
    expect(shouldTrigger("LIMIT", "BUY", 99, 100, null)).toBe(true);
    expect(shouldTrigger("LIMIT", "BUY", 101, 100, null)).toBe(false);
    expect(shouldTrigger("LIMIT", "SELL", 101, 100, null)).toBe(true);
  });
  it("stop orders", () => {
    expect(shouldTrigger("STOP", "SELL", 95, null, 96)).toBe(true);
    expect(shouldTrigger("STOP", "BUY", 105, null, 104)).toBe(true);
    expect(shouldTrigger("STOP", "SELL", 97, null, 96)).toBe(false);
  });
  it("stop-limit needs trigger AND limit satisfied", () => {
    expect(shouldTrigger("STOP_LIMIT", "SELL", 95, 94, 96)).toBe(true);
    expect(shouldTrigger("STOP_LIMIT", "SELL", 93, 94, 96)).toBe(false);
  });
});
