import { Router } from "express";
import {
  CHART_RANGES,
  EDUCATION_DISCLAIMER,
  runStrategies,
  type ChartRange,
} from "@market-cap/shared";
import { cached } from "../cache";
import { marketData } from "../providers/marketData";

export const signalsRouter = Router();

const RANGES = CHART_RANGES;

/**
 * GET /signals/:symbol?range=6mo
 * Runs every strategy over the symbol's candle history. Returns per-strategy
 * signals (confidence, reasons, SL/target/RR) plus time-stamped entry/exit
 * marker events for the chart. Estimates only — never guarantees.
 */
signalsRouter.get("/:symbol", async (req, res, next) => {
  const range = (RANGES.includes(req.query.range as ChartRange) ? req.query.range : "6mo") as ChartRange;
  try {
    const payload = await cached(`signals:${req.params.symbol}:${range}`, 5 * 60_000, async () => {
      const candles = await marketData.getHistory(req.params.symbol, range);
      const strategies = runStrategies(candles);
      const markers = strategies
        .flatMap((s) =>
          s.events.map((e) => ({
            time: candles[e.index].time,
            price: candles[e.index].close,
            kind: e.kind,
            strategyId: s.id,
            strategyName: s.name,
            confidence: e.confidence,
            reasons: e.reasons,
          }))
        )
        .sort((a, b) => a.time.localeCompare(b.time));
      return {
        symbol: req.params.symbol,
        range,
        candleCount: candles.length,
        strategies: strategies.map(({ events: _events, ...rest }) => rest),
        markers,
        note: "All signals are probability-based educational estimates, not financial advice.",
        disclaimer: EDUCATION_DISCLAIMER,
      };
    });
    res.json(payload);
  } catch (err) {
    next(err);
  }
});
