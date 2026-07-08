"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import type { OrderSide, OrderType } from "@market-cap/shared";
import { api } from "@/lib/api";
import { useUser } from "@/lib/auth";
import { formatMC, type FeeBreakdown, type WalletSummary } from "@/lib/trading";
import { displaySymbol, formatNumber } from "@/lib/format";

const ORDER_TYPES: { value: OrderType; label: string }[] = [
  { value: "MARKET", label: "Market" },
  { value: "LIMIT", label: "Limit" },
  { value: "STOP", label: "Stop" },
  { value: "STOP_LIMIT", label: "Stop-Limit" },
];

export function TradeTicket({
  symbol,
  name,
  lastPrice,
  side: initialSide,
  onClose,
}: {
  symbol: string;
  name?: string;
  lastPrice: number | null;
  side: OrderSide;
  onClose: () => void;
}) {
  const { data: user } = useUser();
  const router = useRouter();
  const qc = useQueryClient();
  const [side, setSide] = useState<OrderSide>(initialSide);
  const [type, setType] = useState<OrderType>("MARKET");
  const [quantity, setQuantity] = useState("1");
  const [limitPrice, setLimitPrice] = useState(lastPrice ? String(lastPrice) : "");
  const [stopPrice, setStopPrice] = useState("");

  useEffect(() => {
    if (!user) router.push("/login");
  }, [user, router]);

  const { data: wallet } = useQuery({
    queryKey: ["wallet"],
    queryFn: () => api<WalletSummary>("/trading/wallet"),
    enabled: !!user,
  });

  const qty = Number(quantity) || 0;
  const refPrice =
    type === "MARKET" ? lastPrice ?? 0 : Number(limitPrice) || Number(stopPrice) || lastPrice || 0;

  const { data: fees } = useQuery({
    queryKey: ["fees", side, qty, refPrice],
    queryFn: () =>
      api<FeeBreakdown>(`/trading/fees/preview?side=${side}&quantity=${qty}&price=${refPrice}`),
    enabled: qty > 0 && refPrice > 0,
    refetchInterval: false,
  });

  const place = useMutation({
    mutationFn: () =>
      api("/trading/orders", {
        method: "POST",
        body: JSON.stringify({
          symbol,
          name,
          side,
          type,
          quantity: qty,
          ...(type === "LIMIT" || type === "STOP_LIMIT"
            ? { limitPrice: Number(limitPrice) }
            : {}),
          ...(type === "STOP" || type === "STOP_LIMIT" ? { stopPrice: Number(stopPrice) } : {}),
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wallet"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["paper-trades"] });
      qc.invalidateQueries({ queryKey: ["alerts"] });
      onClose();
    },
  });

  const estimated = qty * refPrice;
  const inputCls =
    "w-full rounded-2xl border border-line bg-canvas/50 px-4 py-2.5 text-sm outline-none focus:border-accent";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-md rounded-card bg-card p-6 shadow-pop">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">
              {side === "BUY" ? "Buy" : "Sell"} {displaySymbol(symbol)}
            </h2>
            <p className="text-xs text-faint">
              Paper trade with MadCoins · LTP {formatNumber(lastPrice)} (delayed ~15 min)
            </p>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-faint hover:bg-canvas">
            <X size={18} />
          </button>
        </div>

        <div className="mb-4 flex gap-2">
          {(["BUY", "SELL"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSide(s)}
              className={`flex-1 rounded-full py-2.5 text-sm font-bold transition ${
                side === s
                  ? s === "BUY"
                    ? "bg-gain text-white"
                    : "bg-loss text-white"
                  : "border border-line bg-card text-soft"
              }`}
            >
              {s === "BUY" ? "Buy / Long" : "Sell / Short"}
            </button>
          ))}
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {ORDER_TYPES.map((t) => (
            <button
              key={t.value}
              onClick={() => setType(t.value)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                type === t.value
                  ? "bg-ink text-white"
                  : "border border-line bg-card text-soft hover:border-accent"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="col-span-2 block">
            <span className="mb-1 block text-xs font-semibold text-soft">Quantity</span>
            <input
              type="number"
              min="1"
              step="any"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className={inputCls}
            />
          </label>
          {(type === "LIMIT" || type === "STOP_LIMIT") && (
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-soft">Limit price</span>
              <input
                type="number"
                min="0.01"
                step="any"
                value={limitPrice}
                onChange={(e) => setLimitPrice(e.target.value)}
                className={inputCls}
              />
            </label>
          )}
          {(type === "STOP" || type === "STOP_LIMIT") && (
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-soft">Stop price</span>
              <input
                type="number"
                min="0.01"
                step="any"
                value={stopPrice}
                onChange={(e) => setStopPrice(e.target.value)}
                className={inputCls}
              />
            </label>
          )}
        </div>

        <div className="mt-4 space-y-1.5 rounded-2xl bg-canvas/60 p-4 text-sm">
          <div className="flex justify-between">
            <span className="text-soft">Estimated {side === "BUY" ? "cost" : "value"}</span>
            <span className="font-semibold">{formatMC(estimated)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-soft">
              Charges (brokerage, STT, GST, stamp…){" "}
            </span>
            <span className="font-semibold">{fees ? formatMC(fees.total) : "—"}</span>
          </div>
          <div className="flex justify-between border-t border-line pt-1.5">
            <span className="text-soft">Available</span>
            <span className="font-semibold">{formatMC(wallet?.available)}</span>
          </div>
        </div>

        {place.isError && (
          <p className="mt-3 rounded-2xl bg-loss-soft px-4 py-2.5 text-sm font-medium text-loss">
            {(place.error as Error).message}
          </p>
        )}

        <button
          onClick={() => place.mutate()}
          disabled={place.isPending || qty <= 0}
          className={`mt-4 w-full rounded-full py-3 text-sm font-bold text-white shadow-pop transition hover:opacity-90 disabled:opacity-60 ${
            side === "BUY" ? "bg-gain" : "bg-loss"
          }`}
        >
          {place.isPending
            ? "Placing…"
            : `${side === "BUY" ? "Buy" : "Sell"} ${qty || ""} ${displaySymbol(symbol)} (virtual)`}
        </button>
        <p className="mt-3 text-center text-[11px] leading-snug text-faint">
          Educational simulator — orders execute only against your virtual MadCoins wallet and
          never reach a real broker or exchange.
        </p>
      </div>
    </div>
  );
}
