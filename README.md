# MadGrow 🌱

A stock investment web app for Indian markets (NSE/BSE) with live-ish pricing,
market news, watchlists, and a portfolio with P&L tracking. Design inspired by
the reference mockup in this repo (light lavender canvas, white rounded cards,
indigo accent).

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
```

## Notes

- Prices are delayed ~15 minutes on the free tier; the UI says so in the footer.
- Yahoo Finance is unofficial and can break — that's the reason for the provider
  interface. Not investment advice.
