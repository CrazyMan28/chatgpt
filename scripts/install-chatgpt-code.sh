#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${CHATGPT_CODE_REPO_URL:-}"
INSTALL_DIR="${CHATGPT_CODE_INSTALL_DIR:-$HOME/chatgpt_code_codex_version}"
BIN_DIR="${CHATGPT_CODE_BIN_DIR:-$HOME/.local/bin}"
NODE_MAJOR_MIN="${CHATGPT_CODE_NODE_MAJOR_MIN:-20}"
WITH_DAEMON=0

usage() {
  cat <<'USAGE'
Usage: scripts/install-chatgpt-code.sh [--repo <git-url>] [--dir <path>] [--with-daemon]

Installs prerequisites, npm dependencies, builds the workspace, and creates:
  ~/.local/bin/codex_code

Environment overrides:
  CHATGPT_CODE_REPO_URL      Git URL to clone when not already in a repo
  CHATGPT_CODE_INSTALL_DIR   Install directory, default: ~/chatgpt_code_codex_version
  CHATGPT_CODE_BIN_DIR       Launcher directory, default: ~/.local/bin
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)
      REPO_URL="${2:-}"
      shift 2
      ;;
    --dir)
      INSTALL_DIR="${2:-}"
      shift 2
      ;;
    --with-daemon)
      WITH_DAEMON=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      printf 'Unknown option: %s\n\n' "$1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

log() {
  printf '\n==> %s\n' "$1"
}

have() {
  command -v "$1" >/dev/null 2>&1
}

sudo_if_needed() {
  if [[ "$(id -u)" -eq 0 ]]; then
    "$@"
  else
    sudo "$@"
  fi
}

install_packages() {
  local packages=("$@")

  if [[ "${#packages[@]}" -eq 0 ]]; then
    return
  fi

  if have apt-get; then
    sudo_if_needed apt-get update
    sudo_if_needed env DEBIAN_FRONTEND=noninteractive apt-get install -y "${packages[@]}"
    return
  fi

  if have dnf; then
    sudo_if_needed dnf install -y "${packages[@]}"
    return
  fi

  if have pacman; then
    sudo_if_needed pacman -Sy --needed --noconfirm "${packages[@]}"
    return
  fi

  if have brew; then
    brew install "${packages[@]}"
    return
  fi

  printf 'No supported package manager found. Install these manually: %s\n' "${packages[*]}" >&2
}

node_major() {
  if ! have node; then
    printf '0'
    return
  fi

  node -p "Number(process.versions.node.split('.')[0])"
}

ensure_prereqs() {
  log "Installing system prerequisites"

  if have apt-get; then
    install_packages ca-certificates curl git openssh-client python3 make g++ sqlite3 sshpass
  elif have dnf; then
    install_packages ca-certificates curl git openssh-clients python3 make gcc-c++ sqlite sshpass
  elif have pacman; then
    install_packages ca-certificates curl git openssh python make gcc sqlite sshpass
  elif have brew; then
    install_packages git openssh sqlite sshpass
  else
    printf 'Skipping package install. git, npm, openssh-client, sqlite3, and sshpass are expected.\n'
  fi

  if [[ "$(node_major)" -lt "$NODE_MAJOR_MIN" ]]; then
    printf 'Node.js %s+ is required. Install Node.js, then rerun this script.\n' "$NODE_MAJOR_MIN" >&2
    exit 1
  fi

  if ! have npm; then
    printf 'npm is required. Install npm, then rerun this script.\n' >&2
    exit 1
  fi
}

resolve_repo_root() {
  local script_dir
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

  if [[ -f "$script_dir/../package.json" && -f "$script_dir/../bin/codex_code.mjs" ]]; then
    cd "$script_dir/.."
    pwd
    return
  fi

  if [[ -f "package.json" && -f "bin/codex_code.mjs" ]]; then
    pwd
    return
  fi

  if [[ -z "$REPO_URL" ]]; then
    printf 'Not inside a chatgpt-code checkout. Set CHATGPT_CODE_REPO_URL or pass --repo <git-url>.\n' >&2
    exit 1
  fi

  if [[ ! -d "$INSTALL_DIR/.git" ]]; then
    log "Cloning repository"
    mkdir -p "$(dirname "$INSTALL_DIR")"
    git clone "$REPO_URL" "$INSTALL_DIR"
  fi

  cd "$INSTALL_DIR"
  pwd
}

install_workspace() {
  local repo_root="$1"

  log "Installing npm dependencies"
  cd "$repo_root"
  npm install

  log "Building TUI and core packages"
  npm run build:core

  log "Installing launcher"
  mkdir -p "$BIN_DIR"
  ln -sfn "$repo_root/bin/codex_code.mjs" "$BIN_DIR/codex_code"
  chmod +x "$repo_root/bin/codex_code.mjs"

  if [[ "$WITH_DAEMON" -eq 1 ]]; then
    log "Installing daemon"
    "$repo_root/scripts/install-agent-server.sh"
  fi
}

main() {
  ensure_prereqs
  local repo_root
  repo_root="$(resolve_repo_root)"
  install_workspace "$repo_root"

  cat <<EOF

Install complete.

Launcher:
  $BIN_DIR/codex_code

Run:
  cd "$repo_root"
  codex_code

SSH workers:
  /ssh add
  /ssh test <name>
  /ssh run <name> <command>
  /scope grant remote-host <name>
EOF
}

main "$@"
