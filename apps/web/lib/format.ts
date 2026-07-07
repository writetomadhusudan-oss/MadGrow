const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

const inrWhole = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 2,
});

export function formatINR(value: number | null | undefined): string {
  if (value == null) return "—";
  return inr.format(value);
}

export function formatNumber(value: number | null | undefined): string {
  if (value == null) return "—";
  return inrWhole.format(value);
}

/** Indian-style compact numbers: 1,00,000 → 1L, 1 crore → 1Cr, 1 lakh crore → 1L Cr. */
export function formatIndianCompact(value: number | null | undefined): string {
  if (value == null) return "—";
  const abs = Math.abs(value);
  if (abs >= 1e12) return `${(value / 1e12).toFixed(2)}L Cr`;
  if (abs >= 1e7) return `${(value / 1e7).toFixed(2)}Cr`;
  if (abs >= 1e5) return `${(value / 1e5).toFixed(2)}L`;
  return inrWhole.format(value);
}

export function formatPercent(value: number | null | undefined): string {
  if (value == null) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export function formatSigned(value: number | null | undefined): string {
  if (value == null) return "—";
  return `${value >= 0 ? "+" : ""}${inrWhole.format(value)}`;
}

/** Strip Yahoo suffix for display: RELIANCE.NS → RELIANCE */
export function displaySymbol(symbol: string): string {
  return symbol.replace(/\.(NS|BO)$/, "");
}

const HUES = [230, 260, 200, 160, 20, 300, 340, 40];

/** Deterministic pastel color pair for a stock's avatar circle. */
export function symbolColor(symbol: string): { bg: string; fg: string } {
  let hash = 0;
  for (const ch of symbol) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  const hue = HUES[Math.abs(hash) % HUES.length];
  return { bg: `hsl(${hue} 85% 94%)`, fg: `hsl(${hue} 65% 42%)` };
}
