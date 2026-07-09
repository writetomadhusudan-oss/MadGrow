# MadGrow 🌱

A trading **learning platform** for Indian markets (NSE/BSE): live-ish pricing,
market news, watchlists — and a full paper-trading simulator with virtual
**MadCoins**, an AI trade assistant, and performance analytics. Design inspired
by the reference mockup in this repo (light lavender canvas, white rounded
cards, indigo accent).

> **Educational use only.** All trading uses virtual MadCoins; no order can ever
> reach a real broker. Signals are probability-based estimates, not advice.
> Users must accept the statutory disclaimer on first use.

## Trading simulator

- **MadCoins wallet** — every account starts with 1,000,000 MC (configurable via
  `TRADING_STARTING_BALANCE`). Tracks available balance, margin used by shorts,
  unrealized/realized/today's/lifetime P&L.
- **Paper engine** — market / limit / stop / stop-limit orders, modify & cancel,
  longs and shorts, position-level stop-loss & target, evaluated every 60s
  against delayed quotes. Simulates adverse slippage plus configurable Indian
  charges: brokerage, STT, exchange, SEBI, GST, stamp duty (`TRADING_*` env vars,
  see [apps/api/src/config/trading.ts](apps/api/src/config/trading.ts)).
- **AI Trade Assistant** — 8 toggleable strategies (EMA cross, SuperTrend, RSI
  reversal, MACD, Bollinger/Donchian breakouts, VWAP, Stochastic) built on a
  pure indicator library ([packages/shared/src/indicators.ts](packages/shared/src/indicators.ts)).
  Each outputs signal, confidence, reasoning, ATR stop/target, risk-reward, and
  a position-sizing hint. Green/red dot markers on the chart show suggested
  entries and exits; tap a bar for the reasoning. An LLM explanation provider
  can be plugged in behind the same interface later (Feature-9 abstraction).
- **Analytics** — win/loss ratio, profit factor, max drawdown, avg holding time,
  best/worst trade, Sharpe estimate, equity curve, daily & monthly P&L.
- **Alerts** — order fills/rejections, SL/target hits; in-app bell + browser
  notifications (FCM/APNs can slot into the same alert rows for mobile later).
- **Derivatives** — extended index board (SENSEX, NIFTY 50, BANK NIFTY,
  FINNIFTY, MIDCAP 50) and an option-chain page with IV and locally computed
  Black-Scholes Greeks. Yahoo's free feed has no NSE chains, so NSE derivatives
  stay behind the `OptionChainProvider` abstraction until a licensed feed
  (Kite Connect, TrueData) is plugged in; US symbols work today as a demo.

## Stack

- **Monorepo** — npm workspaces
- **`apps/web`** — Next.js 15 + React 19 + Tailwind CSS v4, TanStack Query, lightweight-charts
- **`apps/api`** — Express + TypeScript, Prisma, JWT auth (httpOnly cookie)
- **`packages/shared`** — shared types + portfolio P&L math (FIFO lots), Vitest tests

## Data sources (free tier)

- **Quotes / charts / search** — Yahoo Finance via `yahoo-finance2` (unofficial,
  ~15-minute delayed for NSE/BSE). NSE symbols use the `.NS` suffix, BSE `.BO`.
  The provider lives behind a `MarketDataProvider` interface
  ([apps/api/src/providers/marketData.ts](apps/api/src/providers/marketData.ts)) so a
  licensed real-time feed (e.g. Zerodha Kite Connect) can be swapped in later.
- **News** — Google News RSS, same abstraction pattern.
- **Movers** — computed from a seeded NIFTY 100 list (no free movers endpoint exists).

## Database

SQLite via Prisma for zero-setup local dev (`apps/api/prisma/dev.db`). To move to
PostgreSQL: change the datasource provider in
[schema.prisma](apps/api/prisma/schema.prisma), point `DATABASE_URL` at the server,
and run `npx prisma migrate dev`.

## Running locally

```bash
npm install
npm run db:migrate --workspace apps/api   # first time only
npm run dev:api                            # http://localhost:4000
npm run dev:web                            # http://localhost:3000
```

Environment lives in `apps/api/.env` (see `.env.example`). Set a real
`JWT_SECRET` outside local dev.

## Tests

```bash
npm test   # portfolio P&L math (packages/shared)
```

## API surface

```
POST /auth/register /auth/login /auth/logout        GET /auth/me
GET  /market/indices /market/movers /market/news
GET  /stocks/search?q=   /stocks/:symbol   /stocks/:symbol/history?range=   /stocks/:symbol/news
GET/POST /watchlist      DELETE /watchlist/:symbol
GET  /portfolio          GET/POST /portfolio/transactions   DELETE /portfolio/transactions/:id

# Paper trading (auth required; virtual MadCoins only)
GET  /trading/wallet                       wallet summary + positions + fee config
POST /trading/orders                       { symbol, side, type, quantity, limitPrice?, stopPrice? }
GET  /trading/orders?status=OPEN           order book
PATCH/DELETE /trading/orders/:id           modify / cancel resting orders
POST /trading/positions/protection         set { symbol, stopLoss?, target? }
POST /trading/positions/:symbol/close      market-close a position
GET  /trading/fees/preview?side&quantity&price
GET  /trading/trades                       fill history with fees & realized P&L
GET  /trading/analytics                    win ratio, profit factor, drawdown, equity curve…
GET  /trading/leaderboard                  top realized P&L (masked identities)
GET  /trading/alerts    POST /trading/alerts/read

# Signals & derivatives
GET  /signals/:symbol?range=6mo            per-strategy signals + entry/exit marker events
GET  /derivatives/indices                  extended index board
GET  /derivatives/options/:symbol          option chain + Greeks ({ supported:false } for NSE)

# Disclaimer
POST /auth/accept-disclaimer               records statutory-disclaimer acceptance
```

## Notes

- Prices are delayed ~15 minutes on the free tier; the UI says so in the footer.
- Yahoo Finance is unofficial and can break — that's the reason for the provider
  interface. Not investment advice.
