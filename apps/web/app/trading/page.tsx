"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Coins, ShieldCheck, X } from "lucide-react";
import { api } from "@/lib/api";
import { useUser } from "@/lib/auth";
import {
  formatMC,
  type OrderRow,
  type PositionRow,
  type TradeRow,
  type WalletSummary,
} from "@/lib/trading";
import { displaySymbol, formatNumber, formatPercent, formatSigned } from "@/lib/format";
import { StockAvatar } from "@/components/StockAvatar";
import { DisclaimerText } from "@/components/DisclaimerGate";

function Card({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "gain" | "loss" }) {
  return (
    <div className="rounded-card bg-card p-4 shadow-card">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-faint">{label}</p>
      <p className={`mt-1 truncate text-lg font-bold ${tone === "gain" ? "text-gain" : tone === "loss" ? "text-loss" : ""}`}>
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-soft">{sub}</p>}
    </div>
  );
}

function ProtectionEditor({ position, onDone }: { position: PositionRow; onDone: () => void }) {
  const [stopLoss, setStopLoss] = useState(position.stopLoss ? String(position.stopLoss) : "");
  const [target, setTarget] = useState(position.target ? String(position.target) : "");
  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: () =>
      api("/trading/positions/protection", {
        method: "POST",
        body: JSON.stringify({
          symbol: position.symbol,
          stopLoss: stopLoss ? Number(stopLoss) : null,
          target: target ? Number(target) : null,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wallet"] });
      onDone();
    },
  });
  const cls = "w-24 rounded-xl border border-line bg-canvas/50 px-2.5 py-1.5 text-xs outline-none focus:border-accent";
  return (
    <div className="flex items-center gap-2">
      <input placeholder="Stop loss" type="number" step="any" value={stopLoss} onChange={(e) => setStopLoss(e.target.value)} className={cls} />
      <input placeholder="Target" type="number" step="any" value={target} onChange={(e) => setTarget(e.target.value)} className={cls} />
      <button onClick={() => save.mutate()} disabled={save.isPending} className="rounded-full bg-ink px-3 py-1.5 text-xs font-bold text-white">
        Save
      </button>
      <button onClick={onDone} className="rounded-full p-1 text-faint hover:bg-canvas"><X size={14} /></button>
    </div>
  );
}

export default function TradingPage() {
  const { data: user, isLoading: userLoading } = useUser();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<string | null>(null);

  const { data: wallet } = useQuery({
    queryKey: ["wallet"],
    queryFn: () => api<WalletSummary>("/trading/wallet"),
    enabled: !!user,
  });
  const { data: orders } = useQuery({
    queryKey: ["orders"],
    queryFn: () => api<OrderRow[]>("/trading/orders"),
    enabled: !!user,
  });
  const { data: trades } = useQuery({
    queryKey: ["paper-trades"],
    queryFn: () => api<TradeRow[]>("/trading/trades"),
    enabled: !!user,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["wallet"] });
    qc.invalidateQueries({ queryKey: ["orders"] });
    qc.invalidateQueries({ queryKey: ["paper-trades"] });
    qc.invalidateQueries({ queryKey: ["alerts"] });
  };
  const cancelOrder = useMutation({
    mutationFn: (id: string) => api(`/trading/orders/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });
  const closePosition = useMutation({
    mutationFn: (symbol: string) =>
      api(`/trading/positions/${encodeURIComponent(symbol)}/close`, { method: "POST" }),
    onSuccess: invalidate,
  });

  if (userLoading) return <div className="h-96 animate-pulse rounded-card bg-card/70" />;
  if (!user) {
    return (
      <div className="rounded-card bg-card p-12 text-center shadow-card">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-accent-deep">
          <Coins size={24} />
        </span>
        <h1 className="mt-4 text-xl font-bold">Practice trading with 10 lakh MadCoins</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-soft">
          Sign in to get a virtual wallet, place simulated orders at live-ish prices, and learn
          without risking a rupee.
        </p>
        <Link href="/login" className="mt-5 inline-block rounded-full bg-gradient-to-r from-accent to-accent-deep px-6 py-2.5 text-sm font-bold text-white shadow-pop">
          Log in
        </Link>
      </div>
    );
  }

  const openOrders = orders?.filter((o) => o.status === "OPEN") ?? [];
  const tone = (v: number | null | undefined) => (v == null ? undefined : v >= 0 ? ("gain" as const) : ("loss" as const));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between px-1">
        <h1 className="text-2xl font-bold tracking-tight">Paper Trading</h1>
        <span className="flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1.5 text-xs font-bold text-accent-deep">
          <ShieldCheck size={14} /> Virtual MadCoins only
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Card label="Available" value={formatMC(wallet?.available)} />
        <Card label="Used margin" value={formatMC(wallet?.usedMargin)} sub="blocked by shorts" />
        <Card label="Unrealized P&L" value={formatSigned(wallet?.unrealizedPnl)} tone={tone(wallet?.unrealizedPnl)} />
        <Card label="Realized P&L" value={formatSigned(wallet?.realizedPnl)} sub="lifetime" tone={tone(wallet?.realizedPnl)} />
        <Card label="Today's P&L" value={formatSigned(wallet?.todayPnl)} tone={tone(wallet?.todayPnl)} />
        <Card label="Equity" value={formatMC(wallet?.equity)} sub={`start ${formatMC(wallet?.startingBalance)}`} tone={tone(wallet?.lifetimePnl)} />
      </div>

      <section className="rounded-card bg-card p-5 shadow-card">
        <h2 className="mb-3 text-lg font-bold">Open Positions</h2>
        {!wallet || wallet.positions.length === 0 ? (
          <p className="py-6 text-center text-sm text-soft">
            No open positions — find a stock and hit Buy or Sell to practice.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-faint">
                  <th className="pb-2.5 font-semibold">Instrument</th>
                  <th className="pb-2.5 text-right font-semibold">Qty</th>
                  <th className="pb-2.5 text-right font-semibold">Avg</th>
                  <th className="pb-2.5 text-right font-semibold">LTP</th>
                  <th className="pb-2.5 text-right font-semibold">P&L</th>
                  <th className="pb-2.5 text-right font-semibold">SL / Target</th>
                  <th className="pb-2.5 text-right font-semibold"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {wallet.positions.map((p) => (
                  <tr key={p.symbol}>
                    <td className="py-3">
                      <Link href={`/stocks/${encodeURIComponent(p.symbol)}`} className="flex items-center gap-2.5">
                        <StockAvatar symbol={p.symbol} size={30} />
                        <span>
                          <span className="block font-semibold">{displaySymbol(p.symbol)}</span>
                          <span className={`text-[11px] font-bold ${p.quantity > 0 ? "text-gain" : "text-loss"}`}>
                            {p.quantity > 0 ? "LONG" : "SHORT"}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="py-3 text-right font-medium">{formatNumber(Math.abs(p.quantity))}</td>
                    <td className="py-3 text-right">{formatNumber(p.avgPrice)}</td>
                    <td className="py-3 text-right">
                      {formatNumber(p.lastPrice)}
                      <span className="block text-[11px] text-faint">{formatPercent(p.dayChangePercent)}</span>
                    </td>
                    <td className={`py-3 text-right font-semibold ${(p.unrealizedPnl ?? 0) >= 0 ? "text-gain" : "text-loss"}`}>
                      {formatSigned(p.unrealizedPnl)}
                    </td>
                    <td className="py-3 text-right">
                      {editing === p.symbol ? (
                        <ProtectionEditor position={p} onDone={() => setEditing(null)} />
                      ) : (
                        <button onClick={() => setEditing(p.symbol)} className="rounded-full border border-line px-3 py-1 text-xs font-semibold text-soft hover:border-accent hover:text-accent-deep">
                          {p.stopLoss || p.target
                            ? `${p.stopLoss ? `SL ${p.stopLoss}` : ""}${p.stopLoss && p.target ? " · " : ""}${p.target ? `TG ${p.target}` : ""}`
                            : "Set"}
                        </button>
                      )}
                    </td>
                    <td className="py-3 pl-2 text-right">
                      <button
                        onClick={() => closePosition.mutate(p.symbol)}
                        disabled={closePosition.isPending}
                        className="rounded-full bg-ink px-3 py-1 text-xs font-bold text-white transition hover:opacity-85"
                      >
                        Close
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-card bg-card p-5 shadow-card">
        <h2 className="mb-3 text-lg font-bold">Open Orders</h2>
        {openOrders.length === 0 ? (
          <p className="py-4 text-center text-sm text-soft">No resting orders.</p>
        ) : (
          <ul className="divide-y divide-line">
            {openOrders.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <span className={`w-12 rounded-full py-1 text-center text-[11px] font-bold ${o.side === "BUY" ? "bg-gain-soft text-gain" : "bg-loss-soft text-loss"}`}>
                  {o.side}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">
                    {displaySymbol(o.symbol)} · {o.type}
                  </span>
                  <span className="text-xs text-faint">
                    {formatNumber(o.quantity)} qty
                    {o.limitPrice ? ` · limit ${o.limitPrice}` : ""}
                    {o.stopPrice ? ` · stop ${o.stopPrice}` : ""}
                  </span>
                </span>
                <button
                  onClick={() => cancelOrder.mutate(o.id)}
                  className="rounded-full border border-line px-3 py-1 text-xs font-semibold text-loss hover:bg-loss-soft"
                >
                  Cancel
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-card bg-card p-5 shadow-card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">Trade History</h2>
          <Link href="/analytics" className="text-sm font-medium text-accent-deep hover:underline">
            Performance analytics →
          </Link>
        </div>
        {!trades || trades.length === 0 ? (
          <p className="py-4 text-center text-sm text-soft">No trades yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {trades.slice(0, 30).map((t) => (
              <li key={t.id} className="flex items-center gap-3 py-2.5 text-sm">
                <span className={`w-12 rounded-full py-1 text-center text-[11px] font-bold ${t.side === "BUY" ? "bg-gain-soft text-gain" : "bg-loss-soft text-loss"}`}>
                  {t.side}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="font-semibold">{displaySymbol(t.symbol)}</span>
                  <span className="ml-2 text-xs text-faint">
                    {new Date(t.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </span>
                <span>{formatNumber(t.quantity)} × {formatNumber(t.price)}</span>
                <span className="w-20 text-right text-xs text-faint">fee {formatNumber(t.fees)}</span>
                <span className={`w-24 text-right font-semibold ${t.pnl == null ? "text-faint" : t.pnl >= 0 ? "text-gain" : "text-loss"}`}>
                  {t.pnl == null ? "—" : formatSigned(t.pnl)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <DisclaimerText className="px-2 text-center" />
    </div>
  );
}
