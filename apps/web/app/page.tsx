"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Flame,
  LineChart,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import type { IndexQuote, NewsItem, Quote } from "@market-cap/shared";
import { api } from "@/lib/api";
import { useUser } from "@/lib/auth";
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

function WelcomeHero() {
  return (
    <section className="overflow-hidden rounded-card bg-gradient-to-br from-ink via-[#2c2597] to-accent p-7 text-white shadow-pop sm:p-10">
      <p className="text-xs font-semibold uppercase tracking-widest text-white/70">
        Educational paper trading · Virtual MadCoins only
      </p>
      <h1 className="mt-3 max-w-2xl text-3xl font-bold leading-tight sm:text-4xl">
        Learn to trade the markets — with zero real-money risk.
      </h1>
      <p className="mt-3 max-w-xl text-sm text-white/80 sm:text-base">
        Practice on live NSE &amp; BSE prices with a simulated wallet. Place real-style
        orders, track profit &amp; loss, and get AI-assisted entry/exit ideas — all in
        virtual MadCoins.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/register"
          className="rounded-full bg-white px-6 py-2.5 text-sm font-bold text-accent-deep shadow-card transition hover:opacity-90"
        >
          Create free account
        </Link>
        <Link
          href="/login"
          className="rounded-full border border-white/40 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-white/10"
        >
          Log in
        </Link>
      </div>
      <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { icon: Wallet, title: "1,000,000 MadCoins", sub: "Free virtual balance to practice with" },
          { icon: LineChart, title: "Real market data", sub: "Live NSE/BSE prices & charts" },
          { icon: Sparkles, title: "AI trade ideas", sub: "Signals labelled as estimates, never advice" },
        ].map(({ icon: Icon, title, sub }) => (
          <div key={title} className="rounded-2xl bg-white/10 p-4 backdrop-blur">
            <Icon size={18} className="text-white" />
            <p className="mt-2 text-sm font-bold">{title}</p>
            <p className="text-xs text-white/70">{sub}</p>
          </div>
        ))}
      </div>
      <p className="mt-6 text-[11px] leading-snug text-white/60">
        For education and practice only. No real money, securities, or derivatives are
        traded. Signals and analytics are educational estimates, not financial advice.
      </p>
    </section>
  );
}

export default function Dashboard() {
  const { data: user, isLoading: userLoading } = useUser();
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
      {/* First-time visitors (signed out) get a welcome + sign-up call to action */}
      {!userLoading && !user && <WelcomeHero />}

      {/* Market snapshot */}
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
