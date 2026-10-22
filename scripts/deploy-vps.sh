#!/usr/bin/env bash
# Update + (re)start the store on a VPS (CloudPanel Node.js site). Run as the site user from the
# project folder:   bash scripts/deploy-vps.sh
# Pulls the latest code from GitHub, installs, builds, restarts PM2 and checks /api/health.
set -euo pipefail
cd "$(dirname "$0")/.."

ENV_FILE="${KIDZLIM_ENV_FILE:-$HOME/kidzlim.env}"
if [ ! -f "$ENV_FILE" ]; then
  echo "Missing $ENV_FILE — copy .env.vps.example there and fill it in (see VPS.md)." >&2
  exit 1
fi

echo "==> Pulling latest code"
git pull --ff-only

echo "==> Installing dependencies"
npm ci --no-audit --no-fund

echo "==> Building"
# NEXT_PUBLIC_SERVER_URL is baked into the build, so load the env file first.
set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a
npm run build

echo "==> Restarting"
export KIDZLIM_ENV_FILE="$ENV_FILE"
pm2 startOrReload ecosystem.config.cjs --update-env
pm2 save

echo "==> Health check"
for _ in $(seq 1 30); do
  if curl -fsS -m 5 "http://127.0.0.1:${APP_PORT:-3000}/api/health" >/dev/null 2>&1; then
    curl -fsS "http://127.0.0.1:${APP_PORT:-3000}/api/health"
    echo
    echo "✓ Kidzlim is running"
    exit 0
  fi
  sleep 2
done
echo "✗ The app did not become healthy — check: pm2 logs kidzlim --lines 100" >&2
exit 1
