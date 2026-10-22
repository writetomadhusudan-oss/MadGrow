"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Radar, ShieldAlert, ShieldCheck, Timer, XCircle } from "lucide-react";
import { api } from "@/lib/api";
import { useUser } from "@/lib/auth";
import { formatMC } from "@/lib/trading";
import { displaySymbol } from "@/lib/format";
import { DisclaimerText } from "@/components/DisclaimerGate";

type Mode = "orb" | "daily";
type StopMode = "or-mid" | "or-low" | "pct" | "atr";

interface ScanHit {
  symbol: string;
  setups: string[];
  reasons?: string[];
  entry: number;
  time?: string;
  rangeHigh?: number;
  rangeLow?: number;
}
interface ScanResult {
  mode: Mode;
  scannedAt: string;
  universe: number;
  hits: ScanHit[];
}
interface Plan {
  symbol: string;
  name: string;
  orb: { rangeHigh: number; rangeLow: number; rangeMid: number; at: string } | null;
  plan: { entry: number; stop: number; target: number; riskPerShare: number; rewardRisk: number };
  size: { quantity: number; positionValue: number; lossAtStop: number; cappedBy: string };
  risk: { pass: boolean; reasons: string[] };
  simulation: {
    targetFirst: number;
    stopFirst: number;
    neither: number;
    expectedR: number;
    sessionsUsed: number;
    fromTime: string;
    flatBy: string;
    caveat: string;
  } | null;
}

const istTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false });
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const card = "rounded-card bg-card p-5 shadow-card";

function Stat({ label, value, tone }: { label: string; value: string; tone?: "gain" | "loss" }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-faint">{label}</p>
      <p className={`mt-0.5 text-base font-bold ${tone === "gain" ? "text-gain" : tone === "loss" ? "text-loss" : ""}`}>{value}</p>
    </div>
  );
}

export default function DayTraderPage() {
  const { data: user, isLoading } = useUser();
  const qc = useQueryClient();
  const [mode, setMode] = useState<Mode>("orb");
  const [symbol, setSymbol] = useState("");
  const [stopMode, setStopMode] = useState<StopMode>("or-mid");
  const [stopValue, setStopValue] = useState("1");
  const [targetR, setTargetR] = useState("2");

  const scan = useQuery({
    queryKey: ["daytrader-scan", mode],
    queryFn: () => api<ScanResult>(`/daytrader/scan?mode=${mode}`),
    staleTime: 2 * 60_000,
  });

  const plan = useMutation({
    mutationFn: (sym: string) =>
      api<Plan>("/daytrader/plan", {
        method: "POST",
        body: JSON.stringify({
          symbol: sym,
          stopMode,
          targetR: Number(targetR) || 2,
          ...(stopMode === "pct" || stopMode === "atr" ? { stopValue: Number(stopValue) || 1 } : {}),
        }),
      }),
  });

  const order = useMutation({
    mutationFn: (p: Plan) =>
      api("/daytrader/paper-order", {
        method: "POST",
        body: JSON.stringify({ symbol: p.symbol, quantity: p.size.quantity, stop: p.plan.stop, target: p.plan.target }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wallet"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  const run = (sym: string) => {
    setSymbol(sym);
    order.reset();
    plan.mutate(sym);
  };

  if (isLoading) return <div className="h-96 animate-pulse rounded-card bg-card/70" />;
  if (!user) {
    return (
      <div className="rounded-card bg-card p-12 text-center shadow-card">
        <h1 className="text-xl font-bold">Day Trader practice</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-soft">Sign in to scan NIFTY 100 and practice intraday trades with MadCoins.</p>
        <Link href="/login" className="mt-5 inline-block rounded-full bg-gradient-to-r from-accent to-accent-deep px-6 py-2.5 text-sm font-bold text-white shadow-pop">
          Log in
        </Link>
      </div>
    );
  }

  const p = plan.data;
  const inputCls = "rounded-xl border border-line bg-canvas/50 px-3 py-2 text-sm outline-none focus:border-accent";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between px-1">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Day Trader</h1>
          <p className="text-sm text-soft">Scan, plan, risk-check and paper-trade an intraday setup</p>
        </div>
        <span className="hidden items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1.5 text-xs font-bold text-accent-deep sm:flex">
          <ShieldCheck size={14} /> Virtual MadCoins only
        </span>
      </div>

      <section className={card}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-lg font-bold"><Radar size={18} /> Scanner</h2>
          <div className="flex rounded-full bg-canvas p-1 text-xs font-bold">
            {(["orb", "daily"] as Mode[]).map((m) => (
              <button key={m} onClick={() => setMode(m)} className={`rounded-full px-3 py-1.5 ${mode === m ? "bg-ink text-white" : "text-soft"}`}>
                {m === "orb" ? "Opening-range breakout" : "Daily setups"}
              </button>
            ))}
          </div>
        </div>
        {scan.isLoading ? (
          <p className="py-8 text-center text-sm text-soft">Scanning NIFTY 100… this takes up to a minute the first time.</p>
        ) : scan.error ? (
          <p className="py-6 text-center text-sm text-loss">Scan failed. Try again shortly.</p>
        ) : scan.data && scan.data.hits.length === 0 ? (
          <p className="py-6 text-center text-sm text-soft">
            {mode === "orb" ? "No breakout above the 09:15–09:30 range in the latest session." : "No daily setups right now."}
          </p>
        ) : (
          <ul className="divide-y divide-line/60">
            {scan.data?.hits.map((h) => (
              <li key={h.symbol} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="font-bold">{displaySymbol(h.symbol)}</p>
                  <p className="truncate text-xs text-soft">
                    {h.setups.join(", ")}
                    {h.time ? ` · ${istTime(h.time)}` : ""}
                  </p>
                </div>
                <button onClick={() => run(h.symbol)} className="shrink-0 rounded-full bg-accent-soft px-3.5 py-1.5 text-xs font-bold text-accent-deep">
                  Build plan
                </button>
              </li>
            ))}
          </ul>
        )}
        {scan.data && <p className="mt-3 text-[11px] text-faint">Scanned {scan.data.universe} stocks. Textbook patterns, not predictions.</p>}
      </section>

      <section className={card}>
        <h2 className="mb-3 text-lg font-bold">Trade plan</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (symbol.trim()) run(symbol.trim().toUpperCase().includes(".") ? symbol.trim().toUpperCase() : `${symbol.trim().toUpperCase()}.NS`);
          }}
          className="flex flex-wrap items-end gap-2"
        >
          <label className="text-xs font-semibold text-faint">Symbol
            <input value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder="RELIANCE" className={`${inputCls} mt-1 block w-36`} />
          </label>
          <label className="text-xs font-semibold text-faint">Stop
            <select value={stopMode} onChange={(e) => setStopMode(e.target.value as StopMode)} className={`${inputCls} mt-1 block`}>
              <option value="or-mid">Opening-range midpoint</option>
              <option value="or-low">Opening-range low</option>
              <option value="pct">% below entry</option>
              <option value="atr">ATR multiple</option>
            </select>
          </label>
          {(stopMode === "pct" || stopMode === "atr") && (
            <label className="text-xs font-semibold text-faint">{stopMode === "pct" ? "Percent" : "× ATR"}
              <input type="number" step="any" value={stopValue} onChange={(e) => setStopValue(e.target.value)} className={`${inputCls} mt-1 block w-20`} />
            </label>
          )}
          <label className="text-xs font-semibold text-faint">Target (R)
            <input type="number" step="0.5" min="0.5" max="5" value={targetR} onChange={(e) => setTargetR(e.target.value)} className={`${inputCls} mt-1 block w-20`} />
          </label>
          <button type="submit" disabled={plan.isPending} className="rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60">
            {plan.isPending ? "Working…" : "Build plan"}
          </button>
        </form>
        {plan.error && <p className="mt-3 text-sm text-loss">{(plan.error as Error).message}</p>}

        {p && (
          <div className="mt-5 space-y-5">
            <p className="text-sm text-soft">
              <b className="text-ink">{displaySymbol(p.symbol)}</b> · {p.name}
              {p.orb ? ` · opening range ${p.orb.rangeLow}–${p.orb.rangeHigh}, breakout ${p.orb.at}` : " · no breakout today, entry at live price"}
            </p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat label="Entry" value={`₹${p.plan.entry.toFixed(2)}`} />
              <Stat label="Stop" value={`₹${p.plan.stop.toFixed(2)}`} tone="loss" />
              <Stat label="Target" value={`₹${p.plan.target.toFixed(2)}`} tone="gain" />
              <Stat label="Reward : risk" value={p.plan.rewardRisk.toFixed(2)} />
              <Stat label="Quantity" value={String(p.size.quantity)} />
              <Stat label="Position" value={formatMC(p.size.positionValue)} />
              <Stat label="Loss at stop" value={formatMC(p.size.lossAtStop)} tone="loss" />
              <Stat label="Sized by" value={p.size.cappedBy === "position-size" ? "position cap" : "max loss"} />
            </div>

            {p.simulation && (
              <div className="rounded-2xl bg-canvas/60 p-4">
                <p className="flex items-center gap-1.5 text-sm font-bold"><Timer size={15} /> Time Machine · 10,000 runs from {p.simulation.fromTime} IST</p>
                <div className="mt-3 flex h-3 overflow-hidden rounded-full">
                  <div style={{ width: pct(p.simulation.targetFirst) }} className="bg-gain" />
                  <div style={{ width: pct(p.simulation.neither) }} className="bg-line" />
                  <div style={{ width: pct(p.simulation.stopFirst) }} className="bg-loss" />
                </div>
                <div className="mt-2 flex justify-between text-xs">
                  <span className="text-gain">Target first {pct(p.simulation.targetFirst)}</span>
                  <span className="text-soft">Open at close {pct(p.simulation.neither)}</span>
                  <span className="text-loss">Stop first {pct(p.simulation.stopFirst)}</span>
                </div>
                <p className="mt-2 text-xs text-soft">
                  Average outcome {p.simulation.expectedR >= 0 ? "+" : ""}{p.simulation.expectedR.toFixed(2)}R across {p.simulation.sessionsUsed} past sessions. {p.simulation.caveat}
                </p>
              </div>
            )}

            <div className={`rounded-2xl p-4 ${p.risk.pass ? "bg-gain/10" : "bg-loss/10"}`}>
              <p className={`flex items-center gap-1.5 text-sm font-bold ${p.risk.pass ? "text-gain" : "text-loss"}`}>
                {p.risk.pass ? <CheckCircle2 size={16} /> : <ShieldAlert size={16} />}
                Risk gate: {p.risk.pass ? "PASS" : "BLOCK"}
              </p>
              {!p.risk.pass && (
                <ul className="mt-1.5 space-y-1 text-xs text-soft">
                  {p.risk.reasons.map((r) => (
                    <li key={r} className="flex gap-1.5"><XCircle size={13} className="mt-0.5 shrink-0 text-loss" />{r}</li>
                  ))}
                </ul>
              )}
            </div>

            {order.isSuccess ? (
              <p className="text-sm font-bold text-gain">
                Paper order filled with stop and target attached. <Link href="/trading" className="underline">View in Portfolio</Link>
              </p>
            ) : (
              <>
                <button
                  onClick={() => order.mutate(p)}
                  disabled={!p.risk.pass || p.size.quantity < 1 || order.isPending}
                  className="rounded-full bg-gradient-to-r from-accent to-accent-deep px-6 py-2.5 text-sm font-bold text-white shadow-pop disabled:opacity-40"
                >
                  {order.isPending ? "Placing…" : `Paper trade: buy ${p.size.quantity} (MadCoins)`}
                </button>
                {order.error && <p className="mt-2 text-sm text-loss">{(order.error as Error).message}</p>}
              </>
            )}
            <p className="text-xs text-soft">Exit manually before 15:15 IST to avoid carrying a day trade overnight. The stop and target are monitored every minute, not tick by tick.</p>
          </div>
        )}
      </section>

      <DisclaimerText className="px-1" />
    </div>
  );
}
