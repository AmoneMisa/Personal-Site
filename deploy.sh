#!/usr/bin/env bash
# Unified deployment for the public Nuxt renderer, read-only Nuxt jobs API,
# direct jobs worker and the site's existing auxiliary services.
set -euo pipefail

cd "$(dirname "$0")"

if [ ! -f db.env ]; then
  echo "Missing $(pwd)/db.env (copy .env.example and fill server secrets first)." >&2
  exit 1
fi

if [ -d .git ]; then
  # docker-compose.yml is version-controlled deployment config. Legacy CI used
  # to SCP-overwrite it before this pull, leaving the checkout dirty and making
  # `git pull --ff-only` abort. Restore only this deployment-managed file; do not
  # discard any unrelated local changes someone may be working on.
  if ! git diff --quiet -- docker-compose.yml || ! git diff --cached --quiet -- docker-compose.yml; then
    echo "Restoring deployment-managed docker-compose.yml before update..."
    git restore --source=HEAD --staged --worktree -- docker-compose.yml
  fi
  git pull --ff-only
fi

docker network inspect ai-net >/dev/null 2>&1 || docker network create ai-net

compose=(docker compose --env-file db.env)
target="${1:-all}"

case "$target" in
  all)
    # Every image is pre-built in GitHub Actions and published to GHCR. Nothing
    # is built here: production only pulls the exact runtime images.
    "${compose[@]}" pull
    # Remove retired jobs-backend / Python queue containers automatically.
    "${compose[@]}" up -d --no-build --remove-orphans
    ;;
  frontend)
    # Public renderer and read-only jobs API are both Nuxt/Nitro and use the same
    # application image. The worker is a separate Node process from its own image.
    "${compose[@]}" pull frontend jobs-api
    "${compose[@]}" up -d --no-build jobs-api frontend
    ;;
  jobs)
    "${compose[@]}" pull jobs-api jobs-worker job-browser-fetcher
    "${compose[@]}" up -d --no-build job-browser-fetcher jobs-api jobs-worker
    ;;
  backend)
    # Existing auxiliary FastAPI service; unrelated to jobs/hiring ingestion.
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
