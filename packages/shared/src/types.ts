export interface Quote {
  symbol: string;
  name: string;
  exchange: string;
  currency: string;
  price: number;
  change: number;
  changePercent: number;
  previousClose: number | null;
  open: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  volume: number | null;
  marketCap: number | null;
  peRatio: number | null;
  eps: number | null;
  dividendYield: number | null;
  marketTime: string | null;
}

export interface IndexQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  dayHigh: number | null;
  dayLow: number | null;
  marketTime: string | null;
}

export interface SearchResult {
  symbol: string;
  name: string;
  exchange: string;
}

export interface Candle {
  time: string; // ISO date or datetime
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
}

export type ChartRange = "1d" | "1w" | "1mo" | "6mo" | "1y" | "5y";

export interface NewsItem {
  title: string;
  link: string;
  source: string;
  publishedAt: string;
}

export type TransactionType = "BUY" | "SELL";

export interface TransactionInput {
  symbol: string;
  name?: string;
  type: TransactionType;
  quantity: number;
  price: number;
  date: string; // ISO date
}

export interface TransactionRecord extends TransactionInput {
  id: string;
}

export interface Holding {
  symbol: string;
  name: string;
  quantity: number;
  avgCost: number;
  invested: number;
  realizedPnl: number;
}

export interface HoldingWithQuote extends Holding {
  currentPrice: number | null;
  currentValue: number | null;
  unrealizedPnl: number | null;
  unrealizedPnlPercent: number | null;
  dayChange: number | null;
  dayChangePercent: number | null;
}

export interface PortfolioSummary {
  totalValue: number;
  totalInvested: number;
  totalUnrealizedPnl: number;
  totalUnrealizedPnlPercent: number | null;
  totalRealizedPnl: number;
  totalDayChange: number;
  holdings: HoldingWithQuote[];
}

export interface UserInfo {
  id: string;
  email: string;
  name: string | null;
}
