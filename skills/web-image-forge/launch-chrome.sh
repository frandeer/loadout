#!/usr/bin/env bash
# web-image-forge Chrome launcher - remote debugging :9222 + persistent ChatGPT profile.

set -euo pipefail

PORT="${PORT:-9222}"
ADDRESS="${ADDRESS:-127.0.0.1}"
START_URL="${START_URL:-https://chatgpt.com/?model=gpt-4o}"

to_unix_path() {
  if command -v cygpath >/dev/null 2>&1; then
    cygpath -u "$1"
  else
    printf '%s' "$1"
  fi
}

if [[ -z "${PROFILE_DIR:-}" ]]; then
  if [[ -n "${LOCALAPPDATA:-}" ]]; then
    PROFILE_DIR="$(to_unix_path "$LOCALAPPDATA")/loadout/chrome-profile"
  else
    PROFILE_DIR="${XDG_DATA_HOME:-"$HOME/.local/share"}/loadout/chrome-profile"
  fi
fi

usage() {
  cat <<'EOF'
Usage: ./launch-chrome.sh [--profile-dir DIR] [--port PORT] [--address HOST] [--url URL]

Environment overrides:
  PROFILE_DIR   Chrome user data directory
  PORT          Remote debugging port, default 9222
  ADDRESS       Remote debugging bind address, default 127.0.0.1
  START_URL     URL to open, default https://chatgpt.com/?model=gpt-4o
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --profile-dir)
      PROFILE_DIR="${2:?missing value for --profile-dir}"
      shift 2
      ;;
    --port)
      PORT="${2:?missing value for --port}"
      shift 2
      ;;
    --address)
      ADDRESS="${2:?missing value for --address}"
      shift 2
      ;;
    --url)
      START_URL="${2:?missing value for --url}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

find_chrome() {
  local candidates=(
    "google-chrome"
    "google-chrome-stable"
    "chromium"
    "chromium-browser"
    "chrome"
    "chrome.exe"
    "/c/Program Files/Google/Chrome/Application/chrome.exe"
    "/c/Program Files (x86)/Google/Chrome/Application/chrome.exe"
    "/c/Users/${USERNAME:-$USER}/AppData/Local/Google/Chrome/Application/chrome.exe"
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    "/Applications/Chromium.app/Contents/MacOS/Chromium"
    "/mnt/c/Program Files/Google/Chrome/Application/chrome.exe"
    "/mnt/c/Program Files (x86)/Google/Chrome/Application/chrome.exe"
  )

  local candidate
  for candidate in "${candidates[@]}"; do
    if command -v "$candidate" >/dev/null 2>&1; then
      command -v "$candidate"
      return 0
    fi
    if [[ -x "$candidate" || -f "$candidate" ]]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done

  return 1
}

CHROME="$(find_chrome || true)"
if [[ -z "$CHROME" ]]; then
  echo "Chrome/Chromium executable not found." >&2
  echo "Install Google Chrome or Chromium, or add it to PATH." >&2
  exit 1
fi

mkdir -p "$PROFILE_DIR"

echo "Launching Chrome (debug ${ADDRESS}:${PORT}, profile ${PROFILE_DIR}). Log in to ChatGPT if needed."

"$CHROME" \
  "--remote-debugging-address=${ADDRESS}" \
  "--remote-debugging-port=${PORT}" \
  "--user-data-dir=${PROFILE_DIR}" \
  "--no-first-run" \
  "--no-default-browser-check" \
  "$START_URL" \
  >/dev/null 2>&1 &

echo "Chrome PID: $!"
