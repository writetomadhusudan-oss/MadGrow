"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layers } from "lucide-react";
import { api } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import { DisclaimerText } from "@/components/DisclaimerGate";

interface Greeks {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
}

interface OptionRow {
  strike: number;
  ltp: number | null;
  bid: number | null;
  ask: number | null;
  volume: number | null;
  openInterest: number | null;
  iv: number | null;
  greeks: Greeks | null;
}

interface Chain {
  supported: boolean;
  reason?: string;
  symbol: string;
  underlyingPrice: number | null;
  expirations: string[];
  expiration: string | null;
  calls: OptionRow[];
  puts: OptionRow[];
}

function Half({ rows, side }: { rows: OptionRow[]; side: "CE" | "PE" }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-xs">
        <thead>
          <tr className="border-b border-line text-left uppercase tracking-wider text-faint">
            <th className="py-2 pr-2 font-semibold">Strike</th>
            <th className="py-2 pr-2 text-right font-semibold">LTP</th>
            <th className="py-2 pr-2 text-right font-semibold">Bid</th>
            <th className="py-2 pr-2 text-right font-semibold">Ask</th>
            <th className="py-2 pr-2 text-right font-semibold">Vol</th>
            <th className="py-2 pr-2 text-right font-semibold">OI</th>
            <th className="py-2 pr-2 text-right font-semibold">IV</th>
            <th className="py-2 pr-2 text-right font-semibold">Δ</th>
            <th className="py-2 pr-2 text-right font-semibold">Θ</th>
            <th className="py-2 text-right font-semibold">Vega</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line/60">
          {rows.map((r) => (
            <tr key={`${side}-${r.strike}`} className="hover:bg-canvas/50">
              <td className="py-1.5 pr-2 font-semibold">{formatNumber(r.strike)}</td>
              <td className="py-1.5 pr-2 text-right">{formatNumber(r.ltp)}</td>
              <td className="py-1.5 pr-2 text-right">{formatNumber(r.bid)}</td>
              <td className="py-1.5 pr-2 text-right">{formatNumber(r.ask)}</td>
              <td className="py-1.5 pr-2 text-right">{formatNumber(r.volume)}</td>
              <td className="py-1.5 pr-2 text-right">{formatNumber(r.openInterest)}</td>
              <td className="py-1.5 pr-2 text-right">{r.iv != null ? `${(r.iv * 100).toFixed(1)}%` : "—"}</td>
              <td className="py-1.5 pr-2 text-right">{r.greeks?.delta ?? "—"}</td>
              <td className="py-1.5 pr-2 text-right">{r.greeks?.theta ?? "—"}</td>
              <td className="py-1.5 text-right">{r.greeks?.vega ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function OptionsPage() {
  const [symbol, setSymbol] = useState("AAPL");
  const [input, setInput] = useState("AAPL");
  const [expiration, setExpiration] = useState<string | undefined>();
  const [tab, setTab] = useState<"CE" | "PE">("CE");

  const { data: chain, isFetching } = useQuery({
    queryKey: ["options", symbol, expiration],
    queryFn: () =>
      api<Chain>(
        `/derivatives/options/${encodeURIComponent(symbol)}${expiration ? `?expiration=${expiration}` : ""}`
      ),
    refetchInterval: 5 * 60_000,
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3 px-1">
        <h1 className="text-2xl font-bold tracking-tight">Option Chain</h1>
        <form
          className="ml-auto flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setExpiration(undefined);
            setSymbol(input.trim().toUpperCase());
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Symbol (e.g. AAPL)"
            className="w-44 rounded-full border border-line bg-card px-4 py-2 text-sm shadow-card outline-none focus:border-accent"
          />
          <button className="rounded-full bg-gradient-to-r from-accent to-accent-deep px-5 py-2 text-sm font-bold text-white shadow-pop">
            Load
          </button>
        </form>
      </div>

      <p className="rounded-2xl bg-accent-soft/60 px-4 py-3 text-xs leading-relaxed text-accent-deep">
        NSE/BSE option chains (NIFTY, BANKNIFTY, FINNIFTY…) are not published by the free Yahoo
        data feed. The provider abstraction is in place — plug in a licensed feed (Kite Connect,
        TrueData) to enable them. US-listed symbols (AAPL, TSLA, SPY…) work today as a live demo.
        Greeks are computed locally with Black-Scholes from provider IV.
      </p>

      {isFetching && !chain ? (
        <div className="h-96 animate-pulse rounded-card bg-card/70" />
      ) : !chain || !chain.supported ? (
        <div className="rounded-card bg-card p-10 text-center shadow-card">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-accent-deep">
            <Layers size={24} />
          </span>
          <h2 className="mt-4 text-lg font-bold">No chain available for {symbol}</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-soft">{chain?.reason}</p>
        </div>
      ) : (
        <section className="rounded-card bg-card p-5 shadow-card">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <p className="text-sm">
              <span className="font-bold">{chain.symbol}</span>
              <span className="ml-2 text-soft">spot {formatNumber(chain.underlyingPrice)}</span>
            </p>
            <select
              value={chain.expiration ?? ""}
              onChange={(e) => setExpiration(e.target.value)}
              className="rounded-full border border-line bg-card px-3 py-1.5 text-xs font-semibold outline-none"
            >
              {chain.expirations.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
            <div className="ml-auto flex gap-2">
              {(["CE", "PE"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${
                    tab === t
                      ? t === "CE"
                        ? "bg-gain text-white"
                        : "bg-loss text-white"
                      : "border border-line bg-card text-soft"
                  }`}
                >
                  {t === "CE" ? "Calls (CE)" : "Puts (PE)"}
                </button>
              ))}
            </div>
          </div>
          <Half rows={tab === "CE" ? chain.calls : chain.puts} side={tab} />
          <p className="mt-3 text-[11px] text-faint">
            Change in OI needs historical OI snapshots — available once a licensed derivatives
            feed is connected. Virtual option buying/selling and multi-leg strategies plug into
            the same paper engine when that feed is live.
          </p>
        </section>
      )}

      <DisclaimerText className="px-2 text-center" />
    </div>
  );
}
