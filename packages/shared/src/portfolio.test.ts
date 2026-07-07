import { describe, expect, it } from "vitest";
import { computeHoldings, quantityHeldOn } from "./portfolio";
import type { TransactionRecord } from "./types";

const tx = (
  overrides: Partial<TransactionRecord> & Pick<TransactionRecord, "type" | "quantity" | "price">
): TransactionRecord => ({
  id: Math.random().toString(36).slice(2),
  symbol: "RELIANCE.NS",
  date: "2026-01-01",
  ...overrides,
});

describe("computeHoldings", () => {
  it("averages cost across multiple buys", () => {
    const holdings = computeHoldings([
      tx({ type: "BUY", quantity: 10, price: 100, date: "2026-01-01" }),
      tx({ type: "BUY", quantity: 10, price: 200, date: "2026-01-02" }),
    ]);
    expect(holdings).toHaveLength(1);
    expect(holdings[0].quantity).toBe(20);
    expect(holdings[0].avgCost).toBe(150);
    expect(holdings[0].invested).toBe(3000);
    expect(holdings[0].realizedPnl).toBe(0);
  });

  it("consumes lots FIFO on sell and computes realized P&L", () => {
    const holdings = computeHoldings([
      tx({ type: "BUY", quantity: 10, price: 100, date: "2026-01-01" }),
      tx({ type: "BUY", quantity: 10, price: 200, date: "2026-01-02" }),
      tx({ type: "SELL", quantity: 15, price: 250, date: "2026-01-03" }),
    ]);
    expect(holdings).toHaveLength(1);
    const h = holdings[0];
    expect(h.quantity).toBe(5);
    // Remaining 5 shares come from the second (₹200) lot.
    expect(h.avgCost).toBe(200);
    expect(h.invested).toBe(1000);
    // Realized: 10*(250-100) + 5*(250-200) = 1500 + 250
    expect(h.realizedPnl).toBe(1750);
  });

  it("keeps fully-sold positions only when they have realized P&L", () => {
    const holdings = computeHoldings([
      tx({ type: "BUY", quantity: 10, price: 100, date: "2026-01-01" }),
      tx({ type: "SELL", quantity: 10, price: 120, date: "2026-01-02" }),
    ]);
    expect(holdings).toHaveLength(1);
    expect(holdings[0].quantity).toBe(0);
    expect(holdings[0].realizedPnl).toBe(200);
  });

  it("sorts by date regardless of input order", () => {
    const holdings = computeHoldings([
      tx({ type: "SELL", quantity: 5, price: 300, date: "2026-02-01" }),
      tx({ type: "BUY", quantity: 10, price: 100, date: "2026-01-01" }),
    ]);
    expect(holdings[0].quantity).toBe(5);
    expect(holdings[0].realizedPnl).toBe(1000);
  });

  it("tracks symbols independently", () => {
    const holdings = computeHoldings([
      tx({ type: "BUY", quantity: 10, price: 100 }),
      tx({ symbol: "TCS.NS", type: "BUY", quantity: 2, price: 4000 }),
    ]);
    expect(holdings).toHaveLength(2);
  });

  it("handles fractional quantities", () => {
    const holdings = computeHoldings([
      tx({ type: "BUY", quantity: 1.5, price: 100, date: "2026-01-01" }),
      tx({ type: "SELL", quantity: 0.5, price: 200, date: "2026-01-02" }),
    ]);
    expect(holdings[0].quantity).toBeCloseTo(1);
    expect(holdings[0].realizedPnl).toBeCloseTo(50);
  });
});

describe("quantityHeldOn", () => {
  const history = [
    tx({ type: "BUY", quantity: 10, price: 100, date: "2026-01-01" }),
    tx({ type: "SELL", quantity: 4, price: 120, date: "2026-01-10" }),
  ];

  it("counts transactions up to and including the date", () => {
    expect(quantityHeldOn(history, "RELIANCE.NS", "2026-01-05")).toBe(10);
    expect(quantityHeldOn(history, "RELIANCE.NS", "2026-01-10")).toBe(6);
  });

  it("returns 0 for unknown symbols", () => {
    expect(quantityHeldOn(history, "TCS.NS", "2026-01-10")).toBe(0);
  });
});
