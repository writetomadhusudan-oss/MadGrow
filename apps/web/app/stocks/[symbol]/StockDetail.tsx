"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Candle, ChartRange, NewsItem, Quote } from "@market-cap/shared";
import { api } from "@/lib/api";
import {
  displaySymbol,
  formatINR,
  formatIndianCompact,
  formatNumber,
  formatPercent,
  formatSigned,
} from "@/lib/format";
import { ChangeBadge } from "@/components/ChangeBadge";
import { NewsList } from "@/components/NewsList";
import { PriceChart } from "@/components/PriceChart";
import { StockAvatar } from "@/components/StockAvatar";
import { WatchButton } from "@/components/WatchButton";

const RANGES: { value: ChartRange; label: string }[] = [
  { value: "1d", label: "1D" },
  { value: "1w", label: "1W" },
  { value: "1mo", label: "1M" },
  { value: "6mo", label: "6M" },
  { value: "1y", label: "1Y" },
  { value: "5y", label: "5Y" },
];

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-line py-2.5 last:border-0 sm:block sm:border-0 sm:py-0">
      <p className="text-xs text-faint">{label}</p>
      <p className="text-sm font-semibold sm:mt-1">{value}</p>
    </div>
  );
}

export function StockDetail({ symbol }: { symbol: string }) {
  const [range, setRange] = useState<ChartRange>("1d");

  const { data: quote, error } = useQuery({
    queryKey: ["quote", symbol],
    queryFn: () => api<Quote>(`/stocks/${encodeURIComponent(symbol)}`),
  });
  const { data: candles } = useQuery({
    queryKey: ["history", symbol, range],
    queryFn: () =>
      api<Candle[]>(`/stocks/${encodeURIComponent(symbol)}/history?range=${range}`),
  });
  const { data: newsItems } = useQuery({
    queryKey: ["stock-news", symbol],
    queryFn: () => api<NewsItem[]>(`/stocks/${encodeURIComponent(symbol)}/news`),
    refetchInterval: 10 * 60_000,
  });

  if (error) {
    return (
      <div className="rounded-card bg-card p-10 text-center shadow-card">
        <p className="text-lg font-semibold">Couldn&apos;t load {displaySymbol(symbol)}</p>
        <p className="mt-1 text-sm text-soft">{(error as Error).message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header card */}
      <section className="rounded-card bg-card p-6 shadow-card">
        <div className="flex flex-wrap items-center gap-4">
          <StockAvatar symbol={symbol} size={52} />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-bold">{quote?.name ?? displaySymbol(symbol)}</h1>
            <p className="text-sm text-faint">
              {displaySymbol(symbol)} · {quote?.exchange ?? "—"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">{formatINR(quote?.price)}</p>
            <div className="mt-1 flex items-center justify-end gap-2">
              <span
                className={`text-sm font-semibold ${
                  (quote?.change ?? 0) >= 0 ? "text-gain" : "text-loss"
                }`}
              >
                {formatSigned(quote?.change)}
              </span>
              <ChangeBadge value={quote?.changePercent} size="sm" />
            </div>
          </div>
          <WatchButton symbol={symbol} name={quote?.name} />
        </div>

        {/* Range tabs */}
        <div className="mt-6 flex flex-wrap gap-2">
          {RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                range === r.value
                  ? "bg-ink text-white shadow-card"
                  : "border border-line bg-card text-soft hover:border-accent hover:text-accent-deep"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* Chart */}
        <div className="mt-4">
          {candles ? (
            candles.length > 0 ? (
              <PriceChart candles={candles} range={range} />
            ) : (
              <p className="py-16 text-center text-sm text-soft">
                No chart data for this range
              </p>
            )
          ) : (
            <div className="h-[320px] animate-pulse rounded-2xl bg-canvas" />
          )}
        </div>
      </section>

      {/* Stats */}
      <section className="rounded-card bg-card p-6 shadow-card">
        <h2 className="mb-4 text-lg font-bold">Key Stats</h2>
        <div className="grid grid-cols-1 gap-x-8 gap-y-0 sm:grid-cols-3 sm:gap-y-5 lg:grid-cols-4">
          <Stat label="Open" value={formatNumber(quote?.open)} />
          <Stat label="High" value={formatNumber(quote?.dayHigh)} />
          <Stat label="Low" value={formatNumber(quote?.dayLow)} />
          <Stat label="Prev close" value={formatNumber(quote?.previousClose)} />
          <Stat label="Mkt cap" value={formatIndianCompact(quote?.marketCap)} />
          <Stat label="P/E ratio" value={formatNumber(quote?.peRatio)} />
          <Stat label="EPS (TTM)" value={formatNumber(quote?.eps)} />
          <Stat
            label="Div yield"
            value={quote?.dividendYield != null ? `${(quote.dividendYield * 100).toFixed(2)}%` : "—"}
          />
          <Stat label="52-wk high" value={formatNumber(quote?.fiftyTwoWeekHigh)} />
          <Stat label="52-wk low" value={formatNumber(quote?.fiftyTwoWeekLow)} />
          <Stat label="Volume" value={formatIndianCompact(quote?.volume)} />
          <Stat
            label="Day range"
            value={
              quote?.dayLow != null && quote?.dayHigh != null
                ? `${formatNumber(quote.dayLow)} – ${formatNumber(quote.dayHigh)}`
                : "—"
            }
          />
        </div>
      </section>

      {/* Buy / Sell — wired to portfolio in the next milestone */}
      <section className="flex gap-3">
        <a
          href={`/portfolio?symbol=${encodeURIComponent(symbol)}&action=BUY`}
          className="flex-1 rounded-full bg-gradient-to-r from-accent to-accent-deep py-3 text-center text-sm font-bold text-white shadow-pop transition hover:opacity-90"
        >
          Buy
        </a>
        <a
          href={`/portfolio?symbol=${encodeURIComponent(symbol)}&action=SELL`}
          className="flex-1 rounded-full border border-line bg-card py-3 text-center text-sm font-bold text-ink shadow-card transition hover:border-accent"
        >
          Sell
        </a>
      </section>

      {/* News */}
      <section className="rounded-card bg-card p-6 shadow-card">
        <h2 className="mb-1 text-lg font-bold">News</h2>
        {newsItems ? (
          newsItems.length > 0 ? (
            <NewsList items={newsItems} limit={8} />
          ) : (
            <p className="py-6 text-sm text-soft">No recent news found.</p>
          )
        ) : (
          <div className="h-40 animate-pulse rounded-2xl bg-canvas" />
        )}
      </section>
    </div>
  );
}
