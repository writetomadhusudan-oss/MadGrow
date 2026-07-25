"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, X } from "lucide-react";
import type { Quote, SearchResult } from "@market-cap/shared";
import { api } from "@/lib/api";
import { displaySymbol } from "@/lib/format";
import { StockAvatar } from "./StockAvatar";
import { TradeTicket } from "./TradeTicket";

/**
 * Start a paper trade from anywhere (e.g. the Portfolio page): search for a
 * stock, pick it, and the trade ticket opens for that symbol.
 */
export function NewTradeModal({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [picked, setPicked] = useState<{ symbol: string; name?: string } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  const { data: results, isFetching } = useQuery({
    queryKey: ["search", debounced],
    queryFn: () => api<SearchResult[]>(`/stocks/search?q=${encodeURIComponent(debounced)}`),
    enabled: debounced.length >= 2,
    refetchInterval: false,
  });

  const { data: quote } = useQuery({
    queryKey: ["quote", picked?.symbol],
    queryFn: () => api<Quote>(`/stocks/${encodeURIComponent(picked!.symbol)}`),
    enabled: !!picked,
  });

  // Once a stock is chosen, hand off to the trade ticket.
  if (picked) {
    return (
      <TradeTicket
        symbol={picked.symbol}
        name={quote?.name ?? picked.name}
        lastPrice={quote?.price ?? null}
        side="BUY"
        onClose={onClose}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-ink/40 p-4 pt-16 backdrop-blur-sm sm:pt-24">
      <div className="w-full max-w-md rounded-card bg-card p-5 shadow-pop">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">New paper trade</h2>
          <button onClick={onClose} className="rounded-full p-1.5 text-faint hover:bg-canvas">
            <X size={18} />
          </button>
        </div>

        <div className="flex items-center gap-2 rounded-full border border-line bg-canvas/50 px-3.5 py-2.5 focus-within:border-accent">
          <Search size={16} className="shrink-0 text-faint" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a stock to trade…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-faint"
          />
        </div>

        <div className="mt-2 max-h-72 overflow-y-auto">
          {debounced.length < 2 && (
            <p className="px-1 py-4 text-sm text-soft">
              Type at least 2 letters to search NSE &amp; BSE stocks.
            </p>
          )}
          {isFetching && !results && <p className="px-1 py-3 text-sm text-soft">Searching…</p>}
          {results && results.length === 0 && (
            <p className="px-1 py-3 text-sm text-soft">No matches found.</p>
          )}
          {results?.map((r) => (
            <button
              key={r.symbol}
              onClick={() => setPicked({ symbol: r.symbol, name: r.name })}
              className="flex w-full items-center gap-3 rounded-2xl px-2.5 py-2.5 text-left transition hover:bg-accent-soft"
            >
              <StockAvatar symbol={r.symbol} size={32} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{r.name}</span>
                <span className="text-xs text-faint">
                  {displaySymbol(r.symbol)} · {r.exchange}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
