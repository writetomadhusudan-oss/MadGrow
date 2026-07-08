import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { authRouter } from "./routes/auth";
import { marketRouter } from "./routes/market";
import { stocksRouter } from "./routes/stocks";
import { watchlistRouter } from "./routes/watchlist";
import { portfolioRouter } from "./routes/portfolio";
import { tradingRouter } from "./routes/trading";
import { signalsRouter } from "./routes/signals";
import { derivativesRouter } from "./routes/derivatives";
import { startMonitor } from "./services/engine";

const app = express();
const PORT = Number(process.env.PORT ?? 4000);
const WEB_ORIGIN = process.env.WEB_ORIGIN ?? "http://localhost:3000";

app.use(cors({ origin: WEB_ORIGIN, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(
  rateLimit({
    windowMs: 60_000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/auth", authRouter);
app.use("/market", marketRouter);
app.use("/stocks", stocksRouter);
app.use("/watchlist", watchlistRouter);
app.use("/portfolio", portfolioRouter);
app.use("/trading", tradingRouter);
app.use("/signals", signalsRouter);
app.use("/derivatives", derivativesRouter);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  const message = err.message?.includes("Quote not found")
    ? "Symbol not found"
    : "Upstream data source error";
  res.status(502).json({ error: message });
});

app.listen(PORT, () => {
  console.log(`MadGrow API listening on http://localhost:${PORT}`);
  startMonitor(); // paper-trading order/SL/target evaluation loop
});
