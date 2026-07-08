import { Sprout } from "lucide-react";
import { EDUCATION_DISCLAIMER } from "@market-cap/shared";

export const metadata = { title: "About — MadGrow" };

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="rounded-card bg-card p-8 shadow-card">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-accent-deep text-white shadow-pop">
          <Sprout size={22} />
        </span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight">About MadGrow</h1>
        <p className="mt-3 text-sm leading-relaxed text-soft">
          MadGrow is a trading <strong>learning platform</strong>: track NSE &amp; BSE markets,
          read news, and practice trading with a virtual MadCoins wallet. Orders are simulated
          against delayed market prices with realistic charges (brokerage, STT, exchange fees,
          GST, stamp duty) and slippage — so you can learn the mechanics and the costs without
          risking money. The AI Trade Assistant highlights probability-based entry/exit ideas
          from technical indicators, always labeled as estimates.
        </p>
      </div>

      <div className="rounded-card bg-card p-8 shadow-card">
        <h2 className="text-lg font-bold">Statutory Disclaimer</h2>
        <p className="mt-3 rounded-2xl bg-canvas/60 p-4 text-sm leading-relaxed text-soft">
          {EDUCATION_DISCLAIMER}
        </p>
        <ul className="mt-4 list-inside list-disc text-sm text-soft">
          <li>No order ever reaches a real broker or exchange.</li>
          <li>Market data is delayed ~15 minutes (free data tier).</li>
          <li>Signals are educational estimates — never guarantees of profit.</li>
        </ul>
      </div>
    </div>
  );
}
