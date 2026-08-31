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

# A production release is one immutable revision across every service. Explicit
# overrides still exist for local recovery, but the normal path derives every tag
# from DEPLOY_SHA so Compose can never silently mix a new frontend with old
# mutable :latest auxiliary images.
export FRONTEND_IMAGE_TAG="${FRONTEND_IMAGE_TAG:-$DEPLOY_SHA}"
export BACKEND_IMAGE_TAG="${BACKEND_IMAGE_TAG:-$DEPLOY_SHA}"
export JOBS_WORKER_IMAGE_TAG="${JOBS_WORKER_IMAGE_TAG:-$DEPLOY_SHA}"
export JOB_BROWSER_FETCHER_IMAGE_TAG="${JOB_BROWSER_FETCHER_IMAGE_TAG:-$DEPLOY_SHA}"
export SUBSCRIPTION_BOT_IMAGE_TAG="${SUBSCRIPTION_BOT_IMAGE_TAG:-$DEPLOY_SHA}"

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

# Preserve the last known-good immutable manifest before touching containers.
# It is only replaced after a later successful deploy, so a failed rollout always
# leaves an immediately usable rollback target.
if [ -f "$STATE_DIR/deployed.manifest" ]; then
  cp "$STATE_DIR/deployed.manifest" "$STATE_DIR/rollback.manifest.tmp"
  mv "$STATE_DIR/rollback.manifest.tmp" "$STATE_DIR/rollback.manifest"
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

run_database_migrations() {
  echo "Applying versioned Jobs/Hiring/queue migrations..."
  "${compose[@]}" run --rm --no-deps jobs-worker \
    node --experimental-transform-types \
      ./scripts/migrate-database.ts
}

prepare_database_schema() {
  # Transitional read-model/backfill preparation. Once all historical candidate
  # data migrations are versioned, this compatibility preflight can disappear.
  echo "Preparing Jobs/Hiring/queue read models before runtime traffic..."
  "${compose[@]}" run --rm --no-deps jobs-worker \
    node --experimental-transform-types \
      --import ./jobs-worker/alias-loader.mjs \
      ./scripts/prepare-database-schema.ts
}

prepare_databases() {
  run_database_migrations
  prepare_database_schema
}

case "$target" in
  all)
    if [[ "$SKIP_PULL" == "1" ]]; then
      echo "Using locally built images; registry pull skipped."
    else
      "${compose[@]}" pull
    fi
    prepare_databases
    "${compose[@]}" up -d --no-build --remove-orphans
    ;;
  frontend)
    pull_if_needed frontend
    "${compose[@]}" up -d --no-build frontend
    ;;
  jobs)
    pull_if_needed frontend jobs-worker job-browser-fetcher
    prepare_databases
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
    http://127.0.0.1:8080/ready >/dev/null
  curl --fail --silent --show-error --retry 20 --retry-all-errors --retry-delay 3 \
    http://127.0.0.1:8080/ >/dev/null
  curl --fail --silent --show-error --retry 20 --retry-all-errors --retry-delay 3 \
    http://127.0.0.1:8080/jobs >/dev/null
  curl --fail --silent --show-error --retry 20 --retry-all-errors --retry-delay 3 \
    http://127.0.0.1:8080/hiring >/dev/null
  echo "Personal Site Nuxt runtime is ready and serving core boards."
fi

if [ "$target" = "all" ] || [ "$target" = "backend" ]; then
  backend_id="$("${compose[@]}" ps -q backend)"
  test -n "$backend_id"
  docker exec "$backend_id" python -c \
    "import urllib.request; assert urllib.request.urlopen('http://127.0.0.1:8000/ready', timeout=3).status == 200"
  echo "Personal Site backend is ready."
fi

# Only mark the release after rollout and readiness checks have succeeded.
printf '%s\n' "$DEPLOY_SHA" > "$STATE_DIR/deployed.sha.tmp"
mv "$STATE_DIR/deployed.sha.tmp" "$STATE_DIR/deployed.sha"
printf 'SHA=%s\nSOURCE=%s\nTIME=%s\n' \
  "$DEPLOY_SHA" "$DEPLOY_SOURCE" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$STATE_DIR/deployed.meta"

cat > "$STATE_DIR/deployed.manifest.tmp" <<EOF
DEPLOY_SHA=$DEPLOY_SHA
FRONTEND_IMAGE_TAG=$FRONTEND_IMAGE_TAG
BACKEND_IMAGE_TAG=$BACKEND_IMAGE_TAG
JOBS_WORKER_IMAGE_TAG=$JOBS_WORKER_IMAGE_TAG
JOB_BROWSER_FETCHER_IMAGE_TAG=$JOB_BROWSER_FETCHER_IMAGE_TAG
SUBSCRIPTION_BOT_IMAGE_TAG=$SUBSCRIPTION_BOT_IMAGE_TAG
EOF
mv "$STATE_DIR/deployed.manifest.tmp" "$STATE_DIR/deployed.manifest"

echo "Recorded successful immutable deployment: $DEPLOY_SHA ($DEPLOY_SOURCE)"

prune_unused_docker_data
