"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import type { SearchResult } from "@market-cap/shared";
import { api } from "@/lib/api";
import { displaySymbol } from "@/lib/format";
import { StockAvatar } from "./StockAvatar";

export function SearchBox() {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const { data: results, isFetching } = useQuery({
    queryKey: ["search", debounced],
    queryFn: () => api<SearchResult[]>(`/stocks/search?q=${encodeURIComponent(debounced)}`),
    enabled: debounced.length >= 2,
    refetchInterval: false,
  });

  const go = (symbol: string) => {
    setOpen(false);
    setQuery("");
    router.push(`/stocks/${encodeURIComponent(symbol)}`);
  };

  return (
    <div ref={boxRef} className="relative w-full max-w-xs">
      <div className="flex items-center gap-2 rounded-full border border-line bg-card px-3.5 py-2 shadow-card focus-within:border-accent">
        <Search size={16} className="shrink-0 text-faint" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search stocks…"
          className="w-full bg-transparent text-sm outline-none placeholder:text-faint"
        />
      </div>

      {open && debounced.length >= 2 && (
        <div className="absolute left-0 right-0 top-12 z-50 overflow-hidden rounded-2xl border border-line bg-card shadow-pop">
          {isFetching && !results && (
            <p className="px-4 py-3 text-sm text-soft">Searching…</p>
          )}
          {results && results.length === 0 && (
            <p className="px-4 py-3 text-sm text-soft">No NSE/BSE stocks found</p>
          )}
          {results?.map((r) => (
            <button
              key={r.symbol}
              onClick={() => go(r.symbol)}
              className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition hover:bg-accent-soft"
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
      )}
    </div>
  );
}
