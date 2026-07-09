"use client";

import { Sparkles } from "lucide-react";
import type { RiskLevel, SignalDirection } from "@market-cap/shared";
import { formatNumber } from "@/lib/format";

export interface StrategyCardData {
  id: string;
  name: string;
  category: string;
  riskLevel: RiskLevel;
  signal: SignalDirection;
  confidence: number;
  reasons: string[];
  stopLoss: number | null;
  target: number | null;
  riskReward: number | null;
  positionSizePer100k: number | null;
}

export interface SignalMarkerData {
  time: string;
  price: number;
  kind: "entry" | "exit";
  strategyId: string;
  strategyName: string;
  confidence: number;
  reasons: string[];
}

const signalTone: Record<SignalDirection, string> = {
  BUY: "bg-gain-soft text-gain",
  SELL: "bg-loss-soft text-loss",
  NEUTRAL: "bg-canvas text-faint",
};

export function SignalsPanel({
  strategies,
  markers,
  enabled,
  onToggle,
  selectedTime,
}: {
  strategies: StrategyCardData[];
  markers: SignalMarkerData[];
  enabled: Set<string>;
  onToggle: (id: string) => void;
  selectedTime: string | null;
}) {
  const selectedDay = selectedTime?.slice(0, 10);
  const selected = selectedDay
    ? markers.filter((m) => m.time.slice(0, 10) === selectedDay && enabled.has(m.strategyId))
    : [];

  return (
    <div className="space-y-4">
      {/* Marker explanation (click/tap a 🍏/🍎 on the chart) */}
      {selected.length > 0 ? (
        <div className="rounded-2xl border border-accent/30 bg-accent-soft/50 p-4">
          {selected.map((m, i) => (
            <div key={i} className={i > 0 ? "mt-3 border-t border-line pt-3" : ""}>
              <p className="text-sm font-bold">
                <span className={m.kind === "entry" ? "text-gain" : "text-loss"}>●</span>{" "}
                {m.kind === "entry" ? "Suggested Entry" : "Suggested Exit"}
                <span className="ml-2 rounded-full bg-card px-2 py-0.5 text-xs font-semibold text-accent-deep">
                  Confidence: {m.confidence}% (estimate)
                </span>
              </p>
              <p className="mt-0.5 text-xs text-faint">
                {m.strategyName} · {new Date(m.time).toLocaleDateString("en-IN")} · @{" "}
                {formatNumber(m.price)}
              </p>
              <ul className="mt-1.5 list-inside list-disc text-xs text-soft">
                {m.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-2xl bg-canvas/60 px-4 py-3 text-xs text-soft">
          <span className="text-gain">●</span> = suggested entry ·{" "}
          <span className="text-loss">●</span> = suggested exit. Tap a marker (or its bar) on the
          chart to see the reasoning. Signals are probability-based educational estimates — never
          guarantees.
        </p>
      )}

      {/* Strategy cards with per-strategy toggles */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {strategies.map((s) => {
          const on = enabled.has(s.id);
          return (
            <div
              key={s.id}
              className={`rounded-2xl border p-4 transition ${
                on ? "border-line bg-card shadow-card" : "border-line/60 bg-canvas/40 opacity-60"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-bold">{s.name}</p>
                  <p className="text-[11px] text-faint">
                    {s.category} · risk {s.riskLevel.toLowerCase()}
                  </p>
                </div>
                <button
                  onClick={() => onToggle(s.id)}
                  className={`relative h-5 w-9 shrink-0 rounded-full transition ${on ? "bg-accent" : "bg-line"}`}
                  title={on ? "Disable strategy" : "Enable strategy"}
                >
                  <span
                    className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${on ? "left-4.5 left-[18px]" : "left-0.5"}`}
                  />
                </button>
              </div>
              <div className="mt-2.5 flex items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${signalTone[s.signal]}`}>
                  {s.signal}
                </span>
                {s.signal !== "NEUTRAL" && (
                  <span className="text-xs font-semibold text-soft">~{s.confidence}% confidence</span>
                )}
              </div>
              {on && (
                <>
                  <ul className="mt-2 list-inside list-disc text-[11px] leading-relaxed text-soft">
                    {s.reasons.slice(0, 3).map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                  <div className="mt-2 grid grid-cols-3 gap-1.5 text-center text-[11px]">
                    <div className="rounded-lg bg-loss-soft/60 py-1">
                      <span className="block text-faint">SL</span>
                      <span className="font-semibold">{formatNumber(s.stopLoss)}</span>
                    </div>
                    <div className="rounded-lg bg-gain-soft/60 py-1">
                      <span className="block text-faint">Target</span>
                      <span className="font-semibold">{formatNumber(s.target)}</span>
                    </div>
                    <div className="rounded-lg bg-canvas py-1">
                      <span className="block text-faint">R:R</span>
                      <span className="font-semibold">{s.riskReward ?? "—"}</span>
                    </div>
                  </div>
                  {s.positionSizePer100k != null && (
                    <p className="mt-1.5 text-[11px] text-faint">
                      Sizing hint: ~{s.positionSizePer100k} qty per 1L MadCoins at 1% risk
                    </p>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      <p className="flex items-start gap-1.5 text-[11px] leading-snug text-faint">
        <Sparkles size={13} className="mt-0.5 shrink-0" />
        AI-assisted educational estimates from technical indicators — not financial advice, no
        certainty or profit is implied. An LLM explanation provider can be plugged in later.
      </p>
    </div>
  );
}
