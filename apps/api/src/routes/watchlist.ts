import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth, type AuthedRequest } from "../middleware/auth";
import { marketData } from "../providers/marketData";

export const watchlistRouter = Router();

watchlistRouter.use(requireAuth);

watchlistRouter.get("/", async (req: AuthedRequest, res, next) => {
  try {
    const items = await prisma.watchlistItem.findMany({
      where: { userId: req.userId! },
      orderBy: { addedAt: "desc" },
    });
    const quotes = await marketData
      .getQuotes(items.map((i) => i.symbol))
      .catch(() => []);
    res.json(
      items.map((item) => ({
        symbol: item.symbol,
        name: item.name,
        addedAt: item.addedAt,
        quote: quotes.find((q) => q.symbol === item.symbol) ?? null,
      }))
    );
  } catch (err) {
    next(err);
  }
});

const addSchema = z.object({
  symbol: z.string().min(1).max(30),
  name: z.string().max(200).optional(),
});

watchlistRouter.post("/", async (req: AuthedRequest, res, next) => {
  const parsed = addSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid symbol" });
  try {
    const item = await prisma.watchlistItem.upsert({
      where: { userId_symbol: { userId: req.userId!, symbol: parsed.data.symbol } },
      create: { userId: req.userId!, symbol: parsed.data.symbol, name: parsed.data.name },
      update: { name: parsed.data.name },
    });
    res.status(201).json(item);
  } catch (err) {
    next(err);
  }
});

watchlistRouter.delete("/:symbol", async (req: AuthedRequest, res, next) => {
  try {
    await prisma.watchlistItem.deleteMany({
      where: { userId: req.userId!, symbol: req.params.symbol },
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
