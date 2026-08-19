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
    # Every image is pre-built in GitHub Actions and published to GHCR. Nothing
    # is built here: this server cannot reach Docker Hub (auth.docker.io TLS
    # handshake timeouts), so a local build fails as soon as it needs a base
    # image, and the Nuxt build alone used to exceed the deploy timeout.
    "${compose[@]}" pull
    "${compose[@]}" up -d --no-build
    ;;
  frontend)
    "${compose[@]}" pull frontend
    "${compose[@]}" up -d --no-build frontend
    ;;
  backend)
    "${compose[@]}" pull backend
    "${compose[@]}" up -d --no-build backend
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
