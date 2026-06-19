#!/usr/bin/env bash
# chatgpt-image-farm Chrome launcher (macOS/Linux).
# Opens Chrome with a dedicated, persistent profile and remote debugging on :9222.
# Run once, sign in to ChatGPT, then `npm start`.
set -euo pipefail

PROFILE_DIR="${PROFILE_DIR:-$HOME/.local/share/chatgpt-image-farm/chrome-profile}"
PORT="${PORT:-9222}"
ADDRESS="${ADDRESS:-127.0.0.1}"

CHROME=""
for c in \
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  "$(command -v google-chrome || true)" \
  "$(command -v google-chrome-stable || true)" \
  "$(command -v chromium || true)" \
  "/c/Program Files/Google/Chrome/Application/chrome.exe" \
  "/c/Program Files (x86)/Google/Chrome/Application/chrome.exe" \
  "$LOCALAPPDATA/Google/Chrome/Application/chrome.exe"; do
  if [ -n "$c" ] && [ -x "$c" ]; then CHROME="$c"; break; fi
done
[ -n "$CHROME" ] || { echo "chrome not found" >&2; exit 1; }

mkdir -p "$PROFILE_DIR"

echo "Launching Chrome (debug $ADDRESS:$PORT, profile $PROFILE_DIR)"
echo "Sign in to ChatGPT in the window that opens, then: npm start"
"$CHROME" \
  --remote-debugging-address="$ADDRESS" \
  --remote-debugging-port="$PORT" \
  --user-data-dir="$PROFILE_DIR" \
  --no-first-run \
  --no-default-browser-check \
  "https://chatgpt.com/?model=gpt-4o" >/dev/null 2>&1 &
