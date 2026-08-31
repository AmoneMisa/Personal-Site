#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"
STATE_DIR="${DEPLOY_STATE_DIR:-/var/lib/personal-site-deploy}"
MANIFEST="${1:-$STATE_DIR/rollback.manifest}"

if [ ! -f "$MANIFEST" ]; then
  echo "Rollback manifest not found: $MANIFEST" >&2
  exit 1
fi

# The manifest is generated only by deploy.sh in the root-owned deployment
# state directory. Keep the accepted surface deliberately narrow before sourcing.
if grep -Ev '^(DEPLOY_SHA|FRONTEND_IMAGE_TAG|BACKEND_IMAGE_TAG|JOBS_WORKER_IMAGE_TAG|JOB_BROWSER_FETCHER_IMAGE_TAG|SUBSCRIPTION_BOT_IMAGE_TAG)=[0-9a-f]{40}$' "$MANIFEST" | grep -q .; then
  echo "Rollback manifest contains unexpected data: $MANIFEST" >&2
  exit 1
fi

# shellcheck disable=SC1090
source "$MANIFEST"
: "${DEPLOY_SHA:?rollback manifest is missing DEPLOY_SHA}"

if [ -d .git ]; then
  git fetch origin master
  git reset --hard "$DEPLOY_SHA"
fi

export FRONTEND_IMAGE_TAG BACKEND_IMAGE_TAG JOBS_WORKER_IMAGE_TAG
export JOB_BROWSER_FETCHER_IMAGE_TAG SUBSCRIPTION_BOT_IMAGE_TAG

FORCE_DEPLOY=1 DEPLOY_SOURCE=rollback DEPLOY_SHA="$DEPLOY_SHA" bash ./deploy.sh all
