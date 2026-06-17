#!/usr/bin/env node
// cardart.mjs — HTML→Playwright 카드아트 파이프라인 (API 키·로그인 불필요, 결정적)
//
// gen-cards.mjs(CDP/ChatGPT)의 대안: 카드 앞면을 자체완결 HTML로 렌더 →
// Playwright headless 스크린샷 → media/generated/cards/<slug>.png 저장 →
// data/card-images.json 에 { itemId: webPath } 매핑 등록.
//
// 사용법:
//   node src/cardart.mjs [--limit=N] [--rarity=...] [--kind=...] [--id=...]
//                        [--force] [--dry-run] [--out=dir] [--help]
//
// 멱등: 같은 카드 + 같은 데이터 → 같은 PNG (타임스탬프/난수 텍스트 미포함).
// playwright 는 optionalDependency. 부재 시 친절히 안내 후 종료(서버 zero-dep 불변식 유지).

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const dataDir = join(root, "data");
const indexPath = join(dataDir, "index.json");
const cardImagesPath = join(dataDir, "card-images.json");

// ── CLI 파싱 (gen-cards.mjs 관례) ──────────────────────────────
function parseArgs(argv) {
  const a = { limit: Infinity, rarity: null, kind: null, id: null, force: false, dryRun: false, out: null };
  for (const arg of argv) {
    const m = /^--([\w-]+)(?:=(.*))?$/.exec(arg);
    if (!m) continue;
    const [, k, v] = m;
    if (k === "limit") a.limit = Math.max(0, parseInt(v, 10) || 0);
    else if (k === "rarity") a.rarity = v;
    else if (k === "kind") a.kind = v;
    else if (k === "id") a.id = v;
    else if (k === "out") a.out = v;
    else if (k === "force") a.force = true;
    else if (k === "dry-run") a.dryRun = true;
    else if (k === "help") a.help = true;
  }
  return a;
}

function printHelp() {
  console.log(`카드아트 파이프라인 — HTML→Playwright 스크린샷 (결정적, 키 불필요)

사용법:
  node src/cardart.mjs [옵션]

옵션:
  --limit=N      생성할 카드 수 제한 (기본: 전체)
  --rarity=R     레어도 필터 (legendary|epic|rare|uncommon|common)
  --kind=K       종류 필터 (skill|agent|mcp)
  --id=ID        특정 카드 ID 하나만
  --force        이미 아트가 있어도 재생성
  --dry-run      선정 대상만 출력하고 생성 안 함
  --out=DIR      출력 디렉토리 (기본: media/generated/cards)
  --help         이 도움말

예:
  node src/cardart.mjs --limit=5
  node src/cardart.mjs --rarity=legendary --force
  node src/cardart.mjs --id=marketplaces/.../code-reviewer.md`);
}

// ── 파일명 슬러그 (server.mjs imgSlug 와 동일 규칙) ──────────────
function imgSlug(s) {
  return String(s || "asset").toLowerCase().replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "asset";
}
// id 전체를 안정적 파일명으로 (이름 충돌 방지 위해 id 기반)
function idSlug(id) {
  return imgSlug(String(id).replace(/\//g, "-"));
}

// ── BLACK-ORCHID 등급색 (client RARITY_CONFIG 와 일치) ──────────
const RARITY = {
  legendary: { ko: "S-CLASS", color: "#e8b84b", glow: "#e8b84b" },
  epic: { ko: "A-CLASS", color: "#b88cf5", glow: "#b88cf5" },
  rare: { ko: "B-CLASS", color: "#5ec8e8", glow: "#5ec8e8" },
  uncommon: { ko: "C-CLASS", color: "#58d68b", glow: "#58d68b" },
  common: { ko: "D-CLASS", color: "#7e948b", glow: "#3df5a5" },
};
const KIND_LABEL = { skill: "SKILL", agent: "AGENT", mcp: "MODULE" };
const STAT_LABELS = [
  ["power", "파워"],
  ["popularity", "인기"],
  ["freshness", "신선도"],
  ["clarity", "명확도"],
  ["weight", "무게"],
];

function esc(s) {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

// ── 카드 1장 HTML (인라인 CSS, 외부 네트워크 0, system-ui 폰트) ───
// 512x768, 다크 BLACK-ORCHID 배경 + 등급 프레임/글로우, name·kind 뱃지·
// 레어도 프레임·스탯 바·태그 칩·코스트 보석.
function cardHtml(item) {
  const r = RARITY[item.rarity] || RARITY.common;
  const kind = KIND_LABEL[item.kind] || (item.kind || "").toUpperCase();
  const name = esc(item.displayName || item.name || "?");
  const score = Math.round(item.score ?? 0);
  const cost = item.cost ?? 0;
  const tags = (item.tags || []).slice(0, 4);
  const stats = STAT_LABELS.map(([k, label]) => ({
    label,
    v: Math.max(0, Math.min(100, Math.round((item.stats && item.stats[k]) || 0))),
  }));
  // 이니셜 엠블럼 (이미지 없이 식별성) — 이름 첫 2글자
  const initials = esc((item.name || "?").replace(/[^A-Za-z0-9가-힣]/g, "").slice(0, 2).toUpperCase() || "?");

  const tagChips = tags.map((t) => `<span class="chip">${esc(t)}</span>`).join("");
  const statRows = stats
    .map(
      (s) => `
      <div class="stat">
        <span class="stat-label">${s.label}</span>
        <span class="stat-bar"><i style="width:${s.v}%"></i></span>
        <span class="stat-val">${s.v}</span>
      </div>`
    )
    .join("");

  return `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html,body { background:transparent; }
  .card {
    position:relative; width:512px; height:768px; overflow:hidden;
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans KR", sans-serif;
    color:#d7e5de;
    background:
      radial-gradient(120% 80% at 50% -10%, ${r.color}22, transparent 60%),
      radial-gradient(90% 60% at 50% 120%, ${r.glow}18, transparent 60%),
      linear-gradient(160deg, #0f1614 0%, #0a0f0d 55%, #050807 100%);
    border:2px solid ${r.color};
    border-radius:22px;
    box-shadow: inset 0 0 0 1px #1c2b26, inset 0 0 60px ${r.color}14, 0 0 24px ${r.glow}30;
  }
  /* 상단 헤더: kind 뱃지 + 레어도 + 코스트 보석 */
  .top { display:flex; align-items:center; justify-content:space-between; padding:18px 20px 12px; }
  .kind { font-size:13px; letter-spacing:.22em; font-weight:700; color:#7e948b; }
  .rarity { font-size:13px; letter-spacing:.18em; font-weight:800; color:${r.color}; }
  .gem {
    position:relative; width:54px; height:54px; flex:none;
    display:grid; place-items:center; border-radius:14px;
    background:linear-gradient(150deg, ${r.color}, ${r.color}66);
    box-shadow: 0 0 18px ${r.glow}66, inset 0 0 0 2px #050807aa;
    color:#050807; font-weight:900; font-size:20px;
    transform:rotate(45deg);
  }
  .gem b { transform:rotate(-45deg); display:block; }
  /* 아트 영역: 엠블럼 */
  .art {
    margin:8px 20px 0; height:300px; border-radius:16px;
    border:1px solid #1c2b26;
    background:
      radial-gradient(60% 60% at 50% 40%, ${r.color}33, transparent 70%),
      repeating-linear-gradient(45deg, #0d1310 0 14px, #0a0f0d 14px 28px);
    display:grid; place-items:center; position:relative; overflow:hidden;
  }
  .art::after {
    content:""; position:absolute; inset:0;
    background:linear-gradient(180deg, transparent 60%, #050807cc);
  }
  .emblem {
    font-size:120px; font-weight:900; letter-spacing:-.04em;
    color:${r.color}; text-shadow:0 0 30px ${r.glow}88; z-index:1;
    font-family: "Times New Roman", Georgia, serif;
  }
  /* 이름 + 종류 */
  .name {
    padding:16px 22px 4px; font-size:30px; line-height:1.1; font-weight:800;
    color:#eaf3ee; letter-spacing:-.01em; word-break:break-word;
  }
  .score-line { padding:0 22px 8px; font-size:12px; color:#7e948b; letter-spacing:.14em; }
  .score-line b { color:${r.color}; }
  /* 스탯 바 */
  .stats { padding:6px 22px 8px; display:flex; flex-direction:column; gap:7px; }
  .stat { display:flex; align-items:center; gap:10px; font-size:12px; }
  .stat-label { width:54px; color:#7e948b; flex:none; }
  .stat-bar { flex:1; height:8px; border-radius:6px; background:#15201c; overflow:hidden; }
  .stat-bar i { display:block; height:100%; background:linear-gradient(90deg, ${r.glow}, ${r.color}); }
  .stat-val { width:24px; text-align:right; color:#d7e5de; font-variant-numeric:tabular-nums; }
  /* 태그 칩 */
  .chips { display:flex; flex-wrap:wrap; gap:6px; padding:10px 22px 20px; }
  .chip {
    font-size:11px; padding:4px 10px; border-radius:999px;
    border:1px solid ${r.color}55; color:#c9d8d0; background:${r.color}10;
    letter-spacing:.04em;
  }
  .footer {
    position:absolute; bottom:0; left:0; right:0; height:6px;
    background:linear-gradient(90deg, transparent, ${r.color}, transparent);
  }
</style></head>
<body>
  <div class="card" id="card">
    <div class="top">
      <span class="kind">${esc(kind)}</span>
      <span class="rarity">${r.ko}</span>
      <span class="gem"><b>${cost}</b></span>
    </div>
    <div class="art"><div class="emblem">${initials}</div></div>
    <div class="name">${name}</div>
    <div class="score-line">종합 점수 <b>${score}</b> · COST ${cost}</div>
    <div class="stats">${statRows}</div>
    <div class="chips">${tagChips}</div>
    <div class="footer"></div>
  </div>
</body></html>`;
}

async function loadIndex() {
  if (!existsSync(indexPath)) {
    console.error("❌ data/index.json 이 없습니다. 먼저 `npm run scan` 을 실행하세요.");
    process.exit(1);
  }
  return JSON.parse(await readFile(indexPath, "utf8"));
}
async function loadCardImages() {
  try { return JSON.parse(await readFile(cardImagesPath, "utf8")); } catch { return {}; }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { printHelp(); return; }

  const index = await loadIndex();
  const existing = await loadCardImages();
  const outDir = args.out ? join(root, args.out) : join(root, "media", "generated", "cards");

  // ── 대상 선정 ──
  let items = index.items.slice();
  if (args.id) items = items.filter((it) => it.id === args.id);
  if (args.kind) items = items.filter((it) => it.kind === args.kind);
  if (args.rarity) items = items.filter((it) => it.rarity === args.rarity);
  // 이미 아트가 있는 카드 스킵(--force 시 무시). item.image(스캔/외부) 또는 매핑 존재.
  if (!args.force) items = items.filter((it) => !it.image && !existing[it.id]);
  // 안정적 정렬(멱등): score desc, id asc
  items.sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || String(a.id).localeCompare(String(b.id)));
  if (Number.isFinite(args.limit)) items = items.slice(0, args.limit);

  if (items.length === 0) {
    console.log("생성할 대상이 없습니다. (필터를 바꾸거나 --force 를 사용하세요)");
    return;
  }

  console.log(`대상 ${items.length}장 → ${outDir}`);
  if (args.dryRun) {
    for (const it of items) console.log(`  [${it.rarity}] ${it.kind} · ${it.name}  (${it.id})`);
    console.log("--dry-run: 생성하지 않고 종료.");
    return;
  }

  // ── playwright 지연 로드 (부재 시 안내) ──
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    console.error(`
❌ playwright 가 설치되어 있지 않습니다. 카드아트 생성은 optional 기능입니다.
   설치:  npm install   (optionalDependencies 에 playwright 포함)
   브라우저 바이너리:  npx playwright install chromium
   서버/스캐너는 playwright 없이도 정상 동작합니다(zero-dep 불변식).`);
    process.exit(2);
  }

  await mkdir(outDir, { recursive: true });
  let browser;
  try {
    browser = await chromium.launch();
  } catch (e) {
    console.error(`
❌ chromium 브라우저를 실행하지 못했습니다: ${e.message}
   바이너리 설치:  npx playwright install chromium`);
    process.exit(2);
  }

  const map = await loadCardImages();
  const generated = [];
  try {
    const page = await browser.newPage({ viewport: { width: 512, height: 768 }, deviceScaleFactor: 2 });
    for (const it of items) {
      const slug = idSlug(it.id);
      const file = join(outDir, `${slug}.png`);
      const webPath = `/media/generated/cards/${slug}.png`;
      await page.setContent(cardHtml(it), { waitUntil: "load" });
      const el = await page.$("#card");
      await el.screenshot({ path: file });
      map[it.id] = webPath;
      generated.push({ id: it.id, name: it.name, file, webPath });
      console.log(`  ✓ ${it.name}  →  ${webPath}`);
    }
  } finally {
    await browser.close();
  }

  // ── 매핑 등록 (server.mjs 가 /api/index 에서 병합) ──
  await mkdir(dataDir, { recursive: true });
  await writeFile(cardImagesPath, JSON.stringify(map, null, 2), "utf8");
  console.log(`\n완료: ${generated.length}장 생성 · data/card-images.json 갱신`);
}

main().catch((e) => { console.error(e); process.exit(1); });
