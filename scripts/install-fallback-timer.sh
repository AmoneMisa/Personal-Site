#!/usr/bin/env bash
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "Run this installer as root (or with sudo)." >&2
  exit 1
fi

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SERVICE_NAME="personal-site-deploy-fallback"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
TIMER_FILE="/etc/systemd/system/${SERVICE_NAME}.timer"

cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=Personal Site local deploy fallback
After=docker.service network-online.target
Wants=network-online.target
Requires=docker.service

[Service]
Type=oneshot
WorkingDirectory=${REPO_DIR}
ExecStart=/usr/bin/env bash ${REPO_DIR}/scripts/fallback-deploy.sh
TimeoutStartSec=0
Nice=10
EOF

cat > "$TIMER_FILE" <<EOF
[Unit]
Description=Check Personal Site GitHub runner every 30 seconds

[Timer]
OnBootSec=30s
OnUnitInactiveSec=30s
AccuracySec=5s
RandomizedDelaySec=0
Persistent=true
Unit=${SERVICE_NAME}.service

[Install]
WantedBy=timers.target
EOF

chmod +x "${REPO_DIR}/scripts/fallback-deploy.sh"
systemctl daemon-reload
systemctl enable "${SERVICE_NAME}.timer"
systemctl restart "${SERVICE_NAME}.timer"

echo "Installed ${SERVICE_NAME}.timer"
systemctl status "${SERVICE_NAME}.timer" --no-pager || true
systemctl list-timers --all "${SERVICE_NAME}.timer" --no-pager || true
echo
echo "Manual fallback: bash ${REPO_DIR}/scripts/fallback-deploy.sh --force"
