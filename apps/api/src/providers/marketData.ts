import YahooFinance from "yahoo-finance2";
import {
  resampleCandles,
  type Candle,
  type ChartRange,
  type IndexQuote,
  type Quote,
  type SearchResult,
} from "@market-cap/shared";
import { cached, TTL } from "../cache";
import { INDICES, NIFTY_100 } from "../data/symbols";

const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

export interface MarketDataProvider {
  getQuote(symbol: string): Promise<Quote>;
  getQuotes(symbols: string[]): Promise<Quote[]>;
  search(query: string): Promise<SearchResult[]>;
  getHistory(symbol: string, range: ChartRange): Promise<Candle[]>;
  getIndices(): Promise<IndexQuote[]>;
  getMovers(): Promise<{ gainers: Quote[]; losers: Quote[]; mostActive: Quote[] }>;
}

// The fields we consume from Yahoo quote responses, stable across library versions.
interface YahooQuote {
  symbol: string;
  longName?: string;
  shortName?: string;
  fullExchangeName?: string;
  exchange?: string;
  currency?: string;
  regularMarketPrice?: number;
  regularMarketChange?: number;
  regularMarketChangePercent?: number;
  regularMarketPreviousClose?: number;
  regularMarketOpen?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  regularMarketVolume?: number;
  marketCap?: number;
  trailingPE?: number;
  epsTrailingTwelveMonths?: number;
  trailingAnnualDividendYield?: number;
  regularMarketTime?: Date | number;
}

function toQuote(q: YahooQuote): Quote {
  return {
    symbol: q.symbol,
    name: q.longName ?? q.shortName ?? q.symbol,
    exchange: q.fullExchangeName ?? q.exchange ?? "",
    currency: q.currency ?? "INR",
    price: q.regularMarketPrice ?? 0,
    change: q.regularMarketChange ?? 0,
    changePercent: q.regularMarketChangePercent ?? 0,
    previousClose: q.regularMarketPreviousClose ?? null,
    open: q.regularMarketOpen ?? null,
    dayHigh: q.regularMarketDayHigh ?? null,
    dayLow: q.regularMarketDayLow ?? null,
    fiftyTwoWeekHigh: q.fiftyTwoWeekHigh ?? null,
    fiftyTwoWeekLow: q.fiftyTwoWeekLow ?? null,
    volume: q.regularMarketVolume ?? null,
    marketCap: q.marketCap ?? null,
    peRatio: q.trailingPE ?? null,
    eps: q.epsTrailingTwelveMonths ?? null,
    dividendYield: q.trailingAnnualDividendYield ?? null,
    marketTime: q.regularMarketTime ? new Date(q.regularMarketTime).toISOString() : null,
  };
}

type YahooInterval = "1m" | "5m" | "15m" | "30m" | "60m" | "1d" | "1wk";

interface RangeConfig {
  days: number; // lookback window requested from Yahoo
  interval: YahooInterval; // base interval fetched
  group?: number; // resample factor (10m = 2×5m, 4h = 4×60m)
  lastSessionOnly?: boolean; // trim to most recent trading day
}

// Yahoo free-tier limits: 1m history ≈ last 7 days; 5m–60m ≈ last 60 days
// (60m stretches further). 10m and 4h aren't served natively — we resample.
const RANGE_CONFIG: Record<ChartRange, RangeConfig> = {
  "1m": { days: 4, interval: "1m", lastSessionOnly: true },
  "5m": { days: 5, interval: "5m" },
  "10m": { days: 10, interval: "5m", group: 2 },
  "30m": { days: 30, interval: "30m" },
  "1h": { days: 55, interval: "60m" },
  "4h": { days: 120, interval: "60m", group: 4 },
  "1d": { days: 5, interval: "5m", lastSessionOnly: true },
  "1w": { days: 7, interval: "15m" },
  "1mo": { days: 31, interval: "1d" },
  "6mo": { days: 183, interval: "1d" },
  "1y": { days: 366, interval: "1d" },
  "5y": { days: 5 * 366, interval: "1wk" },
};

class YahooFinanceProvider implements MarketDataProvider {
  async getQuote(symbol: string): Promise<Quote> {
    return cached(`quote:${symbol}`, TTL.quote, async () => {
      const q = await yahooFinance.quote(symbol);
      return toQuote(q as unknown as YahooQuote);
    });
  }

  async getQuotes(symbols: string[]): Promise<Quote[]> {
    if (symbols.length === 0) return [];
    return cached(`quotes:${symbols.slice().sort().join(",")}`, TTL.quote, async () => {
      const results = await yahooFinance.quote(symbols);
      return (Array.isArray(results) ? results : [results]).map((q) =>
        toQuote(q as unknown as YahooQuote)
      );
    });
  }

  async search(query: string): Promise<SearchResult[]> {
    return cached(`search:${query.toLowerCase()}`, TTL.search, async () => {
      const res = await yahooFinance.search(query, { quotesCount: 12, newsCount: 0 });
      const quotes = res.quotes as Array<{
        symbol?: string;
        quoteType?: string;
        longname?: string;
        shortname?: string;
      }>;
      return quotes
        .filter(
          (q): q is { symbol: string; quoteType: string; longname?: string; shortname?: string } =>
            typeof q.symbol === "string" &&
            q.quoteType === "EQUITY" &&
            (q.symbol.endsWith(".NS") || q.symbol.endsWith(".BO"))
        )
        .map((q) => ({
          symbol: q.symbol,
          name: q.longname ?? q.shortname ?? q.symbol,
          exchange: q.symbol.endsWith(".NS") ? "NSE" : "BSE",
        }));
    });
  }

  async getHistory(symbol: string, range: ChartRange): Promise<Candle[]> {
    return cached(`history:${symbol}:${range}`, TTL.history, async () => {
      const { days, interval, group, lastSessionOnly } = RANGE_CONFIG[range];
      const period1 = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const result = await yahooFinance.chart(symbol, { period1, interval });
      let candles: Candle[] = result.quotes
        .filter((c) => c.close != null)
        .map((c) => ({
          time: new Date(c.date).toISOString(),
          open: c.open ?? c.close!,
          high: c.high ?? c.close!,
          low: c.low ?? c.close!,
          close: c.close!,
          volume: c.volume ?? null,
        }));
      if (lastSessionOnly && candles.length > 0) {
        // Keep only the most recent trading session.
        const lastDay = candles[candles.length - 1].time.slice(0, 10);
        candles = candles.filter((c) => c.time.slice(0, 10) === lastDay);
      }
      if (group) candles = resampleCandles(candles, group);
      return candles;
    });
  }

  async getIndices(): Promise<IndexQuote[]> {
    return cached("indices", TTL.quote, async () => {
      const results = await yahooFinance.quote(INDICES.map((i) => i.symbol));
      const list = Array.isArray(results) ? results : [results];
      return INDICES.map((idx) => {
        const q = list.find((r) => r.symbol === idx.symbol);
        return {
          symbol: idx.symbol,
          name: idx.name,
          price: q?.regularMarketPrice ?? 0,
          change: q?.regularMarketChange ?? 0,
          changePercent: q?.regularMarketChangePercent ?? 0,
          dayHigh: q?.regularMarketDayHigh ?? null,
          dayLow: q?.regularMarketDayLow ?? null,
          marketTime: q?.regularMarketTime ? new Date(q.regularMarketTime).toISOString() : null,
        };
      });
    });
  }

  async getMovers(): Promise<{ gainers: Quote[]; losers: Quote[]; mostActive: Quote[] }> {
    return cached("movers", TTL.movers, async () => {
      const quotes = await this.getQuotes(NIFTY_100);
      const valid = quotes.filter((q) => q.price > 0);
      const byChange = [...valid].sort((a, b) => b.changePercent - a.changePercent);
      const byVolume = [...valid].sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0));
      return {
        gainers: byChange.slice(0, 10),
        losers: byChange.slice(-10).reverse(),
        mostActive: byVolume.slice(0, 10),
      };
    });
  }
}

export const marketData: MarketDataProvider = new YahooFinanceProvider();
