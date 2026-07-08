import { Router } from "express";
import { marketData } from "../providers/marketData";
import { optionChains } from "../providers/derivatives";

export const derivativesRouter = Router();

/** Extended index board (cash market). */
derivativesRouter.get("/indices", async (_req, res, next) => {
  try {
    res.json(await marketData.getIndices());
  } catch (err) {
    next(err);
  }
});

/**
 * GET /derivatives/options/:symbol?expiration=YYYY-MM-DD
 * Option chain with LTP/bid/ask/volume/OI/IV and locally computed Greeks.
 * Returns { supported: false, reason } when the provider has no chain
 * (e.g. NSE derivatives on the free Yahoo feed).
 */
derivativesRouter.get("/options/:symbol", async (req, res, next) => {
  try {
    const expiration =
      typeof req.query.expiration === "string" ? req.query.expiration : undefined;
    res.json(await optionChains.getChain(req.params.symbol, expiration));
  } catch (err) {
    next(err);
  }
});
