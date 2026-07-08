"use client";

import { useEffect, useRef } from "react";
import {
  ColorType,
  createChart,
  type IChartApi,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import type { Candle, ChartRange } from "@market-cap/shared";

const INTRADAY: ChartRange[] = ["1d", "1w"];

export interface ChartMarker {
  time: string; // ISO — must exist in the candle series' day/timestamp space
  kind: "entry" | "exit";
}

export function PriceChart({
  candles,
  range,
  height = 320,
  markers = [],
  onSelectTime,
}: {
  candles: Candle[];
  range: ChartRange;
  height?: number;
  /** 🟢 entry / 🔴 exit markers (AI signals). */
  markers?: ChartMarker[];
  /** Fires with the ISO time of a clicked/tapped bar (used to explain markers). */
  onSelectTime?: (isoTime: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const selectRef = useRef(onSelectTime);
  selectRef.current = onSelectTime;

  useEffect(() => {
    const el = containerRef.current;
    if (!el || candles.length === 0) return;

    const chart = createChart(el, {
      height,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#a3a7c2",
        fontFamily: "inherit",
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: "rgba(228, 230, 242, 0.6)" },
      },
      rightPriceScale: { borderVisible: false },
      timeScale: {
        borderVisible: false,
        timeVisible: INTRADAY.includes(range),
        secondsVisible: false,
      },
      crosshair: {
        horzLine: { labelBackgroundColor: "#6553f5" },
        vertLine: { labelBackgroundColor: "#6553f5" },
      },
      handleScroll: false,
      handleScale: false,
    });
    chartRef.current = chart;

    const first = candles[0].close;
    const last = candles[candles.length - 1].close;
    const up = last >= first;
    const line = up ? "#6553f5" : "#ef4056";

    const series = chart.addAreaSeries({
      lineColor: line,
      lineWidth: 2,
      topColor: up ? "rgba(101, 83, 245, 0.28)" : "rgba(239, 64, 86, 0.22)",
      bottomColor: "rgba(101, 83, 245, 0.0)",
      priceLineVisible: false,
    });
    const toTime = (iso: string) => Math.floor(new Date(iso).getTime() / 1000) as UTCTimestamp;
    series.setData(candles.map((c) => ({ time: toTime(c.time), value: c.close })));

    if (markers.length > 0) {
      const candleTimes = new Set(candles.map((c) => toTime(c.time) as number));
      const seriesMarkers: SeriesMarker<Time>[] = markers
        .map((m) => ({ ...m, t: toTime(m.time) }))
        .filter((m) => candleTimes.has(m.t as number))
        .sort((a, b) => (a.t as number) - (b.t as number))
        .map((m) => ({
          time: m.t,
          position: m.kind === "entry" ? ("belowBar" as const) : ("aboveBar" as const),
          color: m.kind === "entry" ? "#0caf7d" : "#ef4056",
          shape: "circle" as const,
          text: m.kind === "entry" ? "🍏" : "🍎",
          size: 0.1,
        }));
      series.setMarkers(seriesMarkers);
    }

    chart.subscribeClick((param) => {
      if (param.time != null && selectRef.current) {
        const seconds = param.time as number;
        selectRef.current(new Date(seconds * 1000).toISOString());
      }
    });

    chart.timeScale().fitContent();
    const observer = new ResizeObserver(() => {
      chart.applyOptions({ width: el.clientWidth });
      chart.timeScale().fitContent();
    });
    observer.observe(el);

    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [candles, range, height, markers]);

  return <div ref={containerRef} className="w-full" style={{ height }} />;
}
