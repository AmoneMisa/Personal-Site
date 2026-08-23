#!/usr/bin/env bash
# Unified deployment for the public Nuxt frontend, internal jobs runtime,
# FastAPI tools backend and queue workers.
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
    # is built here: this server cannot reach Docker Hub, and keeping builds out
    # of production also avoids competing with the running application.
    "${compose[@]}" pull
    # Remove services retired from compose so stale containers cannot keep
    # consuming resources indefinitely.
    "${compose[@]}" up -d --no-build --remove-orphans
    ;;
  frontend)
    # Frontend and jobs-backend use the same application image. Refresh the queue
    # image too because workers now talk only to jobs-backend, never to frontend.
    "${compose[@]}" pull frontend jobs-backend job-browser-fetcher jobs-queue-dispatcher jobs-queue-worker-1
    "${compose[@]}" up -d --no-build job-browser-fetcher jobs-backend jobs-queue-dispatcher jobs-queue-worker-1 frontend
    ;;
  jobs)
    "${compose[@]}" pull jobs-backend job-browser-fetcher jobs-queue-dispatcher jobs-queue-worker-1
    "${compose[@]}" up -d --no-build job-browser-fetcher jobs-backend jobs-queue-dispatcher jobs-queue-worker-1
    ;;
  backend)
    "${compose[@]}" pull backend
    "${compose[@]}" up -d --no-build backend
    ;;
  *)
    echo "Usage: $0 [all|frontend|jobs|backend]" >&2
    exit 2
    ;;
esac

"${compose[@]}" ps

if [ "$target" = "all" ] || [ "$target" = "frontend" ]; then
  curl --fail --silent --show-error --retry 20 --retry-all-errors --retry-delay 3 \
    http://127.0.0.1:8080/ >/dev/null
  curl --fail --silent --show-error --retry 20 --retry-all-errors --retry-delay 3 \
    http://127.0.0.1:8080/jobs >/dev/null
  curl --fail --silent --show-error --retry 20 --retry-all-errors --retry-delay 3 \
    http://127.0.0.1:8080/hiring >/dev/null
  echo "Personal Site frontend is healthy."
fi
