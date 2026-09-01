#!/usr/bin/env bash
# Deploy only Personal Site-owned runtimes. Workforce APIs/workers and the
# Telegram subscription worker are deployed by whiteslove.me-backend-platform.
set -euo pipefail

cd "$(dirname "$0")"

STATE_DIR="${DEPLOY_STATE_DIR:-/var/lib/personal-site-deploy}"
DEPLOY_SHA="${DEPLOY_SHA:-$(git rev-parse HEAD 2>/dev/null || echo unknown)}"
DEPLOY_SOURCE="${DEPLOY_SOURCE:-manual}"
SKIP_PULL="${SKIP_PULL:-0}"
FORCE_DEPLOY="${FORCE_DEPLOY:-0}"
mkdir -p "$STATE_DIR"

export FRONTEND_IMAGE_TAG="${FRONTEND_IMAGE_TAG:-$DEPLOY_SHA}"
export BACKEND_IMAGE_TAG="${BACKEND_IMAGE_TAG:-$DEPLOY_SHA}"

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
  if ! git diff --quiet -- docker-compose.yml || ! git diff --cached --quiet -- docker-compose.yml; then
    echo "Restoring deployment-managed docker-compose.yml before update..."
    git restore --source=HEAD --staged --worktree -- docker-compose.yml
  fi
  git pull --ff-only
fi

if [ -f "$STATE_DIR/deployed.manifest" ]; then
  cp "$STATE_DIR/deployed.manifest" "$STATE_DIR/rollback.manifest.tmp"
  mv "$STATE_DIR/rollback.manifest.tmp" "$STATE_DIR/rollback.manifest"
fi

prune_unused_docker_data() {
  docker system df || true
  docker image prune -af
  docker builder prune -af
  docker system df || true
}

prune_unused_docker_data

docker network inspect ai-net >/dev/null 2>&1 || docker network create ai-net
if ! docker network inspect whiteslove-backend-platform >/dev/null 2>&1; then
  echo "Missing whiteslove-backend-platform network; deploy backend-platform before Personal Site." >&2
  exit 1
fi

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
    pull_if_needed frontend backend
    "${compose[@]}" up -d --no-build --remove-orphans frontend backend
    ;;
  frontend)
    pull_if_needed frontend
    "${compose[@]}" up -d --no-build frontend
    ;;
  backend)
    pull_if_needed backend
    "${compose[@]}" up -d --no-build backend
    ;;
  *)
    echo "Usage: $0 [all|frontend|backend]" >&2
    exit 2
    ;;
esac

"${compose[@]}" ps

if [ "$target" = "all" ] || [ "$target" = "frontend" ]; then
  for path in ready '' jobs hiring; do
    curl --fail --silent --show-error --retry 20 --retry-all-errors --retry-delay 3 \
      "http://127.0.0.1:8080/${path}" >/dev/null
  done
  echo "Personal Site Nuxt runtime is ready and backend-platform reads are reachable."
fi

if [ "$target" = "all" ] || [ "$target" = "backend" ]; then
  backend_id="$("${compose[@]}" ps -q backend)"
  test -n "$backend_id"
  docker exec "$backend_id" python -c \
    "import urllib.request; assert urllib.request.urlopen('http://127.0.0.1:8000/ready', timeout=3).status == 200"
  echo "Personal Site backend is ready."
fi

printf '%s\n' "$DEPLOY_SHA" > "$STATE_DIR/deployed.sha.tmp"
mv "$STATE_DIR/deployed.sha.tmp" "$STATE_DIR/deployed.sha"
printf 'SHA=%s\nSOURCE=%s\nTIME=%s\n' \
  "$DEPLOY_SHA" "$DEPLOY_SOURCE" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$STATE_DIR/deployed.meta"

cat > "$STATE_DIR/deployed.manifest.tmp" <<EOF
DEPLOY_SHA=$DEPLOY_SHA
FRONTEND_IMAGE_TAG=$FRONTEND_IMAGE_TAG
BACKEND_IMAGE_TAG=$BACKEND_IMAGE_TAG
EOF
mv "$STATE_DIR/deployed.manifest.tmp" "$STATE_DIR/deployed.manifest"

echo "Recorded successful immutable deployment: $DEPLOY_SHA ($DEPLOY_SOURCE)"
prune_unused_docker_data
