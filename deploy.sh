#!/usr/bin/env bash
# Unified deployment for the Nuxt frontend, FastAPI backend and shared Redis.
set -euo pipefail

cd "$(dirname "$0")"

if [ ! -f db.env ]; then
  echo "Missing $(pwd)/db.env (copy .env.example and fill server secrets first)." >&2
  exit 1
fi

if [ -d .git ]; then
  git pull --ff-only
fi

docker network inspect ai-net >/dev/null 2>&1 || docker network create ai-net

compose=(docker compose --env-file db.env)
target="${1:-all}"

case "$target" in
  all)
    # Frontend is pre-built in GitHub Actions and published to GHCR.
    # Pull it first, then rebuild only services that still have a local build context.
    "${compose[@]}" pull frontend
    "${compose[@]}" up -d --build
    ;;
  frontend)
    "${compose[@]}" pull frontend
    "${compose[@]}" up -d frontend
    ;;
  backend)
    "${compose[@]}" up -d --build backend
    ;;
  *)
    echo "Usage: $0 [all|frontend|backend]" >&2
    exit 2
    ;;
esac

"${compose[@]}" ps

if [ "$target" = "all" ] || [ "$target" = "frontend" ]; then
  curl --fail --silent --show-error --retry 20 --retry-all-errors --retry-delay 3 \
    http://127.0.0.1:8080/ >/dev/null
  echo "Personal Site is healthy."
fi
