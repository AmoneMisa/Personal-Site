#!/usr/bin/env bash
# Unified deployment for Nuxt (UI + lightweight API), the direct jobs worker
# and the site's existing auxiliary services.
set -euo pipefail

cd "$(dirname "$0")"

STATE_DIR="${DEPLOY_STATE_DIR:-/var/lib/personal-site-deploy}"
DEPLOY_SHA="${DEPLOY_SHA:-$(git rev-parse HEAD 2>/dev/null || echo unknown)}"
DEPLOY_SOURCE="${DEPLOY_SOURCE:-manual}"
SKIP_PULL="${SKIP_PULL:-0}"
FORCE_DEPLOY="${FORCE_DEPLOY:-0}"
mkdir -p "$STATE_DIR"

if [[ "$FORCE_DEPLOY" != "1" && -f "$STATE_DIR/deployed.sha" ]] &&
   [[ "$(cat "$STATE_DIR/deployed.sha")" == "$DEPLOY_SHA" ]]; then
  echo "Commit $DEPLOY_SHA is already deployed; skipping duplicate rollout."
  exit 0
fi

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

# Production normally pulls prebuilt images. Local fallback sets SKIP_PULL=1
# after building the exact same image tags directly on the production host.
prune_unused_docker_data() {
  echo "Docker storage before cleanup:"
  docker system df || true
  docker image prune -af
  docker builder prune -af
  echo "Docker storage after cleanup:"
  docker system df || true
}

prune_unused_docker_data

docker network inspect ai-net >/dev/null 2>&1 || docker network create ai-net

compose=(docker compose --env-file db.env)
target="${1:-all}"

pull_if_needed() {
  if [[ "$SKIP_PULL" == "1" ]]; then
    echo "Using locally built images; registry pull skipped."
    return 0
  fi
  "${compose[@]}" pull "$@"
}

case "$target" in
  all)
    if [[ "$SKIP_PULL" == "1" ]]; then
      echo "Using locally built images; registry pull skipped."
    else
      "${compose[@]}" pull
    fi
    "${compose[@]}" up -d --no-build --remove-orphans
    ;;
  frontend)
    pull_if_needed frontend
    "${compose[@]}" up -d --no-build frontend
    ;;
  jobs)
    pull_if_needed frontend jobs-worker job-browser-fetcher
    "${compose[@]}" up -d --no-build job-browser-fetcher frontend jobs-worker
    ;;
  backend)
    pull_if_needed backend
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

# Only mark the SHA after the rollout and health checks have succeeded.
printf '%s\n' "$DEPLOY_SHA" > "$STATE_DIR/deployed.sha.tmp"
mv "$STATE_DIR/deployed.sha.tmp" "$STATE_DIR/deployed.sha"
printf 'SHA=%s\nSOURCE=%s\nTIME=%s\n' \
  "$DEPLOY_SHA" "$DEPLOY_SOURCE" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$STATE_DIR/deployed.meta"

echo "Recorded successful deployment: $DEPLOY_SHA ($DEPLOY_SOURCE)"

prune_unused_docker_data
