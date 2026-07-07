import type { Holding, TransactionRecord } from "./types";

interface Lot {
  quantity: number;
  price: number;
}

/**
 * Compute current holdings from a transaction history.
 * Buys add lots; sells consume lots FIFO and accrue realized P&L.
 * Average cost reflects the remaining (unsold) lots only.
 */
export function computeHoldings(transactions: TransactionRecord[]): Holding[] {
  const sorted = [...transactions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const bySymbol = new Map<string, { name: string; lots: Lot[]; realizedPnl: number }>();

  for (const tx of sorted) {
    let entry = bySymbol.get(tx.symbol);
    if (!entry) {
      entry = { name: tx.name ?? tx.symbol, lots: [], realizedPnl: 0 };
      bySymbol.set(tx.symbol, entry);
    }
    if (tx.name) entry.name = tx.name;

    if (tx.type === "BUY") {
      entry.lots.push({ quantity: tx.quantity, price: tx.price });
    } else {
      let remaining = tx.quantity;
      while (remaining > 0 && entry.lots.length > 0) {
        const lot = entry.lots[0];
        const consumed = Math.min(lot.quantity, remaining);
        entry.realizedPnl += consumed * (tx.price - lot.price);
        lot.quantity -= consumed;
        remaining -= consumed;
        if (lot.quantity <= 1e-9) entry.lots.shift();
      }
      // Oversells are rejected at the API layer; ignore any excess defensively.
    }
  }

  const holdings: Holding[] = [];
  for (const [symbol, entry] of bySymbol) {
    const quantity = entry.lots.reduce((sum, lot) => sum + lot.quantity, 0);
    const invested = entry.lots.reduce((sum, lot) => sum + lot.quantity * lot.price, 0);
    if (quantity <= 1e-9 && entry.realizedPnl === 0) continue;
    holdings.push({
      symbol,
      name: entry.name,
      quantity,
      avgCost: quantity > 0 ? invested / quantity : 0,
      invested,
      realizedPnl: entry.realizedPnl,
    });
  }
  return holdings;
}

/**
 * Quantity of a symbol held as of a given date (inclusive).
 * Used to validate that a sell does not exceed the position.
 */
export function quantityHeldOn(
  transactions: TransactionRecord[],
  symbol: string,
  date: string
): number {
  const cutoff = new Date(date).getTime();
  return transactions
    .filter((tx) => tx.symbol === symbol && new Date(tx.date).getTime() <= cutoff)
    .reduce((sum, tx) => sum + (tx.type === "BUY" ? tx.quantity : -tx.quantity), 0);
}
