"use client";

import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";
import type { Quote } from "@market-cap/shared";
import { api } from "@/lib/api";
import { useUser } from "@/lib/auth";

export interface WatchlistEntry {
  symbol: string;
  name: string | null;
  addedAt: string;
  quote: Quote | null;
}

export function useWatchlist(enabled: boolean) {
  return useQuery({
    queryKey: ["watchlist"],
    queryFn: () => api<WatchlistEntry[]>("/watchlist"),
    enabled,
  });
}

export function WatchButton({ symbol, name }: { symbol: string; name?: string }) {
  const { data: user } = useUser();
  const { data: watchlist } = useWatchlist(!!user);
  const qc = useQueryClient();
  const router = useRouter();

  const watched = watchlist?.some((w) => w.symbol === symbol) ?? false;

  const toggle = useMutation({
    mutationFn: () =>
      watched
        ? api(`/watchlist/${encodeURIComponent(symbol)}`, { method: "DELETE" })
        : api("/watchlist", { method: "POST", body: JSON.stringify({ symbol, name }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["watchlist"] }),
  });

  return (
    <button
      onClick={() => (user ? toggle.mutate() : router.push("/login"))}
      disabled={toggle.isPending}
      title={watched ? "Remove from watchlist" : "Add to watchlist"}
      className={`flex h-11 w-11 items-center justify-center rounded-full border transition ${
        watched
          ? "border-accent bg-accent-soft text-accent-deep"
          : "border-line bg-card text-faint shadow-card hover:border-accent hover:text-accent-deep"
      }`}
    >
      <Star size={18} fill={watched ? "currentColor" : "none"} />
    </button>
  );
}
