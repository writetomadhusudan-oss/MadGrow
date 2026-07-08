// Option-chain provider abstraction. Yahoo's free API serves chains for
// US-listed instruments but NOT for NSE/BSE derivatives (no NIFTY/BANKNIFTY
// chains, OI, or IV). A licensed Indian provider (Zerodha Kite, TrueData,
// Global Datafeeds) can implement this same interface to light up NSE
// derivatives without touching routes or UI.
import YahooFinance from "yahoo-finance2";
import { blackScholesGreeks, type Greeks } from "@market-cap/shared";
import { cached } from "../cache";

const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

export interface OptionRow {
  strike: number;
  type: "CALL" | "PUT";
  ltp: number | null;
  bid: number | null;
  ask: number | null;
  volume: number | null;
  openInterest: number | null;
  changeInOI: number | null; // requires historical OI — null on Yahoo
  changePercent: number | null;
  iv: number | null; // decimal
  greeks: Greeks | null;
}

export interface OptionChain {
  supported: boolean;
  reason?: string;
  symbol: string;
  underlyingPrice: number | null;
  expirations: string[];
  expiration: string | null;
  calls: OptionRow[];
  puts: OptionRow[];
}

export interface OptionChainProvider {
  getChain(symbol: string, expiration?: string): Promise<OptionChain>;
}

interface YahooOptionRaw {
  strike?: number;
  lastPrice?: number;
  bid?: number;
  ask?: number;
  volume?: number;
  openInterest?: number;
  percentChange?: number;
  impliedVolatility?: number;
}

class YahooOptionsProvider implements OptionChainProvider {
  async getChain(symbol: string, expiration?: string): Promise<OptionChain> {
    const empty: OptionChain = {
      supported: false,
      symbol,
      underlyingPrice: null,
      expirations: [],
      expiration: null,
      calls: [],
      puts: [],
    };
    try {
      const key = `options:${symbol}:${expiration ?? "front"}`;
      return await cached(key, 5 * 60_000, async () => {
        const result = (await yahooFinance.options(symbol, {
          ...(expiration ? { date: new Date(expiration) } : {}),
        })) as {
          quote?: { regularMarketPrice?: number };
          expirationDates?: Array<Date | number>;
          options?: Array<{ expirationDate?: Date | number; calls?: YahooOptionRaw[]; puts?: YahooOptionRaw[] }>;
        };
        const chain = result.options?.[0];
        if (!chain || ((chain.calls?.length ?? 0) === 0 && (chain.puts?.length ?? 0) === 0)) {
          return {
            ...empty,
            reason:
              "The connected market-data provider (Yahoo Finance, free tier) does not publish option chains for this instrument. NSE/BSE derivatives need a licensed data provider — the provider interface is ready for one.",
          };
        }
        const spot = result.quote?.regularMarketPrice ?? null;
        const expiryDate = chain.expirationDate ? new Date(chain.expirationDate) : null;
        const timeYears = expiryDate
          ? Math.max((expiryDate.getTime() - Date.now()) / (365 * 24 * 3600 * 1000), 1 / 365)
          : null;

        const mapRow = (type: "CALL" | "PUT") => (o: YahooOptionRaw): OptionRow => ({
          strike: o.strike ?? 0,
          type,
          ltp: o.lastPrice ?? null,
          bid: o.bid ?? null,
          ask: o.ask ?? null,
          volume: o.volume ?? null,
          openInterest: o.openInterest ?? null,
          changeInOI: null,
          changePercent: o.percentChange ?? null,
          iv: o.impliedVolatility ?? null,
          greeks:
            spot && o.strike && timeYears && o.impliedVolatility
              ? blackScholesGreeks(type, spot, o.strike, timeYears, o.impliedVolatility)
              : null,
        });

        return {
          supported: true,
          symbol,
          underlyingPrice: spot,
          expirations: (result.expirationDates ?? []).map((d) =>
            new Date(d).toISOString().slice(0, 10)
          ),
          expiration: expiryDate ? expiryDate.toISOString().slice(0, 10) : null,
          calls: (chain.calls ?? []).map(mapRow("CALL")).sort((a, b) => a.strike - b.strike),
          puts: (chain.puts ?? []).map(mapRow("PUT")).sort((a, b) => a.strike - b.strike),
        };
      });
    } catch {
      return {
        ...empty,
        reason:
          "Option chain unavailable from the current provider for this symbol. NSE/BSE derivatives require a licensed data feed (e.g. Kite Connect, TrueData); plug one into OptionChainProvider to enable them.",
      };
    }
  }
}

export const optionChains: OptionChainProvider = new YahooOptionsProvider();
