"use client";

import { useQuery } from "@tanstack/react-query";
import type { NewsItem } from "@market-cap/shared";
import { api } from "@/lib/api";
import { NewsList } from "@/components/NewsList";

export default function NewsPage() {
  const { data: items } = useQuery({
    queryKey: ["market-news"],
    queryFn: () => api<NewsItem[]>("/market/news"),
    refetchInterval: 10 * 60_000,
  });

  return (
    <div className="space-y-4">
      <h1 className="px-1 text-2xl font-bold tracking-tight">Market News</h1>
      <div className="rounded-card bg-card p-5 shadow-card">
        {items ? (
          <NewsList items={items} />
        ) : (
          <div className="h-96 animate-pulse rounded-2xl bg-canvas" />
        )}
      </div>
    </div>
  );
}
