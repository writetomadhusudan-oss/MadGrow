"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Flame, TrendingDown, TrendingUp } from "lucide-react";
import type { IndexQuote, NewsItem, Quote } from "@market-cap/shared";
import { api } from "@/lib/api";
import { formatNumber, formatPercent } from "@/lib/format";
import { ChangeBadge } from "@/components/ChangeBadge";
import { MoversList } from "@/components/MoversList";
import { NewsList } from "@/components/NewsList";
import { StockCard } from "@/components/StockCard";

interface Movers {
  gainers: Quote[];
  losers: Quote[];
  mostActive: Quote[];
}

function marketHeadline(indices: IndexQuote[] | undefined): string {
  const nifty = indices?.find((i) => i.symbol === "^NSEI");
  if (!nifty) return "Markets Today";
  if (nifty.changePercent > 0.15) return "Markets are Up Today";
  if (nifty.changePercent < -0.15) return "Markets are Down Today";
  return "Markets are Flat Today";
}

export default function Dashboard() {
  const { data: indices } = useQuery({
    queryKey: ["indices"],
    queryFn: () => api<IndexQuote[]>("/market/indices"),
  });
  const { data: movers } = useQuery({
    queryKey: ["movers"],
    queryFn: () => api<Movers>("/market/movers"),
  });
  const { data: newsItems } = useQuery({
    queryKey: ["market-news"],
    queryFn: () => api<NewsItem[]>("/market/news"),
    refetchInterval: 10 * 60_000,
  });

  const featured = movers?.mostActive.slice(0, 4) ?? [];

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="rounded-card bg-card p-6 shadow-card sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">
          NSE · BSE · Live-ish
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          {marketHeadline(indices)}
        </h1>
        <div className="mt-5 flex flex-wrap gap-3">
          {(indices ?? []).map((idx) => (
            <div
              key={idx.symbol}
              className="flex items-center gap-3 rounded-2xl border border-line bg-canvas/60 px-4 py-2.5"
            >
              <span className="text-sm font-semibold">{idx.name}</span>
              <span className="text-sm font-bold">{formatNumber(idx.price)}</span>
              <span
                className={`text-xs font-semibold ${
                  idx.changePercent >= 0 ? "text-gain" : "text-loss"
                }`}
              >
                {formatPercent(idx.changePercent)}
              </span>
            </div>
          ))}
          {!indices && (
            <div className="h-11 w-64 animate-pulse rounded-2xl bg-canvas" />
          )}
        </div>
      </section>

      {/* Most active */}
      <section>
        <div className="mb-3 flex items-center justify-between px-1">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Flame size={18} className="text-accent" /> Most Active
          </h2>
          <Link
            href="/watchlist"
            className="flex items-center gap-1 text-sm font-medium text-accent-deep hover:underline"
          >
            Watchlist <ArrowRight size={14} />
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {featured.map((q) => (
            <StockCard key={q.symbol} quote={q} />
          ))}
          {featured.length === 0 &&
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-40 animate-pulse rounded-card bg-card/70" />
            ))}
        </div>
      </section>

      {/* Gainers / Losers */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-card bg-card p-5 shadow-card">
          <h2 className="mb-2 flex items-center gap-2 text-lg font-bold">
            <TrendingUp size={18} className="text-gain" /> Top Gainers
          </h2>
          {movers ? (
            <MoversList quotes={movers.gainers.slice(0, 6)} />
          ) : (
            <div className="h-64 animate-pulse rounded-2xl bg-canvas" />
          )}
        </div>
        <div className="rounded-card bg-card p-5 shadow-card">
          <h2 className="mb-2 flex items-center gap-2 text-lg font-bold">
            <TrendingDown size={18} className="text-loss" /> Top Losers
          </h2>
          {movers ? (
            <MoversList quotes={movers.losers.slice(0, 6)} />
          ) : (
            <div className="h-64 animate-pulse rounded-2xl bg-canvas" />
          )}
        </div>
      </section>

      {/* News */}
      <section className="rounded-card bg-card p-5 shadow-card">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-lg font-bold">Market News</h2>
          <Link
            href="/news"
            className="flex items-center gap-1 text-sm font-medium text-accent-deep hover:underline"
          >
            See all <ArrowRight size={14} />
          </Link>
        </div>
        {newsItems ? (
          <NewsList items={newsItems} limit={5} />
        ) : (
          <div className="h-48 animate-pulse rounded-2xl bg-canvas" />
        )}
      </section>
    </div>
  );
}
