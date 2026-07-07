"use client";

import Link from "next/link";
import type { Quote } from "@market-cap/shared";
import { displaySymbol, formatINR } from "@/lib/format";
import { ChangeBadge } from "./ChangeBadge";
import { Sparkline } from "./Sparkline";
import { StockAvatar } from "./StockAvatar";

export function StockCard({ quote }: { quote: Quote }) {
  const positive = quote.changePercent >= 0;
  return (
    <Link
      href={`/stocks/${encodeURIComponent(quote.symbol)}`}
      className="group flex flex-col gap-3 rounded-card bg-card p-4 shadow-card transition hover:-translate-y-0.5 hover:shadow-pop"
    >
      <div className="flex items-center gap-3">
        <StockAvatar symbol={quote.symbol} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{quote.name}</p>
          <p className="text-xs text-faint">{displaySymbol(quote.symbol)}</p>
        </div>
      </div>
      <div className="flex justify-center">
        <Sparkline symbol={quote.symbol} positive={positive} />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-base font-bold">{formatINR(quote.price)}</span>
        <ChangeBadge value={quote.changePercent} size="sm" />
      </div>
    </Link>
  );
}
