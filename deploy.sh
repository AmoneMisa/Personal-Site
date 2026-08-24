#!/usr/bin/env bash
# Unified deployment for Nuxt (UI + lightweight API), the direct jobs worker
# and the site's existing auxiliary services.
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

# Production only pulls prebuilt images, so unused image layers and builder cache
# are safe to remove. This prevents containerd/overlayfs from filling the host
# between deployments. Volumes and images referenced by existing containers are
# deliberately left untouched.
prune_unused_docker_data() {
  echo "Docker storage before cleanup:"
  docker system df || true
  docker image prune -af
  docker builder prune -af
  echo "Docker storage after cleanup:"
  docker system df || true
}

# Reclaim space before pulling the next image set. This is especially important
# when the previous deploy already left the root filesystem close to full.
prune_unused_docker_data

docker network inspect ai-net >/dev/null 2>&1 || docker network create ai-net

compose=(docker compose --env-file db.env)
target="${1:-all}"

case "$target" in
  all)
    "${compose[@]}" pull
    # Remove retired jobs-backend / jobs-api / Python queue containers automatically.
    "${compose[@]}" up -d --no-build --remove-orphans
    ;;
  frontend)
    # Nuxt serves both the UI/SSR and lightweight jobs/hiring API routes.
    "${compose[@]}" pull frontend
    "${compose[@]}" up -d --no-build frontend
    ;;
  jobs)
    # API changes are part of the Nuxt image; execution is the separate worker.
    "${compose[@]}" pull frontend jobs-worker job-browser-fetcher
    "${compose[@]}" up -d --no-build job-browser-fetcher frontend jobs-worker
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

if [ "$target" = "all" ] || [ "$target" = "frontend" ] || [ "$target" = "jobs" ]; then
  curl --fail --silent --show-error --retry 20 --retry-all-errors --retry-delay 3 \
    http://127.0.0.1:8080/ >/dev/null
  curl --fail --silent --show-error --retry 20 --retry-all-errors --retry-delay 3 \
    http://127.0.0.1:8080/jobs >/dev/null
  curl --fail --silent --show-error --retry 20 --retry-all-errors --retry-delay 3 \
    http://127.0.0.1:8080/hiring >/dev/null
  echo "Personal Site Nuxt runtime is healthy."
fi

# After a healthy rollout, the previous image generation is no longer referenced
# by running containers. Remove it immediately instead of letting layers pile up
# until the next deployment.
prune_unused_docker_data
