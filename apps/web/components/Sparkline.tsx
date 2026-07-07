"use client";

import { useQuery } from "@tanstack/react-query";
import type { Candle } from "@market-cap/shared";
import { api } from "@/lib/api";

export function Sparkline({
  symbol,
  positive,
  width = 120,
  height = 44,
}: {
  symbol: string;
  positive: boolean;
  width?: number;
  height?: number;
}) {
  const { data } = useQuery({
    queryKey: ["sparkline", symbol],
    queryFn: () => api<Candle[]>(`/stocks/${encodeURIComponent(symbol)}/history?range=1w`),
    refetchInterval: 5 * 60_000,
  });

  if (!data || data.length < 2) {
    return <div style={{ width, height }} className="animate-pulse rounded-lg bg-canvas" />;
  }

  const closes = data.map((c) => c.close);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const span = max - min || 1;
  const pad = 3;
  const points = closes
    .map((v, i) => {
      const x = pad + (i / (closes.length - 1)) * (width - pad * 2);
      const y = pad + (1 - (v - min) / span) * (height - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const color = positive ? "var(--color-gain)" : "var(--color-loss)";

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
