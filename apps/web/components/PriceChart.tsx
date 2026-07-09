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
import { INTRADAY_RANGES, type Candle, type ChartRange } from "@market-cap/shared";

const INTRADAY: ChartRange[] = INTRADAY_RANGES;

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
  /** Green (entry) / red (exit) dot markers (AI signals). */
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
      // Mobile-app-style navigation: drag to pan, pinch (trackpad pinch
      // arrives as ctrl+wheel) or mouse wheel to zoom into finer structure.
      handleScroll: {
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
        mouseWheel: true,
      },
      handleScale: {
        mouseWheel: true,
        pinch: true,
        axisPressedMouseMove: true,
        axisDoubleClickReset: true,
      },
      kineticScroll: { touch: true, mouse: false },
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
          size: 0.6, // small dot
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
      // Only track width — refitting here would wipe the user's pan/zoom.
      chart.applyOptions({ width: el.clientWidth });
    });
    observer.observe(el);

    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [candles, range, height, markers]);

  return (
    <div className="relative">
      <div ref={containerRef} className="w-full" style={{ height }} />
      <button
        onClick={() => chartRef.current?.timeScale().fitContent()}
        title="Reset zoom to fit all data"
        className="absolute right-2 top-2 z-10 rounded-full border border-line bg-card/90 px-3 py-1 text-[11px] font-semibold text-soft shadow-card backdrop-blur transition hover:border-accent hover:text-accent-deep"
      >
        Fit
      </button>
      <p className="pointer-events-none absolute bottom-1 right-2 z-10 hidden text-[10px] text-faint sm:block">
        drag to pan · pinch or scroll to zoom
      </p>
    </div>
  );
}
