"use client";

import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Star, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { useUser } from "@/lib/auth";
import { useWatchlist } from "@/components/WatchButton";
import { ChangeBadge } from "@/components/ChangeBadge";
import { Sparkline } from "@/components/Sparkline";
import { StockAvatar } from "@/components/StockAvatar";
import { displaySymbol, formatINR } from "@/lib/format";

function EmptyState({ title, body, cta }: { title: string; body: string; cta?: React.ReactNode }) {
  return (
    <div className="rounded-card bg-card p-12 text-center shadow-card">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-accent-deep">
        <Star size={24} />
      </span>
      <h2 className="mt-4 text-xl font-bold">{title}</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-soft">{body}</p>
      {cta}
    </div>
  );
}

export default function WatchlistPage() {
  const { data: user, isLoading: userLoading } = useUser();
  const { data: items, isLoading } = useWatchlist(!!user);
  const qc = useQueryClient();

  const remove = useMutation({
    mutationFn: (symbol: string) =>
      api(`/watchlist/${encodeURIComponent(symbol)}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["watchlist"] }),
  });

  if (userLoading || (user && isLoading)) {
    return <div className="h-96 animate-pulse rounded-card bg-card/70" />;
  }

  if (!user) {
    return (
      <EmptyState
        title="Sign in to build your watchlist"
        body="Star the stocks you care about and see their live prices here."
        cta={
          <Link
            href="/login"
            className="mt-5 inline-block rounded-full bg-gradient-to-r from-accent to-accent-deep px-6 py-2.5 text-sm font-bold text-white shadow-pop"
          >
            Log in
          </Link>
        }
      />
    );
  }

  if (!items || items.length === 0) {
    return (
      <EmptyState
        title="Your watchlist is empty"
        body="Search for a stock and tap the star on its page to start tracking it."
      />
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="px-1 text-2xl font-bold tracking-tight">Watchlist</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => {
          const positive = (item.quote?.changePercent ?? 0) >= 0;
          return (
            <div
              key={item.symbol}
              className="group relative rounded-card bg-card p-4 shadow-card transition hover:-translate-y-0.5 hover:shadow-pop"
            >
              <Link href={`/stocks/${encodeURIComponent(item.symbol)}`} className="flex flex-col gap-3">
                <div className="flex items-center gap-3 pr-8">
                  <StockAvatar symbol={item.symbol} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {item.quote?.name ?? item.name ?? displaySymbol(item.symbol)}
                    </p>
                    <p className="text-xs text-faint">{displaySymbol(item.symbol)}</p>
                  </div>
                </div>
                <div className="flex justify-center">
                  <Sparkline symbol={item.symbol} positive={positive} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-base font-bold">{formatINR(item.quote?.price)}</span>
                  <ChangeBadge value={item.quote?.changePercent} size="sm" />
                </div>
              </Link>
              <button
                onClick={() => remove.mutate(item.symbol)}
                title="Remove"
                className="absolute right-3 top-3 rounded-full p-2 text-faint opacity-0 transition hover:bg-loss-soft hover:text-loss group-hover:opacity-100"
              >
                <Trash2 size={15} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
