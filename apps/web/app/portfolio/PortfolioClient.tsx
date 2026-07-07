"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Briefcase, Plus, Trash2, X } from "lucide-react";
import type { PortfolioSummary, TransactionType } from "@market-cap/shared";
import { api } from "@/lib/api";
import { useUser } from "@/lib/auth";
import { ChangeBadge } from "@/components/ChangeBadge";
import { StockAvatar } from "@/components/StockAvatar";
import {
  displaySymbol,
  formatINR,
  formatNumber,
  formatPercent,
  formatSigned,
} from "@/lib/format";

interface TransactionRow {
  id: string;
  symbol: string;
  name: string | null;
  type: TransactionType;
  quantity: number;
  price: number;
  date: string;
}

function SummaryCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "gain" | "loss";
}) {
  return (
    <div className="rounded-card bg-card p-5 shadow-card">
      <p className="text-xs font-semibold uppercase tracking-wider text-faint">{label}</p>
      <p
        className={`mt-1.5 text-xl font-bold ${
          tone === "gain" ? "text-gain" : tone === "loss" ? "text-loss" : ""
        }`}
      >
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-soft">{sub}</p>}
    </div>
  );
}

function TransactionForm({
  initialSymbol,
  initialType,
  onClose,
}: {
  initialSymbol: string;
  initialType: TransactionType;
  onClose: () => void;
}) {
  const [symbol, setSymbol] = useState(initialSymbol);
  const [type, setType] = useState<TransactionType>(initialType);
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: () =>
      api("/portfolio/transactions", {
        method: "POST",
        body: JSON.stringify({
          symbol: symbol.trim().toUpperCase(),
          type,
          quantity: Number(quantity),
          price: Number(price),
          date,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portfolio"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      onClose();
    },
  });

  const inputCls =
    "w-full rounded-2xl border border-line bg-canvas/50 px-4 py-2.5 text-sm outline-none focus:border-accent";

  return (
    <div className="rounded-card bg-card p-6 shadow-pop">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold">Add transaction</h2>
        <button onClick={onClose} className="rounded-full p-1.5 text-faint hover:bg-canvas">
          <X size={18} />
        </button>
      </div>

      <form
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <div className="flex gap-2 sm:col-span-2">
          {(["BUY", "SELL"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`flex-1 rounded-full py-2.5 text-sm font-bold transition ${
                type === t
                  ? t === "BUY"
                    ? "bg-gain text-white"
                    : "bg-loss text-white"
                  : "border border-line bg-card text-soft"
              }`}
            >
              {t === "BUY" ? "Buy" : "Sell"}
            </button>
          ))}
        </div>

        <label className="block sm:col-span-2">
          <span className="mb-1 block text-xs font-semibold text-soft">
            Symbol (Yahoo format, e.g. RELIANCE.NS)
          </span>
          <input
            required
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            placeholder="RELIANCE.NS"
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-soft">Quantity</span>
          <input
            required
            type="number"
            min="0.0001"
            step="any"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="10"
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-soft">Price per share (₹)</span>
          <input
            required
            type="number"
            min="0.01"
            step="any"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="1300.50"
            className={inputCls}
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-xs font-semibold text-soft">Date</span>
          <input
            required
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inputCls}
          />
        </label>

        {mutation.isError && (
          <p className="rounded-2xl bg-loss-soft px-4 py-2.5 text-sm font-medium text-loss sm:col-span-2">
            {(mutation.error as Error).message}
          </p>
        )}

        <button
          type="submit"
          disabled={mutation.isPending}
          className="rounded-full bg-gradient-to-r from-accent to-accent-deep py-3 text-sm font-bold text-white shadow-pop transition hover:opacity-90 disabled:opacity-60 sm:col-span-2"
        >
          {mutation.isPending ? "Saving…" : `Record ${type === "BUY" ? "buy" : "sell"}`}
        </button>
      </form>
    </div>
  );
}

export function PortfolioClient() {
  const params = useSearchParams();
  const { data: user, isLoading: userLoading } = useUser();
  const [formOpen, setFormOpen] = useState(!!params.get("symbol"));
  const qc = useQueryClient();

  const { data: portfolio } = useQuery({
    queryKey: ["portfolio"],
    queryFn: () => api<PortfolioSummary>("/portfolio"),
    enabled: !!user,
  });
  const { data: transactions } = useQuery({
    queryKey: ["transactions"],
    queryFn: () => api<TransactionRow[]>("/portfolio/transactions"),
    enabled: !!user,
  });

  const removeTx = useMutation({
    mutationFn: (id: string) => api(`/portfolio/transactions/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portfolio"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
    },
  });

  if (userLoading) return <div className="h-96 animate-pulse rounded-card bg-card/70" />;

  if (!user) {
    return (
      <div className="rounded-card bg-card p-12 text-center shadow-card">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-accent-deep">
          <Briefcase size={24} />
        </span>
        <h1 className="mt-4 text-xl font-bold">Sign in to track your portfolio</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-soft">
          Record your buys and sells, and MadGrow will compute your holdings and P&L
          with live-ish prices.
        </p>
        <Link
          href="/login"
          className="mt-5 inline-block rounded-full bg-gradient-to-r from-accent to-accent-deep px-6 py-2.5 text-sm font-bold text-white shadow-pop"
        >
          Log in
        </Link>
      </div>
    );
  }

  const holdings = portfolio?.holdings.filter((h) => h.quantity > 0) ?? [];
  const pnlTone = (v: number | null | undefined) =>
    v == null ? undefined : v >= 0 ? ("gain" as const) : ("loss" as const);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between px-1">
        <h1 className="text-2xl font-bold tracking-tight">Portfolio</h1>
        <button
          onClick={() => setFormOpen((v) => !v)}
          className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-accent to-accent-deep px-4 py-2 text-sm font-bold text-white shadow-pop transition hover:opacity-90"
        >
          <Plus size={16} /> Transaction
        </button>
      </div>

      {formOpen && (
        <TransactionForm
          initialSymbol={params.get("symbol") ?? ""}
          initialType={(params.get("action") as TransactionType) === "SELL" ? "SELL" : "BUY"}
          onClose={() => setFormOpen(false)}
        />
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SummaryCard label="Current value" value={formatINR(portfolio?.totalValue ?? 0)} />
        <SummaryCard label="Invested" value={formatINR(portfolio?.totalInvested ?? 0)} />
        <SummaryCard
          label="Unrealized P&L"
          value={formatSigned(portfolio?.totalUnrealizedPnl ?? 0)}
          sub={
            portfolio?.totalUnrealizedPnlPercent != null
              ? formatPercent(portfolio.totalUnrealizedPnlPercent)
              : undefined
          }
          tone={pnlTone(portfolio?.totalUnrealizedPnl)}
        />
        <SummaryCard
          label="Day change"
          value={formatSigned(portfolio?.totalDayChange ?? 0)}
          sub={`Realized: ${formatSigned(portfolio?.totalRealizedPnl ?? 0)}`}
          tone={pnlTone(portfolio?.totalDayChange)}
        />
      </div>

      {/* Holdings */}
      <section className="rounded-card bg-card p-5 shadow-card">
        <h2 className="mb-3 text-lg font-bold">Holdings</h2>
        {holdings.length === 0 ? (
          <p className="py-8 text-center text-sm text-soft">
            No holdings yet — record your first buy with the Transaction button.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-faint">
                  <th className="pb-2.5 font-semibold">Stock</th>
                  <th className="pb-2.5 text-right font-semibold">Qty</th>
                  <th className="pb-2.5 text-right font-semibold">Avg cost</th>
                  <th className="pb-2.5 text-right font-semibold">Price</th>
                  <th className="pb-2.5 text-right font-semibold">Value</th>
                  <th className="pb-2.5 text-right font-semibold">P&L</th>
                  <th className="pb-2.5 text-right font-semibold">Day</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {holdings.map((h) => (
                  <tr key={h.symbol} className="group">
                    <td className="py-3">
                      <Link
                        href={`/stocks/${encodeURIComponent(h.symbol)}`}
                        className="flex items-center gap-2.5"
                      >
                        <StockAvatar symbol={h.symbol} size={32} />
                        <span>
                          <span className="block max-w-[180px] truncate font-semibold group-hover:text-accent-deep">
                            {h.name}
                          </span>
                          <span className="text-xs text-faint">{displaySymbol(h.symbol)}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="py-3 text-right font-medium">{formatNumber(h.quantity)}</td>
                    <td className="py-3 text-right">{formatNumber(h.avgCost)}</td>
                    <td className="py-3 text-right">{formatNumber(h.currentPrice)}</td>
                    <td className="py-3 text-right font-semibold">{formatINR(h.currentValue)}</td>
                    <td
                      className={`py-3 text-right font-semibold ${
                        (h.unrealizedPnl ?? 0) >= 0 ? "text-gain" : "text-loss"
                      }`}
                    >
                      {formatSigned(h.unrealizedPnl)}
                      <span className="block text-xs font-normal">
                        {formatPercent(h.unrealizedPnlPercent)}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <ChangeBadge value={h.dayChangePercent} size="sm" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Transactions */}
      <section className="rounded-card bg-card p-5 shadow-card">
        <h2 className="mb-3 text-lg font-bold">Transactions</h2>
        {!transactions || transactions.length === 0 ? (
          <p className="py-6 text-center text-sm text-soft">No transactions yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {transactions.map((tx) => (
              <li key={tx.id} className="flex items-center gap-3 py-2.5">
                <span
                  className={`w-12 rounded-full py-1 text-center text-[11px] font-bold ${
                    tx.type === "BUY" ? "bg-gain-soft text-gain" : "bg-loss-soft text-loss"
                  }`}
                >
                  {tx.type}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">
                    {displaySymbol(tx.symbol)}
                  </span>
                  <span className="text-xs text-faint">
                    {new Date(tx.date).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </span>
                <span className="text-sm">
                  {formatNumber(tx.quantity)} × {formatINR(tx.price)}
                </span>
                <button
                  onClick={() => removeTx.mutate(tx.id)}
                  title="Delete transaction"
                  className="rounded-full p-2 text-faint transition hover:bg-loss-soft hover:text-loss"
                >
                  <Trash2 size={15} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
