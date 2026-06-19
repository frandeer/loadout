# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Loadout is a personal manager for Claude Code **skills · agents · MCP servers**, presented as a looter-shooter loadout game (Destiny/Apex metaphor: collect gear → build your loadout → deploy). It scans local repos of skills/agents/MCPs, scores each one into game stats + rarity, renders them as collectible gear cards in a web UI, and lets you "equip" one into `~/.claude/` with a single click so it's usable in Claude Code immediately.

Pipeline: `clone → scan → catalog (cards) → compare/dedup (AI) → equip → use`.

The codebase and almost all UI/comments are in **Korean**. Match that when editing.

## Commands

```bash
npm run scan          # node src/scan.mjs   → reads sourceRoots, writes data/index.json (idempotent)
npm start             # node src/server.mjs → SPA + action API at http://localhost:4970 (PORT env overrides)
npm run dev           # scan then start
npm run client:build  # React 클라이언트 빌드 → src/client/dist (서버가 이걸 서빙)
npm run client:dev    # Vite dev 서버(:5173) — /api는 :4970으로 프록시 (npm start 동시 실행 필요)
cd src/client && npx vitest run   # 클라이언트 단위 테스트

# Batch-generate card art (needs Chrome+login, see image generation below)
node src/gen-cards.mjs --dry-run --limit=5            # preview selection
node src/gen-cards.mjs --engine=grok --rarity=legendary --limit=10
node src/gen-cards.mjs --help
```

The **server/scanner have no build step and no dependencies** — Node built-ins only (`>=18.18`, ESM). `chrome-remote-interface` is an *optional* dependency used only for image generation. The **web client** (`src/client/`) is React 19 + Vite + Tailwind 4 + Zustand; build it once (`client:build`) before `npm start` serves a UI.

Run order matters: `data/index.json` must exist before the server serves anything useful — run `scan` first (or use `dev`). The server warns but starts without it.

## Architecture

Three layers with a strict **read/write split** (see `docs/01-architecture.md`):

1. **Scanner — `src/scan.mjs` (read-only, idempotent).** Walks `cfg.sourceRoots`, detects items, computes objective stats, dedups, groups duplicates, assigns rarity by percentile, and writes the single artifact `data/index.json`. Same input → same output (no time-dependent values leak into stats beyond git freshness). Never has side effects outside `data/`.

2. **State — `data/*.json` (gitignored).** `index.json` = full catalog (written by scan). `loadout.json` = `{ equipped: { id: {at,target} } }` (written by server on equip/unequip). These JSON files *are* the database — no DB, chosen for diff/backup/portability.

3. **Web SPA + thin server.** `src/client/` is a React 19 + Vite + Tailwind 4 + Zustand SPA (단일 라이트 테마, 디자인 토큰은 `src/client/src/index.css`). **2026-06 "컨트롤 타워" 재편 완료** — 관리 중심 4탭 IA: **대시보드(`/dashboard`, 관제탑) / 자산(`/assets`, 카탈로그+상세+AI분석) / 그래프(`/graph`, React Flow 온톨로지) / 장착·보관(`/loadout`, equip·상주→vault·삭제)**. 포지·도움말은 ⚙ 보조 메뉴. 게임보드(작전준비/Elo/역할슬롯/시너지)·OpsRoom·Team* 은 제거됨. 재편 전모·재시작 가이드는 **`docs/08-handoff.md`**(+ `07-redesign.md`). The server serves `src/client/dist` when it exists (fallback `src/web/`, 재편 이전 구 UI). `src/server.mjs` is Node's built-in `http` only (no Express) exposing action endpoints. The SPA does all rendering; the server only performs *actions* (clone, equip, verify, generate, rescan). **API contract: the server is the source of truth — `src/client/src/lib/api.ts` must match `server.mjs` routes/payloads** (e.g. unequip = `POST /api/equip {equip:false}`, sources = `/api/sources/add|remove`).

### Server endpoints (`src/server.mjs`)

- `GET /api/index` — catalog merged with current equipped flags
- `GET /api/engines` — installed AI judge CLIs (`heuristic` always present)
- `GET /api/chrome/health` — is a logged-in ChatGPT tab reachable via CDP
- `POST /api/equip {id, equip}` — see equip mechanics below
- `POST /api/verify {id, engine}` — AI-score a card, recompute score+rarity
- `POST /api/generate {prompt, imageEngine}` / `POST /api/save-slice {dataUrl}` — image workshop
- `POST /api/clone {url}` — `git clone --depth 1` a GitHub repo into `sources/<owner>__<repo>`
- `POST /api/rescan` — re-run scan.mjs and reload index

## Conventions & invariants you must preserve

- **`scan.mjs` must stay idempotent.** When adding stats/fields, derive them from content (size, frontmatter, git commit time) — not from `Date.now()` in a way that changes output run-to-run. Stat math lives in `computeStats()`; rarity is reassigned in a percentile post-pass at the bottom of the file (most items common, few legendary), *after* per-item heuristic rarity.

- **ID collision rule.** Repos all reuse names like `skills/`. Global uniqueness comes from cloning into `sources/<owner>__<repo>/` and IDs of the form `<repo>/<relative-path>`. Don't introduce IDs that aren't path-namespaced. Display uses `name` with a source badge to disambiguate.

- **Detection rules (scan).** Skill = `SKILL.md` with frontmatter. Agent = `*.md` under an `agents/` path segment, with frontmatter `name`/`description` (plain md without frontmatter is skipped). MCP = `.mcp.json`/`mcp.json` files **plus** servers registered in `~/.claude.json` / `~/.claude/settings.json` (the main MCP source — repos rarely have them).

- **Dedup vs. group are different.** Identical copies (same `kind`+`contentHash`) are collapsed to one representative (`copies`/`copySources` recorded). Same normalized name (`nameKey`, length ≥4, not a stopword) across different items sets a shared `group` for the compare UI.

- **Equip mechanics (`/api/equip`), Windows-aware.** Skills → directory **junction** into `~/.claude/skills/<owner>-<name>` (falls back to recursive copy if junction fails — Windows file symlinks need admin, junctions don't). Agents → copy the `.md` into `~/.claude/agents/`. MCP → **recorded only**, no auto-edit of `~/.claude.json` (too risky). Unequip removes the target. Paths/names are sanitized but allow Korean chars.

- **AI judge is multi-engine with fallback (`src/server.mjs`).** `/api/verify` shells out `<engine> -p "<prompt>"` for `claude`/`codex`/`gemini`/`grok` (aliases in `ENGINE_ALIASES`), expects JSON `{usefulness,dominance,quality}`, 25s timeout. If the requested engine is missing or fails, it falls back to another installed engine, then to the pure-JS `judge()` heuristic. Engine availability is probed once and cached.

- **`src/config.json` is the control surface.** `sourceRoots` (default `./skills`), `ignoreDirs`, `ccConfigCandidates`, `repoPopularity` (seeds the popularity stat), `maxScanFiles`. Add more source directories as needed; clones go to `sources/`.

## Image generation (optional subsystem)

`skills/web-image-forge/` generates card/icon/bg/logo art by driving a **logged-in Chrome via CDP** (no API keys). `lib/imagegen.js` is the dispatcher (`engine: "chatgpt"` default | `"grok"`); `lib/chrome.js` and `lib/grok.js` are the per-backend drivers; `prompts.js` builds Korean game-styled prompts; the slicer (Canvas, in `src/web/app.js` + `slicer.html`) cuts sheets into web-ready pieces saved to `media/generated/`.

Setup: `cd skills/web-image-forge && npm install`, then `.\skills\web-image-forge\launch-chrome.ps1` (debug Chrome, profile persists) and log into chatgpt.com / grok.com. If site selectors change, update the `*_SELECTOR` / `IMAGE_HOST_PATTERN` constants noted in `skills/web-image-forge/SKILL.md`.

## Design docs

`docs/` holds the brainstorming/decision record: `00-vision`, `01-architecture`, `02-data-model` (schema, stats, ID rules, rarity formula), `03-ui-design`, `04-workflows`, `05-roadmap`, `06-decisions`. Consult `02-data-model.md` before changing the item schema or stat system.
