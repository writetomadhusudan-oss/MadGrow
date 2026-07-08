"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import type { Candle, ChartRange, NewsItem, OrderSide, Quote } from "@market-cap/shared";
import { api } from "@/lib/api";
import {
  displaySymbol,
  formatINR,
  formatIndianCompact,
  formatNumber,
  formatSigned,
} from "@/lib/format";
import { ChangeBadge } from "@/components/ChangeBadge";
import { NewsList } from "@/components/NewsList";
import { PriceChart } from "@/components/PriceChart";
import { StockAvatar } from "@/components/StockAvatar";
import { WatchButton } from "@/components/WatchButton";
import { TradeTicket } from "@/components/TradeTicket";
import {
  SignalsPanel,
  type SignalMarkerData,
  type StrategyCardData,
} from "@/components/SignalsPanel";

const RANGES: { value: ChartRange; label: string }[] = [
  { value: "1d", label: "1D" },
  { value: "1w", label: "1W" },
  { value: "1mo", label: "1M" },
  { value: "6mo", label: "6M" },
  { value: "1y", label: "1Y" },
  { value: "5y", label: "5Y" },
];

interface SignalsResponse {
  strategies: StrategyCardData[];
  markers: SignalMarkerData[];
}

const STRATEGY_PREF_KEY = "madgrow.strategies.disabled";
const MARKERS_PREF_KEY = "madgrow.markers.enabled";

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
  const [ticket, setTicket] = useState<OrderSide | null>(null);
  const [showSignals, setShowSignals] = useState(false);
  const [disabledStrategies, setDisabledStrategies] = useState<Set<string>>(new Set());
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  useEffect(() => {
    try {
      setShowSignals(localStorage.getItem(MARKERS_PREF_KEY) === "1");
      setDisabledStrategies(
        new Set(JSON.parse(localStorage.getItem(STRATEGY_PREF_KEY) ?? "[]") as string[])
      );
    } catch {
      // first visit
    }
  }, []);

  const toggleSignals = (on: boolean) => {
    setShowSignals(on);
    localStorage.setItem(MARKERS_PREF_KEY, on ? "1" : "0");
  };
  const toggleStrategy = (id: string) => {
    setDisabledStrategies((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      localStorage.setItem(STRATEGY_PREF_KEY, JSON.stringify([...next]));
      return next;
    });
  };

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
  const { data: signals } = useQuery({
    queryKey: ["signals", symbol, range],
    queryFn: () =>
      api<SignalsResponse>(`/signals/${encodeURIComponent(symbol)}?range=${range}`),
    enabled: showSignals,
    refetchInterval: 5 * 60_000,
  });

  const enabledStrategies = useMemo(
    () =>
      new Set(
        (signals?.strategies ?? [])
          .map((s) => s.id)
          .filter((id) => !disabledStrategies.has(id))
      ),
    [signals, disabledStrategies]
  );
  const activeMarkers = useMemo(
    () =>
      showSignals
        ? (signals?.markers ?? []).filter((m) => enabledStrategies.has(m.strategyId))
        : [],
    [showSignals, signals, enabledStrategies]
  );

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

        {/* Range tabs + AI toggle */}
        <div className="mt-6 flex flex-wrap items-center gap-2">
          {RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => {
                setRange(r.value);
                setSelectedTime(null);
              }}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                range === r.value
                  ? "bg-ink text-white shadow-card"
                  : "border border-line bg-card text-soft hover:border-accent hover:text-accent-deep"
              }`}
            >
              {r.label}
            </button>
          ))}
          <button
            onClick={() => toggleSignals(!showSignals)}
            className={`ml-auto flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold transition ${
              showSignals
                ? "bg-gradient-to-r from-accent to-accent-deep text-white shadow-pop"
                : "border border-line bg-card text-soft hover:border-accent hover:text-accent-deep"
            }`}
            title="Toggle AI entry/exit markers"
          >
            <Sparkles size={13} /> AI Signals
          </button>
        </div>

        {/* Chart with 🍏/🍎 markers */}
        <div className="mt-4">
          {candles ? (
            candles.length > 0 ? (
              <PriceChart
                candles={candles}
                range={range}
                markers={activeMarkers}
                onSelectTime={setSelectedTime}
              />
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

      {/* Paper trade with MadCoins */}
      <section className="flex gap-3">
        <button
          onClick={() => setTicket("BUY")}
          className="flex-1 rounded-full bg-gradient-to-r from-accent to-accent-deep py-3 text-center text-sm font-bold text-white shadow-pop transition hover:opacity-90"
        >
          Buy (paper)
        </button>
        <button
          onClick={() => setTicket("SELL")}
          className="flex-1 rounded-full border border-line bg-card py-3 text-center text-sm font-bold text-ink shadow-card transition hover:border-accent"
        >
          Sell / Short (paper)
        </button>
      </section>
      {ticket && (
        <TradeTicket
          symbol={symbol}
          name={quote?.name}
          lastPrice={quote?.price ?? null}
          side={ticket}
          onClose={() => setTicket(null)}
        />
      )}

      {/* AI strategy panel */}
      {showSignals && (
        <section className="rounded-card bg-card p-6 shadow-card">
          <h2 className="mb-4 text-lg font-bold">AI Trade Assistant</h2>
          {signals ? (
            <SignalsPanel
              strategies={signals.strategies}
              markers={signals.markers}
              enabled={enabledStrategies}
              onToggle={toggleStrategy}
              selectedTime={selectedTime}
            />
          ) : (
            <div className="h-48 animate-pulse rounded-2xl bg-canvas" />
          )}
        </section>
      )}

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
