#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${CHATGPT_CODE_ENV_FILE:-$ROOT_DIR/.env.agent-server}"
SERVICE_NAME="${CHATGPT_CODE_SERVICE_NAME:-chatgpt-code-daemon}"
SYSTEMD_TEMPLATE="$ROOT_DIR/deploy/chatgpt-code-daemon.service"
SYSTEMD_TARGET="${CHATGPT_CODE_SYSTEMD_TARGET:-/etc/systemd/system/${SERVICE_NAME}.service}"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf 'Missing required command: %s\n' "$1" >&2
    exit 1
  fi
}

require_command npm
require_command curl

if [[ ! -f "$ENV_FILE" ]]; then
  cp "$ROOT_DIR/.env.agent-server.example" "$ENV_FILE"
  printf 'Created %s from template. Review it before exposing the daemon.\n' "$ENV_FILE"
fi

set -a
source "$ENV_FILE"
set +a

mkdir -p "${CHATGPT_CODE_WORKSPACE_ROOT:-$ROOT_DIR}"

printf 'Installing workspace dependencies...\n'
cd "$ROOT_DIR"
npm install

printf 'Building core packages...\n'
npm run build:core

if command -v systemctl >/dev/null 2>&1 && [[ -w "$(dirname "$SYSTEMD_TARGET")" ]]; then
  sed \
    -e "s#__WORKDIR__#$ROOT_DIR#g" \
    -e "s#__ENV_FILE__#$ENV_FILE#g" \
    "$SYSTEMD_TEMPLATE" > "$SYSTEMD_TARGET"

  systemctl daemon-reload
  systemctl enable --now "$SERVICE_NAME"
  printf 'Systemd service installed at %s\n' "$SYSTEMD_TARGET"
else
  printf 'Skipping systemd install. Either systemctl is unavailable or %s is not writable.\n' "$(dirname "$SYSTEMD_TARGET")"
  printf 'You can still run: npm run start -w @chatgpt-code/daemon\n'
fi

HOST="${CHATGPT_CODE_DAEMON_HOST:-127.0.0.1}"
PORT="${CHATGPT_CODE_DAEMON_PORT:-4017}"
HEALTH_URL="http://${HOST}:${PORT}/health"

printf 'Checking daemon health at %s ...\n' "$HEALTH_URL"
curl --fail --silent "$HEALTH_URL" >/dev/null
printf 'Daemon health check passed.\n'

if [[ -n "${CHATGPT_CODE_REGISTER_URL:-}" ]]; then
  REGISTER_ID="${CHATGPT_CODE_REGISTER_ID:-$(hostname -s)}"
  REGISTER_NAME="${CHATGPT_CODE_REGISTER_NAME:-$REGISTER_ID}"
  REGISTER_HOST="${CHATGPT_CODE_REGISTER_HOST:-$HOST}"
  REGISTER_PORT="${CHATGPT_CODE_REGISTER_PORT:-$PORT}"
  REGISTER_ROLE="${CHATGPT_CODE_REGISTER_ROLE:-general}"

  printf 'Registering worker %s with %s ...\n' "$REGISTER_ID" "$CHATGPT_CODE_REGISTER_URL"
  curl \
    --fail \
    --silent \
    --show-error \
    -X POST \
    -H 'Content-Type: application/json' \
    "$CHATGPT_CODE_REGISTER_URL/workers" \
    -d "{
      \"capabilities\": [\"run_command\", \"read_file\", \"write_file\"],
      \"connectionType\": \"ssh\",
      \"host\": \"${REGISTER_HOST}\",
      \"id\": \"${REGISTER_ID}\",
      \"name\": \"${REGISTER_NAME}\",
      \"port\": ${REGISTER_PORT},
      \"role\": \"${REGISTER_ROLE}\",
      \"status\": \"idle\",
      \"username\": \"${CHATGPT_CODE_REGISTER_USERNAME:-}\",
      \"workingDirectory\": \"${CHATGPT_CODE_WORKSPACE_ROOT:-$ROOT_DIR}\"
    }" >/dev/null
  printf 'Worker registration request sent.\n'
fi

printf '\nBootstrap complete.\n'
printf 'Health: %s\n' "$HEALTH_URL"
printf 'Logs: journalctl -u %s -f\n' "$SERVICE_NAME"

