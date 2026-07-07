import { Router } from "express";
import { marketData } from "../providers/marketData";
import { news } from "../providers/news";

export const marketRouter = Router();

marketRouter.get("/indices", async (_req, res, next) => {
  try {
    res.json(await marketData.getIndices());
  } catch (err) {
    next(err);
  }
});

marketRouter.get("/movers", async (_req, res, next) => {
  try {
    res.json(await marketData.getMovers());
  } catch (err) {
    next(err);
  }
});

marketRouter.get("/news", async (_req, res, next) => {
  try {
    res.json(await news.getMarketNews());
  } catch (err) {
    next(err);
  }
});
