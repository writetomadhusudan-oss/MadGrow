// pm2 process manager config — runs the API and web app as always-on
// services and restarts them on crash or server reboot.
// Start with:  pm2 start deploy/ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: "madgrow-api",
      cwd: "./apps/api",
      script: "npm",
      args: "run start",
      // API reads DATABASE_URL / JWT_SECRET / etc. from apps/api/.env (dotenv).
      env: { NODE_ENV: "production", PORT: 4000 },
      max_restarts: 10,
      restart_delay: 3000,
    },
    {
      name: "madgrow-web",
      cwd: "./apps/web",
      script: "npm",
      args: "run start",
      // NEXT_PUBLIC_API_URL is baked in at build time (see DEPLOY.md).
      env: { NODE_ENV: "production", PORT: 3000 },
      max_restarts: 10,
      restart_delay: 3000,
    },
  ],
};
