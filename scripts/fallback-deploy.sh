#!/usr/bin/env bash
# Build and deploy the current master directly on the production host when the
# GitHub-hosted workflow has not acquired a runner within the configured grace
# period. Use --force for an immediate manual fallback.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

REPO="AmoneMisa/Personal-Site"
WORKFLOW_PATH=".github/workflows/deploy.yml"
THRESHOLD_SECONDS="${FALLBACK_THRESHOLD_SECONDS:-180}"
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

runner_state() {
  local tmp status_line
  tmp="$(mktemp)"
  if ! curl -fsS --max-time 15 \
    -H 'Accept: application/vnd.github+json' \
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

  read -r status conclusion age <<<"$(runner_state)"
  log "GitHub workflow state for $REMOTE_SHA: status=$status conclusion=$conclusion age=${age}s"

  case "$status" in
    queued|pending|waiting|requested|missing|unknown)
      if (( age >= THRESHOLD_SECONDS )); then
        return 0
      fi
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

if ! should_fallback; then
  exit 0
fi

# GitHub deploy uses the same lock. This prevents two rollouts from mutating the
# containers at the same time if a hosted runner wakes up during local build.
exec 9>"$LOCK_FILE"
if [[ "$FORCE" == "1" ]]; then
  flock -w 1800 9
else
  flock -n 9 || { log "Another deployment already owns $LOCK_FILE; skipping."; exit 0; }
fi

# Re-evaluate after taking the lock; GitHub may have started or completed while
# this process was waiting.
if [[ "$FORCE" != "1" ]] && ! should_fallback; then
  exit 0
fi
refresh_remote
SHA="$REMOTE_SHA"

worktree="$(mktemp -d /tmp/personal-site-fallback.XXXXXX)"
cleanup() {
  git worktree remove --force "$worktree" >/dev/null 2>&1 || true
  rm -rf "$worktree" >/dev/null 2>&1 || true
}
trap cleanup EXIT

git worktree add --quiet --detach "$worktree" "$SHA"

# The mutable parsing-lexicon tarball can change while its URL stays identical.
# Generate a completely fresh lock only inside the disposable worktree so stale
# integrity data cannot leak into the emergency build. The existing Nuxt graph
# currently needs legacy peer handling, so npm ci must use the same mode as the
# lock generator. Patch only the disposable Dockerfiles; master remains on the
# normal npm-ci path used by GitHub Actions.
log "Generating a fresh temporary lockfile for the local fallback build."
rm -f "$worktree/package-lock.json"
docker run --rm \
  -v "$worktree:/app" \
  -w /app \
  node:24-bookworm-slim \
  npm install --package-lock-only --ignore-scripts --legacy-peer-deps >/dev/null

sed -i 's/^RUN npm ci$/RUN npm ci --legacy-peer-deps/' "$worktree/Dockerfile"
sed -i 's/^RUN npm ci --omit=dev$/RUN npm ci --omit=dev --legacy-peer-deps/' "$worktree/jobs-worker/Dockerfile"

log "Building production images locally for $SHA."
docker build -f "$worktree/Dockerfile" \
  -t ghcr.io/amonemisa/personal-site:latest "$worktree"
docker build -f "$worktree/backend/Dockerfile" \
  -t ghcr.io/amonemisa/personal-site-backend:latest "$worktree/backend"
docker build -f "$worktree/jobs-worker/Dockerfile" \
  -t ghcr.io/amonemisa/personal-site-jobs-worker:latest "$worktree"
docker build -f "$worktree/job-browser-fetcher/Dockerfile" \
  -t ghcr.io/amonemisa/personal-site-job-browser-fetcher:latest "$worktree/job-browser-fetcher"
docker build -f "$worktree/subscription-bot/Dockerfile" \
  -t ghcr.io/amonemisa/personal-site-subscription-bot:latest "$worktree/subscription-bot"

# Update the deployment checkout only after all images exist successfully.
git pull --ff-only origin master

log "Deploying locally built images for $SHA."
DEPLOY_SHA="$SHA" DEPLOY_SOURCE="local-fallback" SKIP_PULL=1 \
  bash ./deploy.sh all

log "Fallback deployment completed for $SHA."
