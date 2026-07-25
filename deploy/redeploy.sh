#!/usr/bin/env bash
# Pull the latest code and roll it out. Run from the repo root on the server.
#   bash deploy/redeploy.sh
set -euo pipefail

echo "==> Pulling latest main"
git pull origin main

echo "==> Installing dependencies"
npm install

echo "==> Syncing database schema"
npm run db:generate --workspace apps/api
npm run db:push --workspace apps/api

echo "==> Building web app"
npm run build --workspace apps/web

echo "==> Restarting services"
pm2 restart madgrow-api madgrow-web

echo "==> Done. pm2 status:"
pm2 status
