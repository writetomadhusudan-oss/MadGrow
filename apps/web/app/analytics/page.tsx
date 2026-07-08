"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { BarChart3 } from "lucide-react";
import { api } from "@/lib/api";
import { useUser } from "@/lib/auth";
import { formatNumber, formatSigned } from "@/lib/format";
import { DisclaimerText } from "@/components/DisclaimerGate";

interface Analytics {
  totalClosedTrades: number;
  winRatio: number | null;
  lossRatio: number | null;
  profitFactor: number | null;
  avgProfit: number | null;
  avgLoss: number | null;
  bestTrade: number;
  worstTrade: number;
  avgHoldingMs: number | null;
  maxDrawdown: number;
  sharpeRatio: number | null;
  lifetimeRealizedPnl: number;
  equityCurve: { date: string; equity: number }[];
  dailyPnl: { date: string; pnl: number }[];
  monthlyPnl: { month: string; pnl: number }[];
}

function holdingLabel(ms: number | null): string {
  if (ms == null) return "—";
  const mins = ms / 60_000;
  if (mins < 60) return `${mins.toFixed(0)}m`;
  const hours = mins / 60;
  if (hours < 48) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "gain" | "loss" }) {
  return (
    <div className="rounded-card bg-card p-4 shadow-card">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-faint">{label}</p>
      <p className={`mt-1 text-lg font-bold ${tone === "gain" ? "text-gain" : tone === "loss" ? "text-loss" : ""}`}>
        {value}
      </p>
    </div>
  );
}

/** Lightweight inline SVG bar chart (positive green, negative red). */
function Bars({ data, labelKey }: { data: { label: string; value: number }[]; labelKey: string }) {
  if (data.length === 0)
    return <p className="py-8 text-center text-sm text-soft">Nothing to plot yet.</p>;
  const max = Math.max(...data.map((d) => Math.abs(d.value)), 1);
  return (
    <div className="flex h-40 items-end gap-1.5 overflow-x-auto pb-6" aria-label={labelKey}>
      {data.slice(-40).map((d) => {
        const h = (Math.abs(d.value) / max) * 100;
        return (
          <div key={d.label} className="group relative flex min-w-4 flex-1 flex-col items-center justify-end">
            <div
              className={`w-full rounded-t ${d.value >= 0 ? "bg-gain/70" : "bg-loss/70"}`}
              style={{ height: `${Math.max(h, 2)}%` }}
              title={`${d.label}: ${formatSigned(d.value)}`}
            />
            <span className="absolute -bottom-5 hidden text-[9px] text-faint group-hover:block">
              {d.label.slice(5)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Equity curve as an inline SVG polyline. */
function EquityCurve({ points }: { points: { date: string; equity: number }[] }) {
  if (points.length < 2)
    return <p className="py-8 text-center text-sm text-soft">Close a few trades to build your equity curve.</p>;
  const w = 600;
  const h = 160;
  const values = points.map((p) => p.equity);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const path = values
    .map((v, i) => `${(i / (values.length - 1)) * w},${h - ((v - min) / span) * (h - 10) - 5}`)
    .join(" ");
  const up = values[values.length - 1] >= values[0];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-40 w-full">
      <polyline
        points={path}
        fill="none"
        stroke={up ? "var(--color-gain)" : "var(--color-loss)"}
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function AnalyticsPage() {
  const { data: user, isLoading: userLoading } = useUser();
  const { data: a } = useQuery({
    queryKey: ["trade-analytics"],
    queryFn: () => api<Analytics>("/trading/analytics"),
    enabled: !!user,
  });

  if (userLoading) return <div className="h-96 animate-pulse rounded-card bg-card/70" />;
  if (!user) {
    return (
      <div className="rounded-card bg-card p-12 text-center shadow-card">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-accent-deep">
          <BarChart3 size={24} />
        </span>
        <h1 className="mt-4 text-xl font-bold">Performance analytics</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-soft">
          Sign in and close a few paper trades to see win ratio, profit factor, drawdown, and
          your equity curve.
        </p>
        <Link href="/login" className="mt-5 inline-block rounded-full bg-gradient-to-r from-accent to-accent-deep px-6 py-2.5 text-sm font-bold text-white shadow-pop">
          Log in
        </Link>
      </div>
    );
  }

  const pct = (v: number | null) => (v == null ? "—" : `${(v * 100).toFixed(0)}%`);

  return (
    <div className="space-y-6">
      <h1 className="px-1 text-2xl font-bold tracking-tight">Performance Analytics</h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Closed trades" value={String(a?.totalClosedTrades ?? 0)} />
        <Stat label="Win ratio" value={pct(a?.winRatio ?? null)} tone={(a?.winRatio ?? 0) >= 0.5 ? "gain" : undefined} />
        <Stat label="Loss ratio" value={pct(a?.lossRatio ?? null)} />
        <Stat label="Profit factor" value={a?.profitFactor != null ? a.profitFactor.toFixed(2) : "—"} tone={(a?.profitFactor ?? 0) >= 1 ? "gain" : "loss"} />
        <Stat label="Sharpe (est.)" value={a?.sharpeRatio != null ? a.sharpeRatio.toFixed(2) : "—"} />
        <Stat label="Avg profit" value={formatSigned(a?.avgProfit ?? null)} tone="gain" />
        <Stat label="Avg loss" value={a?.avgLoss != null ? formatSigned(-a.avgLoss) : "—"} tone="loss" />
        <Stat label="Best trade" value={formatSigned(a?.bestTrade ?? 0)} tone="gain" />
        <Stat label="Worst trade" value={formatSigned(a?.worstTrade ?? 0)} tone="loss" />
        <Stat label="Max drawdown" value={formatNumber(a?.maxDrawdown ?? 0)} tone="loss" />
        <Stat label="Avg holding" value={holdingLabel(a?.avgHoldingMs ?? null)} />
        <Stat label="Lifetime realized" value={formatSigned(a?.lifetimeRealizedPnl ?? 0)} tone={(a?.lifetimeRealizedPnl ?? 0) >= 0 ? "gain" : "loss"} />
      </div>

      <section className="rounded-card bg-card p-5 shadow-card">
        <h2 className="mb-2 text-lg font-bold">Equity Curve (realized)</h2>
        <EquityCurve points={a?.equityCurve ?? []} />
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-card bg-card p-5 shadow-card">
          <h2 className="mb-2 text-lg font-bold">Daily P&L</h2>
          <Bars data={(a?.dailyPnl ?? []).map((d) => ({ label: d.date, value: d.pnl }))} labelKey="daily" />
        </section>
        <section className="rounded-card bg-card p-5 shadow-card">
          <h2 className="mb-2 text-lg font-bold">Monthly P&L</h2>
          <Bars data={(a?.monthlyPnl ?? []).map((d) => ({ label: d.month, value: d.pnl }))} labelKey="monthly" />
        </section>
      </div>

      <DisclaimerText className="px-2 text-center" />
    </div>
  );
}
