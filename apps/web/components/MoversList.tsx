"use client";

import Link from "next/link";
import type { Quote } from "@market-cap/shared";
import { displaySymbol, formatINR } from "@/lib/format";
import { ChangeBadge } from "./ChangeBadge";
import { StockAvatar } from "./StockAvatar";

export function MoversList({ quotes }: { quotes: Quote[] }) {
  return (
    <ul className="divide-y divide-line">
      {quotes.map((q) => (
        <li key={q.symbol}>
          <Link
            href={`/stocks/${encodeURIComponent(q.symbol)}`}
            className="flex items-center gap-3 px-1 py-2.5 transition hover:bg-canvas/60"
          >
            <StockAvatar symbol={q.symbol} size={34} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{q.name}</span>
              <span className="text-xs text-faint">{displaySymbol(q.symbol)}</span>
            </span>
            <span className="text-sm font-semibold">{formatINR(q.price)}</span>
            <ChangeBadge value={q.changePercent} size="sm" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
