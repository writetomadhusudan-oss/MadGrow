# Deploying MadGrow to a VPS

This runs the whole app on one Ubuntu server: **Next.js web + Express API +
PostgreSQL**, behind **Nginx** with free HTTPS, reachable at
`https://yourdomain.com`.

> Everything trades in virtual MadCoins only — there is no real-money path.

## 0. What you buy (once)

- **A VPS**, Ubuntu 24.04, **≥2 GB RAM** (4 GB ideal), region near you.
- **A domain** (e.g. `yourdomain.com`).
- Add the deploy **SSH public key** to the server when creating it.

## 1. Point the domain at the server

In your domain's DNS settings create two **A records** → your server's IP:

| Type | Name | Value |
|------|------|-------|
| A | `@`   | `YOUR_SERVER_IP` |
| A | `www` | `YOUR_SERVER_IP` |

DNS can take a few minutes to a couple of hours to propagate.

## 2. Server setup (run once, as root)

```bash
# System + tooling
apt update && apt -y upgrade
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs git nginx postgresql
npm install -g pm2

# A little swap so the Next.js build doesn't run out of memory on small VPSes
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# Firewall
ufw allow OpenSSH && ufw allow 'Nginx Full' && ufw --force enable
```

Create the database:

```bash
sudo -u postgres psql -c "CREATE USER madgrow WITH PASSWORD 'CHANGE_THIS_PASSWORD';"
sudo -u postgres psql -c "CREATE DATABASE madgrow OWNER madgrow;"
```

## 3. Get the code and configure secrets

```bash
git clone https://github.com/writetomadhusudan-oss/MadGrow.git
cd MadGrow

# API secrets
cat > apps/api/.env <<'EOF'
DATABASE_URL="postgresql://madgrow:CHANGE_THIS_PASSWORD@localhost:5432/madgrow?schema=public"
JWT_SECRET="PASTE_A_LONG_RANDOM_STRING"
NODE_ENV="production"
PORT=4000
WEB_ORIGIN="https://yourdomain.com"
EOF

# Web points at the API on the same domain, under /api
echo 'NEXT_PUBLIC_API_URL="/api"' > apps/web/.env
```

Generate a strong `JWT_SECRET` with:
`node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`

## 4. Build and start

```bash
npm install
npm run db:generate --workspace apps/api
npm run db:push --workspace apps/api        # creates all tables
npm run build --workspace apps/web

pm2 start deploy/ecosystem.config.cjs
pm2 save
pm2 startup                                  # run the command it prints
```

## 5. Nginx + HTTPS

```bash
# edit the two server_name lines to your domain first:
sudo cp deploy/nginx-madgrow.conf /etc/nginx/sites-available/madgrow
sudo ln -s /etc/nginx/sites-available/madgrow /etc/nginx/sites-enabled/madgrow
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

# Free SSL certificate (auto-renews)
sudo apt install -y certbot python3-nginx || sudo apt install -y python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

Visit **https://yourdomain.com** — MadGrow is live.

## Updating later

After pushing new commits to `main`, on the server:

```bash
cd MadGrow && bash deploy/redeploy.sh
```

## Notes & limits

- Market data is Yahoo Finance (free, ~15-min delayed). For real-time or NSE
  option chains, plug a licensed feed into the existing provider interfaces.
- One small VPS comfortably serves a class/community. To scale further: move
  Postgres to a managed instance, run multiple API instances behind the proxy,
  and add Redis for the quote cache (the API is stateless apart from the DB).
- Back up the database periodically: `pg_dump madgrow > backup.sql`.
