// Client-side types mirroring the /trading API payloads.
import type { FeeBreakdown, OrderSide, OrderStatus, OrderType } from "@market-cap/shared";

export interface PositionRow {
  symbol: string;
  name: string | null;
  quantity: number;
  avgPrice: number;
  stopLoss: number | null;
  target: number | null;
  lastPrice: number | null;
  dayChangePercent: number | null;
  unrealizedPnl: number | null;
  value: number | null;
}

export interface WalletSummary {
  startingBalance: number;
  balance: number;
  available: number;
  usedMargin: number;
  unrealizedPnl: number;
  realizedPnl: number;
  todayRealizedPnl: number;
  todayPnl: number;
  equity: number;
  lifetimePnl: number;
  positions: PositionRow[];
  disclaimer: string;
}

export interface OrderRow {
  id: string;
  symbol: string;
  name: string | null;
  side: OrderSide;
  type: OrderType;
  quantity: number;
  limitPrice: number | null;
  stopPrice: number | null;
  status: OrderStatus;
  filledPrice: number | null;
  fees: number | null;
  note: string | null;
  createdAt: string;
}

export interface TradeRow {
  id: string;
  symbol: string;
  side: OrderSide;
  quantity: number;
  price: number;
  fees: number;
  pnl: number | null;
  createdAt: string;
}

export interface AlertRow {
  id: string;
  type: string;
  symbol: string | null;
  message: string;
  read: boolean;
  createdAt: string;
}

export type { FeeBreakdown };

/** MadCoins formatting: Indian digit grouping, MC suffix. */
const mc = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });
export function formatMC(value: number | null | undefined): string {
  if (value == null) return "—";
  return `${mc.format(value)} MC`;
}
