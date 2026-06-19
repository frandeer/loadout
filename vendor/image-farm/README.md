# chatgpt-image-farm

Prompt in → **ChatGPT web** generates the image → **image file** out.
A long-running HTTP server drives a **pool of Chrome tabs** over the Chrome
DevTools Protocol (CDP), so you can generate **many images in parallel** and save
them **wherever you want**. Also exposes the same capability over **MCP**.

No OpenAI API key. It automates the actual `chatgpt.com` web UI in a real,
logged-in Chrome window (same approach as `slide-design` / loadout's
`web-image-forge`, extended with a tab pool + MCP).

## How it works

```
                 ┌──────────────── one process ────────────────┐
  HTTP / MCP ──► │  server.js  ──►  TabPool  ──►  tab #0 ─┐     │
                 │                          ├──►  tab #1 ─┼─► chatgpt.com
                 │                          └──►  tab #2 ─┘     │  (one logged-in
                 └─────────────────────────────────────────────┘   Chrome window)
```

- The **HTTP server is the single owner** of the Chrome pool.
- The **MCP server is a thin stdio client** that forwards to the HTTP server — so
  there's never two processes fighting over the same tabs.
- "Parallel" = N tabs, each its own ChatGPT conversation. The pool caps real
  concurrency at `POOL_SIZE` and queues the rest (FIFO).

## Setup

```bash
npm install
```

### 1. Launch Chrome and sign in (once)

```powershell
.\launch-chrome.ps1            # Windows
# ./launch-chrome.sh           # macOS / Linux
```

A Chrome window opens at `chatgpt.com`. **Sign in.** The login is stored in a
dedicated profile (`%LOCALAPPDATA%\chatgpt-image-farm\chrome-profile`) and reused
on every later run. Leave this window open.

### 2. Start the server

```bash
npm start
# chatgpt-image-farm server on http://127.0.0.1:4180
```

Open <http://127.0.0.1:4180> for a status dashboard with single + parallel test forms.

## HTTP API

| Method | Path | Body | Result |
|---|---|---|---|
| GET | `/api/health` | – | `{ ok, chrome, pool: { ready, size, busy, free, queued } }` |
| POST | `/api/generate` | `{ prompt, count?, outDir? }` | `{ ok, tab, count, images: [{ filename, fullPath }], log }` |
| POST | `/api/batch` | `{ jobs: [{ prompt, count?, outDir? }, …] }` | `{ ok, total, okCount, results: [...] }` (runs in parallel) |

```bash
curl -X POST http://127.0.0.1:4180/api/generate \
  -H "content-type: application/json" \
  -d '{"prompt":"a red apple, product photo","count":1,"outDir":"D:/out/apples"}'
```

- `count`: 1–8 images to wait for (default 1).
- `outDir`: absolute path preferred (save where you want). Defaults to `./generated`.
  Filenames are auto: `chatgpt-<time>-<job>-<index>.<ext>`.

## MCP integration

Start the HTTP server first, then register the MCP server (stdio):

```json
{
  "mcpServers": {
    "image-farm": {
      "command": "node",
      "args": ["D:/lab/side-project/chatgpt-image-farm/mcp-server.js"],
      "env": { "IMAGE_FARM_URL": "http://127.0.0.1:4180" }
    }
  }
}
```

Tools exposed:

- `generate_image` `{ prompt, count?, outDir? }` — one prompt → file(s).
- `generate_images_batch` `{ prompts: string[], count?, outDir? }` — many prompts **in parallel**.
- `image_farm_health` — Chrome reachable? pool status?

## Configuration (env vars)

| Var | Default | Meaning |
|---|---|---|
| `PORT` | `4180` | HTTP server port |
| `POOL_SIZE` | `3` | Number of Chrome tabs = max parallel generations |
| `CHROME_HOST` | `127.0.0.1` | CDP host |
| `CHROME_PORT` | `9222` | CDP port (must match launch-chrome) |
| `IMAGE_FARM_URL` | `http://127.0.0.1:4180` | (MCP) URL of the HTTP server |

## Tests

```bash
npm test               # unit: pool semaphore + save (no Chrome needed)
npm run smoke:health   # needs server running
npm run smoke:generate # needs Chrome signed-in + server (real generation)
npm run smoke:parallel # parallel batch timing
```

### Reuse an existing logged-in profile (skip re-login)

The login lives in the Chrome **profile dir** (`--user-data-dir`). To reuse one you
already signed into (e.g. a sibling project's), point the launcher at it:

```powershell
.\launch-chrome.ps1 -ProfileDir "$env:LOCALAPPDATA\slide-design\chrome-profile"
```
```bash
PROFILE_DIR="$LOCALAPPDATA/slide-design/chrome-profile" sh launch-chrome.sh
```

A profile can only be open in **one** Chrome at a time — close any other Chrome
using it first. Verify the session with `npm run smoke:login`.

## Notes / gotchas

- ChatGPT must be **signed in** in the launched Chrome; if not, generate returns
  `code: "NOT_SIGNED_IN"`.
- **Image detection is host-based.** Generated images are found anywhere in the
  (fresh) conversation by their content host
  (`chatgpt.com/backend-api/estuary/content`, `*.oaiusercontent.com`), deduped by
  file id. This survives ChatGPT's 2026 UI change that dropped the old
  `data-message-author-role="assistant"` containers, and it deliberately does NOT
  require `img.naturalWidth` — ChatGPT lazy-loads the `<img>`, so in a backgrounded
  automated tab it stays decoded at 0×0, but the `src` is still fetchable.
- Selectors/host patterns live at the top of `lib/chrome.js` — the one place to
  update if ChatGPT changes its UI again. `npm run smoke:inspect` dumps the live
  DOM (turn counts, testids, image srcs) to help.
- Per-tab timeout is 4 min; if ChatGPT refuses or stalls you get `code: "NO_IMAGES"`.
- Image-generation rate limits are per ChatGPT account, not per tab — a large
  `POOL_SIZE` can hit them faster.
