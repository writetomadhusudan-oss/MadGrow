import { displaySymbol, symbolColor } from "@/lib/format";

export function StockAvatar({ symbol, size = 40 }: { symbol: string; size?: number }) {
  const { bg, fg } = symbolColor(symbol);
  const initials = displaySymbol(symbol).slice(0, 2).toUpperCase();
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full font-bold"
      style={{ width: size, height: size, background: bg, color: fg, fontSize: size * 0.34 }}
    >
      {initials}
    </span>
  );
}
