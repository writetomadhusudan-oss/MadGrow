import { Router } from "express";
import type { ChartRange } from "@market-cap/shared";
import { marketData } from "../providers/marketData";
import { news } from "../providers/news";

export const stocksRouter = Router();

const VALID_RANGES: ChartRange[] = ["1d", "1w", "1mo", "6mo", "1y", "5y"];

stocksRouter.get("/search", async (req, res, next) => {
  const q = String(req.query.q ?? "").trim();
  if (q.length < 2) return res.json([]);
  try {
    res.json(await marketData.search(q));
  } catch (err) {
    next(err);
  }
});

stocksRouter.get("/:symbol", async (req, res, next) => {
  try {
    res.json(await marketData.getQuote(req.params.symbol));
  } catch (err) {
    next(err);
  }
});

stocksRouter.get("/:symbol/history", async (req, res, next) => {
  const range = String(req.query.range ?? "1mo") as ChartRange;
  if (!VALID_RANGES.includes(range)) {
    return res.status(400).json({ error: `range must be one of ${VALID_RANGES.join(", ")}` });
  }
  try {
    res.json(await marketData.getHistory(req.params.symbol, range));
  } catch (err) {
    next(err);
  }
});

stocksRouter.get("/:symbol/news", async (req, res, next) => {
  try {
    // Use the company name for a better news query when available.
    let query = req.params.symbol.replace(/\.(NS|BO)$/, "");
    try {
      const quote = await marketData.getQuote(req.params.symbol);
      if (quote.name) query = quote.name;
    } catch {
      // fall back to the bare symbol
    }
    res.json(await news.getStockNews(query));
  } catch (err) {
    next(err);
  }
});
