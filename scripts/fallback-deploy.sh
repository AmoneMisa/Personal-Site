#!/usr/bin/env bash
# Build and deploy the current master directly on the production host when the
# GitHub-hosted workflow has not acquired a runner within the configured grace
# period. Workforce services have their own backend-platform deploy lifecycle.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

REPO="AmoneMisa/Personal-Site"
WORKFLOW_PATH=".github/workflows/deploy.yml"
THRESHOLD_SECONDS="${FALLBACK_THRESHOLD_SECONDS:-180}"
RETRY_COOLDOWN_SECONDS="${FALLBACK_RETRY_COOLDOWN_SECONDS:-900}"
STATE_DIR="${DEPLOY_STATE_DIR:-/var/lib/personal-site-deploy}"
LOCK_FILE="/tmp/personal-site-deploy.lock"
FORCE=0
[[ "${1:-}" == "--force" ]] && FORCE=1
mkdir -p "$STATE_DIR"

log() { printf '[personal-site-fallback] %s\n' "$*"; }

refresh_remote() {
  git fetch --quiet origin master
  REMOTE_SHA="$(git rev-parse origin/master)"
  COMMIT_EPOCH="$(git show -s --format=%ct "$REMOTE_SHA")"
}

already_deployed() {
  [[ -f "$STATE_DIR/deployed.sha" ]] && [[ "$(cat "$STATE_DIR/deployed.sha")" == "$REMOTE_SHA" ]]
}

recent_failed_attempt() {
  local failed_sha failed_at now elapsed
  [[ -f "$STATE_DIR/fallback-failed.sha" && -f "$STATE_DIR/fallback-failed.at" ]] || return 1
  failed_sha="$(cat "$STATE_DIR/fallback-failed.sha")"
  [[ "$failed_sha" == "$REMOTE_SHA" ]] || return 1
  failed_at="$(cat "$STATE_DIR/fallback-failed.at")"
  [[ "$failed_at" =~ ^[0-9]+$ ]] || return 1
  now="$(date +%s)"
  elapsed=$(( now - failed_at ))
  if (( elapsed < RETRY_COOLDOWN_SECONDS )); then
    log "Previous fallback attempt for $REMOTE_SHA failed ${elapsed}s ago; retry cooldown is ${RETRY_COOLDOWN_SECONDS}s."
    return 0
  fi
  return 1
}

runner_state() {
  local tmp status_line
  tmp="$(mktemp)"
  if ! curl -fsS --max-time 15 -H 'Accept: application/vnd.github+json' \
    "https://api.github.com/repos/${REPO}/actions/runs?branch=master&event=push&per_page=20" > "$tmp"; then
    rm -f "$tmp"
    printf 'unknown - %s\n' "$(( $(date +%s) - COMMIT_EPOCH ))"
    return 0
  fi

  status_line="$(python3 -c '
import datetime, json, sys
sha = sys.argv[1]
with open(sys.argv[2], "r", encoding="utf-8") as fh:
    data = json.load(fh)
for run in data.get("workflow_runs", []):
    if run.get("head_sha") != sha or run.get("path") != ".github/workflows/deploy.yml":
        continue
    created = run.get("created_at")
    if created:
        dt = datetime.datetime.fromisoformat(created.replace("Z", "+00:00"))
        age = max(0, int((datetime.datetime.now(datetime.timezone.utc) - dt).total_seconds()))
    else:
        age = 0
    print(run.get("status") or "unknown", run.get("conclusion") or "-", age)
    break
else:
    print("missing", "-", max(0, int(datetime.datetime.now(datetime.timezone.utc).timestamp()) - int(sys.argv[3])))
' "$REMOTE_SHA" "$tmp" "$COMMIT_EPOCH")"
  rm -f "$tmp"
  printf '%s\n' "$status_line"
}

should_fallback() {
  local status conclusion age
  refresh_remote

  if already_deployed; then
    log "$REMOTE_SHA is already deployed."
    return 1
  fi
  if [[ "$FORCE" == "1" ]]; then
    log "Manual fallback requested for $REMOTE_SHA."
    return 0
  fi
  if recent_failed_attempt; then
    return 1
  fi

  read -r status conclusion age <<<"$(runner_state)"
  log "GitHub workflow state for $REMOTE_SHA: status=$status conclusion=$conclusion age=${age}s"
  case "$status" in
    queued|pending|waiting|requested|missing|unknown)
      (( age >= THRESHOLD_SECONDS )) && return 0
      log "Grace period has not elapsed yet (${age}s < ${THRESHOLD_SECONDS}s)."
      return 1
      ;;
    in_progress)
      log "GitHub runner is active; local fallback is not needed."
      return 1
      ;;
    completed)
      log "GitHub workflow completed with conclusion=$conclusion; fallback will not bypass CI results."
      return 1
      ;;
    *)
      log "Unrecognised workflow state '$status'; refusing automatic deployment."
      return 1
      ;;
  esac
}

if ! should_fallback; then exit 0; fi

exec 9>"$LOCK_FILE"
if [[ "$FORCE" == "1" ]]; then
  flock -w 1800 9
else
  flock -n 9 || { log "Another deployment already owns $LOCK_FILE; skipping."; exit 0; }
fi

if [[ "$FORCE" != "1" ]] && ! should_fallback; then exit 0; fi
refresh_remote
SHA="$REMOTE_SHA"

if [[ "$FORCE" != "1" ]]; then
  printf '%s\n' "$SHA" > "$STATE_DIR/fallback-failed.sha.tmp"
  mv "$STATE_DIR/fallback-failed.sha.tmp" "$STATE_DIR/fallback-failed.sha"
  printf '%s\n' "$(date +%s)" > "$STATE_DIR/fallback-failed.at.tmp"
  mv "$STATE_DIR/fallback-failed.at.tmp" "$STATE_DIR/fallback-failed.at"
fi

worktree="$(mktemp -d /tmp/personal-site-fallback.XXXXXX)"
cleanup() {
  git worktree remove --force "$worktree" >/dev/null 2>&1 || true
  rm -rf "$worktree" >/dev/null 2>&1 || true
}
trap cleanup EXIT

git worktree add --quiet --detach "$worktree" "$SHA"
log "Generating a fresh temporary lockfile for the local fallback build."
rm -f "$worktree/package-lock.json"
docker run --rm -v "$worktree:/app" -w /app node:24-bookworm-slim \
  npm install --package-lock-only --ignore-scripts --legacy-peer-deps >/dev/null
sed -i 's/^RUN npm ci$/RUN npm ci --legacy-peer-deps/' "$worktree/Dockerfile"

log "Building Personal Site images locally for $SHA."
docker build -f "$worktree/Dockerfile" -t ghcr.io/amonemisa/personal-site:latest "$worktree"
docker build -f "$worktree/backend/Dockerfile" -t ghcr.io/amonemisa/personal-site-backend:latest "$worktree/backend"

git pull --ff-only origin master
log "Deploying locally built images for $SHA."
DEPLOY_SHA="$SHA" DEPLOY_SOURCE="local-fallback" SKIP_PULL=1 bash ./deploy.sh all

rm -f "$STATE_DIR/fallback-failed.sha" "$STATE_DIR/fallback-failed.at"
log "Fallback deployment completed for $SHA."
