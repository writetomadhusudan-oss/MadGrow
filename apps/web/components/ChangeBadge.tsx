import { formatPercent } from "@/lib/format";

export function ChangeBadge({
  value,
  size = "md",
}: {
  value: number | null | undefined;
  size?: "sm" | "md";
}) {
  const positive = (value ?? 0) >= 0;
  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold ${
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"
      } ${positive ? "bg-gain-soft text-gain" : "bg-loss-soft text-loss"}`}
    >
      {formatPercent(value)}
    </span>
  );
}
