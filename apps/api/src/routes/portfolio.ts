import { Router } from "express";
import { z } from "zod";
import {
  computeHoldings,
  quantityHeldOn,
  type HoldingWithQuote,
  type PortfolioSummary,
  type TransactionRecord,
} from "@market-cap/shared";
import { prisma } from "../db";
import { requireAuth, type AuthedRequest } from "../middleware/auth";
import { marketData } from "../providers/marketData";

export const portfolioRouter = Router();

portfolioRouter.use(requireAuth);

async function loadTransactions(userId: string): Promise<TransactionRecord[]> {
  const rows = await prisma.transaction.findMany({
    where: { userId },
    orderBy: { date: "asc" },
  });
  return rows.map((row) => ({
    id: row.id,
    symbol: row.symbol,
    name: row.name ?? undefined,
    type: row.type as "BUY" | "SELL",
    quantity: row.quantity,
    price: row.price,
    date: row.date.toISOString(),
  }));
}

portfolioRouter.get("/", async (req: AuthedRequest, res, next) => {
  try {
    const transactions = await loadTransactions(req.userId!);
    const holdings = computeHoldings(transactions);
    const active = holdings.filter((h) => h.quantity > 0);
    const quotes = await marketData
      .getQuotes(active.map((h) => h.symbol))
      .catch(() => []);

    const withQuotes: HoldingWithQuote[] = holdings.map((h) => {
      const quote = quotes.find((q) => q.symbol === h.symbol);
      const currentPrice = quote?.price ?? null;
      const currentValue = currentPrice != null ? currentPrice * h.quantity : null;
      const unrealizedPnl = currentValue != null ? currentValue - h.invested : null;
      return {
        ...h,
        currentPrice,
        currentValue,
        unrealizedPnl,
        unrealizedPnlPercent:
          unrealizedPnl != null && h.invested > 0 ? (unrealizedPnl / h.invested) * 100 : null,
        dayChange: quote ? quote.change * h.quantity : null,
        dayChangePercent: quote?.changePercent ?? null,
      };
    });

    const totalValue = withQuotes.reduce((sum, h) => sum + (h.currentValue ?? 0), 0);
    const totalInvested = withQuotes.reduce((sum, h) => sum + h.invested, 0);
    const totalUnrealizedPnl = withQuotes.reduce((sum, h) => sum + (h.unrealizedPnl ?? 0), 0);
    const summary: PortfolioSummary = {
      totalValue,
      totalInvested,
      totalUnrealizedPnl,
      totalUnrealizedPnlPercent:
        totalInvested > 0 ? (totalUnrealizedPnl / totalInvested) * 100 : null,
      totalRealizedPnl: withQuotes.reduce((sum, h) => sum + h.realizedPnl, 0),
      totalDayChange: withQuotes.reduce((sum, h) => sum + (h.dayChange ?? 0), 0),
      holdings: withQuotes.sort((a, b) => (b.currentValue ?? 0) - (a.currentValue ?? 0)),
    };
    res.json(summary);
  } catch (err) {
    next(err);
  }
});

portfolioRouter.get("/transactions", async (req: AuthedRequest, res, next) => {
  try {
    const rows = await prisma.transaction.findMany({
      where: { userId: req.userId! },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    });
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

const transactionSchema = z.object({
  symbol: z.string().min(1).max(30),
  name: z.string().max(200).optional(),
  type: z.enum(["BUY", "SELL"]),
  quantity: z.number().positive(),
  price: z.number().positive(),
  date: z.string().refine((s) => !Number.isNaN(Date.parse(s)), "Invalid date"),
});

portfolioRouter.post("/transactions", async (req: AuthedRequest, res, next) => {
  const parsed = transactionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const input = parsed.data;
  try {
    if (input.type === "SELL") {
      const existing = await loadTransactions(req.userId!);
      const held = quantityHeldOn(existing, input.symbol, input.date);
      if (input.quantity > held + 1e-9) {
        return res.status(400).json({
          error: `Cannot sell ${input.quantity} — you hold only ${held} of ${input.symbol} on that date`,
        });
      }
    }
    const row = await prisma.transaction.create({
      data: {
        userId: req.userId!,
        symbol: input.symbol,
        name: input.name,
        type: input.type,
        quantity: input.quantity,
        price: input.price,
        date: new Date(input.date),
      },
    });
    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
});

portfolioRouter.delete("/transactions/:id", async (req: AuthedRequest, res, next) => {
  try {
    const { count } = await prisma.transaction.deleteMany({
      where: { id: req.params.id, userId: req.userId! },
    });
    if (count === 0) return res.status(404).json({ error: "Transaction not found" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
