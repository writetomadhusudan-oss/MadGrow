"use client";

import { useEffect, useRef } from "react";
import {
  ColorType,
  createChart,
  type IChartApi,
  type UTCTimestamp,
} from "lightweight-charts";
import type { Candle, ChartRange } from "@market-cap/shared";

const INTRADAY: ChartRange[] = ["1d", "1w"];

export function PriceChart({
  candles,
  range,
  height = 320,
}: {
  candles: Candle[];
  range: ChartRange;
  height?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

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
    series.setData(
      candles.map((c) => ({
        time: Math.floor(new Date(c.time).getTime() / 1000) as UTCTimestamp,
        value: c.close,
      }))
    );
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
  }, [candles, range, height]);

  return <div ref={containerRef} className="w-full" style={{ height }} />;
}
