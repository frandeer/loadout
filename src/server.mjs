// Loadout 로컬 서버 — 정적 SPA 서빙 + 행동 API(장착/검증/이미지생성/슬라이스/clone/rescan).
// Node 내장 http만 사용. 이미지 생성은 skills/web-image-forge/lib(CDP)를 지연 로드.
import { createServer } from "node:http";
import { readFile, writeFile, stat, mkdir, symlink, cp, rm, rename, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, resolve, join, dirname, basename, sep } from "node:path";
import { homedir } from "node:os";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadRoots, loadSources, absRoot, addRoot, removeRoot, addRepo, ensureSourcesFile } from "./sources.mjs";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const clientDist = join(root, "src/client/dist");
const webDir = existsSync(clientDist) ? clientDist : join(root, "src/web");
const dataDir = join(root, "data");
const mediaDir = join(root, "media");
const port = Number(process.env.PORT || 4970);
const claudeHome = join(homedir(), ".claude");

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".svg": "image/svg+xml", ".ico": "image/x-icon" };

const json = (res, code, val) => { res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" }); res.end(JSON.stringify(val)); };
async function body(req) { const c = []; for await (const ch of req) c.push(ch); return JSON.parse(Buffer.concat(c).toString("utf8") || "{}"); }

let INDEX = null;
async function loadIndex() { INDEX = JSON.parse(await readFile(join(dataDir, "index.json"), "utf8")); return INDEX; }
async function loadout() { try { return JSON.parse(await readFile(join(dataDir, "loadout.json"), "utf8")); } catch { return { equipped: {} }; } }
async function saveLoadout(lo) { await mkdir(dataDir, { recursive: true }); await writeFile(join(dataDir, "loadout.json"), JSON.stringify(lo, null, 2)); }
// gen-cards.mjs가 생성한 { itemId: "/media/generated/cards/xxx.png" } 매핑
const cardImagesPath = join(dataDir, "card-images.json");
async function cardImages() { try { return JSON.parse(await readFile(cardImagesPath, "utf8")); } catch { return {}; } }
// 아이템 id/이름 → 안정적이고 알아보기 쉬운 파일명 슬러그(스킬 이름과 동일시되는 파일명)
function imgSlug(s) {
  return String(s || "asset").toLowerCase().replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "asset";
}
// 생성/슬라이스한 이미지를 카드와 영구 연결 → 새로고침해도 유지(/api/index가 병합).
async function setCardImage(id, webPath) {
  if (!id || !webPath) return;
  const map = await cardImages();
  map[id] = webPath;
  await mkdir(dataDir, { recursive: true });
  await writeFile(cardImagesPath, JSON.stringify(map, null, 2), "utf8");
  if (INDEX) { const it = INDEX.items.find((x) => x.id === id); if (it) it.image = webPath; } // 메모리 인덱스 즉시 반영
}
// 한국어 번역본(별도 관리) — { [id]: { name, description, at, engine } }. 원문은 건드리지 않음.
const translationsPath = join(dataDir, "translations.json");
async function loadTranslations() { try { return JSON.parse(await readFile(translationsPath, "utf8")); } catch { return {}; } }
async function saveTranslations(t) { await mkdir(dataDir, { recursive: true }); await writeFile(translationsPath, JSON.stringify(t, null, 2)); }

// id → 실제 파일 경로 찾기. 우선 item.source.root, 없으면 관리 루트 순회.
function resolveItemPath(item, roots) {
  const cands = item.source?.root ? [item.source.root, ...(roots || loadRoots())] : (roots || loadRoots());
  for (const rp of cands) {
    const p = resolve(rp, item.source.path);
    if (existsSync(p)) return p;
  }
  return null;
}
// 항목이 이미 ~/.claude 안에 있나(= 설치/활성 상태)
function isInstalled(item) {
  const r = item.source?.root ? absRoot(item.source.root) : null;
  if (r && r.startsWith(claudeHome)) return true;
  if (item.source?.repo === "cc-config" || item.source?.fromCc) return true;
  return false;
}

const clamp = (n) => Math.max(0, Math.min(99, Math.round(n)));

// ---------- 멀티 엔진 AI judge: claude / codex / gemini / grok (-p) ----------
// 모두 `<engine> -p "<prompt>"` 헤드리스 호출을 가정. 엔진별 가용성 1회 캐시.
const ENGINES = ["claude", "codex", "gemini", "grok"];
const ENGINE_ALIASES = { agy: "gemini", google: "gemini", openai: "codex", xai: "grok", anthropic: "claude" };
const _engineAvail = new Map(); // engine -> boolean
function normEngine(e) {
  const k = (e || "claude").toLowerCase();
  return ENGINE_ALIASES[k] || (ENGINES.includes(k) ? k : "claude");
}
async function checkEngineAvailable(engine) {
  if (_engineAvail.has(engine)) return _engineAvail.get(engine);
  const ok = await new Promise((resolve) => {
    const cmd = process.platform === "win32" ? "where" : "which";
    const p = spawn(cmd, [engine], { stdio: "ignore", shell: true });
    p.on("close", (code) => resolve(code === 0));
    p.on("error", () => resolve(false));
    setTimeout(() => { try { p.kill(); } catch {} resolve(false); }, 3000);
  });
  _engineAvail.set(engine, ok);
  console.log(`[judge] ${engine} CLI ${ok ? "발견됨 ✓" : "없음"}`);
  return ok;
}
// 모듈 로드 시 모든 엔진 가용성 비동기 탐지(결과 기다리지 않음)
for (const e of ENGINES) checkEngineAvailable(e).catch(() => {});
async function availableEngines() {
  const out = [];
  for (const e of ENGINES) if (await checkEngineAvailable(e)) out.push(e);
  return out;
}

// ---------- 휴리스틱 judge ----------
function judge(item, group) {
  const s = item.stats || {};
  const usefulness = clamp(0.55 * (s.clarity ?? 50) + 0.45 * (s.power ?? 50));
  let dominance = 60;
  if (group && group.length > 1) {
    const max = Math.max(...group.map((g) => g.score));
    dominance = clamp(50 + (item.score - max) * 1.4 + (item.score >= max ? 25 : 0));
  } else dominance = clamp(40 + (s.popularity ?? 50) * 0.3);
  const newScore = clamp(item.score * 0.7 + usefulness * 0.3);
  let rarity = item.rarity;
  if (newScore >= 88) rarity = "legendary"; else if (newScore >= 74) rarity = "epic";
  return { verdict: { usefulness, dominance, quality: clamp((usefulness + (s.clarity ?? 50)) / 2) }, score: newScore, rarity };
}

// ---------- AI judge — 멀티 엔진 -p 어댑터 ----------
// 요청 엔진(claude/codex/gemini/grok)을 헤드리스로 호출해 0~99 점수를 얻는다.
// 요청 엔진이 없으면 사용 가능한 다른 엔진으로, 그래도 없으면 휴리스틱 fallback.
async function aiJudge(item, group, reqEngine) {
  if ((reqEngine || "").toLowerCase() === "heuristic")
    return { ...judge(item, group), engine: "heuristic" };
  let engine = normEngine(reqEngine);
  if (!(await checkEngineAvailable(engine))) {
    const others = await availableEngines();
    if (others.length === 0) return { ...judge(item, group), engine: "heuristic" };
    engine = others[0]; // 요청 엔진 없으면 가용한 첫 엔진으로 대체
  }

  const prompt =
    `당신은 Claude Code의 skill/agent/MCP 카드를 평가하는 전문가입니다.\n` +
    `아래 카드 정보를 바탕으로 세 가지 점수를 0~99 정수로 평가해 주세요.\n\n` +
    `카드 정보:\n` +
    `- 이름: ${item.name || "(없음)"}\n` +
    `- 종류: ${item.kind || "(없음)"}\n` +
    `- 설명: ${item.description || "(없음)"}\n` +
    `- 점수(기존): ${item.score ?? 50}\n` +
    `- 통계: ${JSON.stringify(item.stats || {})}\n\n` +
    `평가 기준:\n` +
    `- usefulness: 실제 작업에서 얼마나 유용한가\n` +
    `- dominance: 같은 카테고리에서 얼마나 독보적인가\n` +
    `- quality: 구현 품질과 완성도\n\n` +
    `반드시 JSON만 출력하세요. 예시: {"usefulness":82,"dominance":60,"quality":78}`;

  // 프롬프트는 runEngine이 stdin으로 전달(Windows 멀티라인 인자 잘림 회피).
  const output = await runEngine(engine, prompt, 25000);
  let verdict = null;
  if (output != null) {
    const parsed = parseJsonObject(output);
    if (parsed) {
      verdict = {
        usefulness: clamp(Number(parsed.usefulness) || 50),
        dominance: clamp(Number(parsed.dominance) || 50),
        quality: clamp(Number(parsed.quality) || 50),
      };
    }
  }

  if (!verdict) {
    // 엔진 호출 실패 → 휴리스틱 fallback
    return { ...judge(item, group), engine: "heuristic" };
  }

  // 점수/rarity 재계산
  const newScore = clamp(item.score * 0.4 + verdict.usefulness * 0.35 + verdict.quality * 0.25);
  let rarity = item.rarity;
  if (newScore >= 88) rarity = "legendary"; else if (newScore >= 74) rarity = "epic";
  return { verdict, score: newScore, rarity, engine };
}

// ---------- 한국어 번역 (멀티 엔진 -p) ----------
// 원문은 보존하고, 별도 저장소(translations.json)에 한국어 번역본만 적재한다.
const TRANSLATE_TIMEOUT = 90000;

// 엔진 헤드리스 호출. 프롬프트는 stdin으로 전달한다 — Windows에서 shell을 거치는
// multi-line `-p "..."` 인자가 첫 줄에서 잘리는 문제를 피하기 위함(stdout 텍스트 반환, 실패시 null).
function runEngine(engine, prompt, timeoutMs) {
  return new Promise((resolve) => {
    let output = "", settled = false;
    const done = (v) => { if (!settled) { settled = true; resolve(v); } };
    let proc;
    try { proc = spawn(engine, ["-p"], { stdio: ["pipe", "pipe", "ignore"], shell: process.platform === "win32" }); }
    catch { return done(null); }
    proc.stdout.on("data", (c) => { output += c.toString("utf8"); });
    proc.on("close", () => done(output));
    proc.on("error", () => done(null));
    try { proc.stdin.write(prompt); proc.stdin.end(); } catch {}
    const timer = setTimeout(() => { try { proc.kill(); } catch {} done(null); }, timeoutMs);
    proc.on("close", () => clearTimeout(timer));
  });
}

// 코드펜스/잡텍스트를 걷어내고 최외곽 { ... } 한 덩어리를 JSON으로 파싱.
function parseJsonObject(output) {
  try {
    const stripped = (output || "").replace(/```[\w]*\n?/g, "").trim();
    const s = stripped.indexOf("{"), e = stripped.lastIndexOf("}");
    if (s < 0 || e <= s) return null;
    return JSON.parse(stripped.slice(s, e + 1));
  } catch { return null; }
}

function buildTranslatePrompt(items) {
  const lines = items.map((it, i) =>
    `${i + 1}) name: ${JSON.stringify(it.name || "")}\n   description: ${JSON.stringify((it.description || "").slice(0, 500))}`
  ).join("\n");
  return (
    `당신은 Claude Code의 skill/agent/MCP 카드 정보를 자연스러운 한국어로 번역하는 전문 번역가입니다.\n` +
    `아래 각 항목의 name과 description을 한국어로 번역하세요.\n` +
    `규칙:\n` +
    `- 고유명사/제품명(Claude Code, MCP, API, git, React, GitHub 등)과 코드·명령·식별자는 번역하지 말 것.\n` +
    `- name은 간결하게, description은 원문 의미를 보존하되 읽기 쉬운 한국어로.\n` +
    `- 원문이 비어 있으면 빈 문자열로 두세요.\n` +
    `반드시 JSON만 출력하세요. 형식: {"1":{"name":"...","description":"..."},"2":{"name":"...","description":"..."}}\n\n` +
    `항목:\n${lines}`
  );
}

// 항목 배열을 번역. 큰 JSON 한 방 호출은 엔진 타임아웃에 걸리므로,
// "항목당 1회 호출"(검증된 안정 경로)을 동시성 풀(CONC개)로 돌려 빠르고 견고하게 처리한다.
// {ok, engine, translations:{id:{name,description}}, failed:number}
const TRANSLATE_CONCURRENCY = 3;
async function translateItems(items, reqEngine) {
  let engine = normEngine(reqEngine === "heuristic" ? null : reqEngine); // heuristic은 번역 불가 → 실엔진
  if (!(await checkEngineAvailable(engine))) {
    const others = await availableEngines();
    if (!others.length) return { ok: false, error: "번역 가능한 AI 엔진(claude/codex/gemini/grok)이 설치되어 있지 않습니다." };
    engine = others[0];
  }
  const translations = {};
  let failed = 0;
  const translateOne = async (it) => {
    const raw = await runEngine(engine, buildTranslatePrompt([it]), TRANSLATE_TIMEOUT);
    const parsed = raw == null ? null : parseJsonObject(raw);
    const t = parsed && (parsed["1"] || parsed[1]);
    if (t && (t.name || t.description)) {
      translations[it.id] = {
        name: (t.name || "").toString().slice(0, 200),
        description: (t.description || "").toString().slice(0, 600),
      };
    } else { failed++; }
  };
  // 동시성 풀: CONC개의 워커가 큐를 비울 때까지 항목을 가져가 번역.
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(TRANSLATE_CONCURRENCY, items.length) }, async () => {
      while (cursor < items.length) { const it = items[cursor++]; await translateOne(it); }
    })
  );
  if (!Object.keys(translations).length) return { ok: false, error: `${engine} 번역 실패(타임아웃/파싱) — 모든 항목 실패`, engine };
  return { ok: true, engine, translations, failed };
}

// scan.mjs 재실행 + 인덱스 리로드(소스 추가/삭제/클론/rescan 공용).
async function runScan() {
  const code = await new Promise((r) =>
    spawn(process.execPath, [join(root, "src/scan.mjs")], { stdio: "ignore" }).on("close", r));
  if (code === 0) await loadIndex();
  return code === 0;
}

// ---------- 라우트 ----------
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${port}`);
    const path = url.pathname;

    // --- GET API ---
    if (req.method === "GET" && path === "/api/index") {
      const idx = INDEX || (await loadIndex());
      // 독립적인 디스크 읽기 3개 — 병렬로(순차 await 제거).
      const [lo, cardImgs, tr] = await Promise.all([loadout(), cardImages(), loadTranslations()]);
      for (const it of idx.items) {
        it.equipped = !!lo.equipped[it.id];
        if (!it.image && cardImgs[it.id]) it.image = cardImgs[it.id]; // 생성된 카드아트 병합
        const t = tr[it.id];                                          // 한국어 번역본(별도 관리) 병합
        it.nameKo = t?.name || null;
        it.descKo = t?.description || null;
        it.translated = !!t;
        it.installed = isInstalled(it);                              // 이미 ~/.claude 안에 있나
      }
      return json(res, 200, idx);
    }
    if (req.method === "GET" && path === "/api/content") {
      // 선택한 자산의 원본 파일 전체 내용을 반환(상세보기/더보기 GitBook 팝업용).
      // index.json 은 가볍게 유지하고, 본문은 디스크에서 그때그때 읽어 항상 최신.
      const idx = INDEX || (await loadIndex());
      const id = url.searchParams.get("id");
      const item = idx.items.find((i) => i.id === id);
      if (!item) return json(res, 404, { ok: false, error: "item 없음" });
      // MCP 는 실제 본문 파일이 없는 경우가 많음 → 정의(JSON)를 본문처럼 표시.
      if (item.kind === "mcp") {
        const def = item.meta?.def || item.source?.path || "";
        const md = `# ${item.name}\n\n\`\`\`json\n${JSON.stringify(item.meta || {}, null, 2)}\n\`\`\``;
        return json(res, 200, { ok: true, id, name: item.name, kind: "mcp", content: md, path: item.source?.path || null });
      }
      const file = resolveItemPath(item, loadRoots());
      if (!file) return json(res, 404, { ok: false, error: "원본 파일을 찾을 수 없습니다.", path: item.source?.path || null });
      const content = await readFile(file, "utf8").catch(() => null);
      if (content == null) return json(res, 500, { ok: false, error: "파일 읽기 실패" });
      return json(res, 200, { ok: true, id, name: item.name, kind: item.kind, content, path: item.source?.path || null });
    }
    if (req.method === "GET" && path === "/api/chrome/health") {
      try {
        const urlObj = new URL(req.url, "http://localhost");
        const engine = urlObj.searchParams.get("engine") === "grok" ? "grok" : "chatgpt";
        if (engine === "grok") {
          const { findGrokTarget } = await import("../skills/web-image-forge/lib/grok.js");
          const t = await findGrokTarget({}).catch(() => null);
          return json(res, 200, { connected: !!t, url: t?.url ?? null });
        } else {
          const { findChatGPTTarget } = await import("../skills/web-image-forge/lib/chrome.js");
          const t = await findChatGPTTarget({}).catch(() => null);
          return json(res, 200, { connected: !!t, url: t?.url ?? null });
        }
      } catch (e) { return json(res, 200, { connected: false, error: e.message }); }
    }
    if (req.method === "GET" && path === "/api/engines") {
      // AI 검증에 쓸 수 있는 엔진 목록(설치된 CLI). 항상 heuristic 포함.
      const avail = await availableEngines();
      return json(res, 200, { engines: ["heuristic", ...avail], all: ENGINES });
    }
    if (req.method === "GET" && path === "/api/sources") {
      // 스킬을 가져오는 소스 루트 목록(폴더/clone된 repo) + 루트별 항목 수.
      await ensureSourcesFile();
      const s = loadSources();
      const idx = INDEX || (await loadIndex());
      const byRoot = {};
      for (const it of idx.items) {
        const k = it.source?.root ? absRoot(it.source.root) : "(기타)";
        byRoot[k] = (byRoot[k] || 0) + 1;
      }
      const roots = s.roots.map((rp) => {
        const abs = absRoot(rp);
        return { path: abs, exists: existsSync(abs), count: byRoot[abs] || 0, claude: abs.startsWith(claudeHome) };
      });
      return json(res, 200, { roots, repos: s.repos || [], total: idx.total });
    }

    // --- POST API ---
    if (req.method === "POST" && path === "/api/equip") {
      let b;
      try { b = await body(req); }
      catch { return json(res, 400, { ok: false, error: "요청 본문 파싱 실패 — JSON 형식을 확인해 주세요." }); }
      const idx = INDEX || (await loadIndex());
      const item = idx.items.find((i) => i.id === b.id);
      if (!item) return json(res, 404, { ok: false, error: "item 없음" });
      const lo = await loadout();
      if (b.equip === false) {
        const t = lo.equipped[b.id]?.target;
        if (t && existsSync(t)) await rm(t, { recursive: true, force: true }).catch(() => {});
        delete lo.equipped[b.id]; await saveLoadout(lo);
        return json(res, 200, { ok: true, equipped: false });
      }
      // 이미 ~/.claude 안에 있는 항목은 설치된 상태 → 장착(자기 자신으로의 정션) 방지.
      if (isInstalled(item)) return json(res, 200, { ok: true, equipped: false, installed: true, note: "이미 ~/.claude 에 설치되어 있어 바로 사용 가능합니다." });
      const srcPath = resolveItemPath(item);
      if (!srcPath) return json(res, 400, { ok: false, error: "소스 파일을 찾지 못함" });
      let target;
      try {
        if (item.kind === "skill") {
          const dir = dirname(srcPath);
          const safe = `${item.source.owner}-${item.name}`.replace(/[^\w가-힣.-]/g, "_");
          await mkdir(join(claudeHome, "skills"), { recursive: true });
          target = join(claudeHome, "skills", safe);
          if (existsSync(target)) await rm(target, { recursive: true, force: true });
          try { await symlink(dir, target, "junction"); }
          catch { await cp(dir, target, { recursive: true }); }
        } else if (item.kind === "agent") {
          const safe = `${item.source.owner}-${item.name}`.replace(/[^\w가-힣.-]/g, "_") + ".md";
          await mkdir(join(claudeHome, "agents"), { recursive: true });
          target = join(claudeHome, "agents", safe);
          await cp(srcPath, target);
        } else {
          // MCP는 ~/.claude.json 자동수정 위험 → 기록만 (안내)
          lo.equipped[b.id] = { at: Date.now(), target: null, note: "MCP는 수동 설정 권장" };
          await saveLoadout(lo);
          return json(res, 200, { ok: true, equipped: true, target: "(MCP는 안내만 — 수동 설정 권장)" });
        }
      } catch (e) { return json(res, 500, { ok: false, error: "장착 실패: " + e.message }); }
      lo.equipped[b.id] = { at: Date.now(), target }; await saveLoadout(lo);
      return json(res, 200, { ok: true, equipped: true, target });
    }

    if (req.method === "POST" && path === "/api/translate") {
      let b;
      try { b = await body(req); }
      catch { return json(res, 400, { ok: false, error: "요청 본문 파싱 실패 — JSON 형식을 확인해 주세요." }); }
      const idx = INDEX || (await loadIndex());
      let ids = Array.isArray(b.ids) ? b.ids : (b.id ? [b.id] : []);
      ids = ids.slice(0, 16); // 한 호출당 배치 상한(엔진 타임아웃 보호)
      const tr = await loadTranslations();
      let items = ids.map((id) => idx.items.find((i) => i.id === id)).filter(Boolean);
      if (!b.force) items = items.filter((it) => !tr[it.id]); // 이미 번역된 건 스킵(force로 재번역)
      if (!items.length) return json(res, 200, { ok: true, translations: {}, count: 0, skipped: true });
      const r = await translateItems(items, b.engine);
      if (!r.ok) return json(res, 200, { ok: false, error: r.error, engine: r.engine });
      const at = Date.now();
      for (const [id, v] of Object.entries(r.translations)) tr[id] = { ...v, at, engine: r.engine };
      await saveTranslations(tr);
      // 메모리 인덱스에도 즉시 반영(다음 /api/index 없이도 일관).
      for (const it of idx.items) {
        const t = tr[it.id];
        if (t) { it.nameKo = t.name; it.descKo = t.description; it.translated = true; }
      }
      return json(res, 200, { ok: true, engine: r.engine, translations: r.translations, count: Object.keys(r.translations).length });
    }

    if (req.method === "POST" && path === "/api/sources/add") {
      let b;
      try { b = await body(req); }
      catch { return json(res, 400, { ok: false, error: "요청 본문 파싱 실패 — JSON 형식을 확인해 주세요." }); }
      if (!b.path?.trim()) return json(res, 400, { ok: false, error: "추가할 폴더 경로가 필요합니다." });
      let added;
      try { added = await addRoot(b.path.trim()); }
      catch (e) { return json(res, 400, { ok: false, error: e.message }); }
      const ok = await runScan(); // 실시간 반영: 추가 즉시 재스캔
      return json(res, ok ? 200 : 500, { ok, added, total: INDEX?.total });
    }

    if (req.method === "POST" && path === "/api/sources/remove") {
      let b;
      try { b = await body(req); }
      catch { return json(res, 400, { ok: false, error: "요청 본문 파싱 실패 — JSON 형식을 확인해 주세요." }); }
      if (!b.path?.trim()) return json(res, 400, { ok: false, error: "삭제할 폴더 경로가 필요합니다." });
      const removed = await removeRoot(b.path.trim());
      const ok = await runScan();
      return json(res, ok ? 200 : 500, { ok, removed, total: INDEX?.total });
    }

    if (req.method === "POST" && path === "/api/verify") {
      let b;
      try { b = await body(req); }
      catch { return json(res, 400, { ok: false, error: "요청 본문 파싱 실패 — JSON 형식을 확인해 주세요." }); }
      const idx = INDEX || (await loadIndex());
      const item = idx.items.find((i) => i.id === b.id);
      if (!item) return json(res, 404, { ok: false, error: "item 없음" });
      const group = item.group ? idx.items.filter((i) => i.group === item.group) : null;
      // aiJudge: 요청 엔진(claude/codex/gemini/grok) -p 채점, 없으면 휴리스틱 fallback
      const r = await aiJudge(item, group, b.engine);
      item.verdict = r.verdict; item.score = r.score; item.rarity = r.rarity;
      return json(res, 200, { ok: true, verdict: r.verdict, score: r.score, rarity: r.rarity, engine: r.engine });
    }

    if (req.method === "POST" && path === "/api/save-slice") {
      const b = await body(req);
      const m = /^data:image\/(png|jpeg|webp);base64,(.+)$/.exec(b.dataUrl || "");
      if (!m) return json(res, 400, { ok: false, error: "dataUrl 형식 오류" });
      const ext = m[1] === "jpeg" ? "jpg" : m[1];
      // itemId가 오면 스킬 이름과 동일시되는 안정적 파일명으로 저장하고 카드에 영구 연결.
      const name = (b.itemId ? `card-${imgSlug(b.itemId)}` : (b.name || `slice-${Date.now()}`).replace(/[^\w.-]/g, "_")) + "." + ext;
      const dir = join(mediaDir, "generated"); await mkdir(dir, { recursive: true });
      await writeFile(join(dir, name), Buffer.from(m[2], "base64"));
      const webPath = `/media/generated/${name}`;
      if (b.itemId) await setCardImage(b.itemId, webPath);
      return json(res, 200, { ok: true, url: webPath });
    }

    if (req.method === "POST" && path === "/api/generate") {
      let b;
      try { b = await body(req); }
      catch { return json(res, 400, { ok: false, error: "요청 본문 파싱 실패 — JSON 형식을 확인해 주세요." }); }
      if (!b.prompt?.trim()) return json(res, 400, { ok: false, error: "prompt 필드가 필요합니다." });
      // 디스패처로 ChatGPT/Grok 선택 생성. 저장 경로(outDir)는 항상 media/generated 로 고정.
      let gen;
      try { ({ generate: gen } = await import("../skills/web-image-forge/lib/imagegen.js")); }
      catch (e) { return json(res, 503, { ok: false, error: "이미지 모듈 로드 실패(npm i chrome-remote-interface): " + e.message }); }
      const engine = (b.imageEngine || "chatgpt").toLowerCase() === "grok" ? "grok" : "chatgpt";
      const outDir = join(mediaDir, "generated");
      try {
        const files = await gen({ engine, prompt: b.prompt, count: b.expectedCount || 1, outDir });
        const images = files.map((f) => ({ url: `/media/generated/${f.filename}` }));
        // itemId가 오면 첫 이미지를 스킬 이름 파일명으로 바꿔 카드에 영구 연결 → 새로고침해도 유지.
        if (b.itemId && files.length) {
          const ext = (files[0].filename.split(".").pop() || "png").toLowerCase();
          const name = `card-${imgSlug(b.itemId)}.${ext}`;
          const destPath = join(outDir, name);
          await rm(destPath, { force: true });          // 재생성 시 기존 파일 교체(Windows rename EEXIST 회피)
          await rename(files[0].path, destPath);
          const webPath = `/media/generated/${name}`;
          images[0] = { url: webPath };
          await setCardImage(b.itemId, webPath);
        }
        return json(res, 200, { ok: images.length > 0, engine, images });
      } catch (e) {
        const hint = e.code === "NO_CHATGPT_TAB" || e.code === "NO_GROK_TAB"
          ? `${engine === "grok" ? "grok.com" : "chatgpt.com"} 탭이 없습니다 — launch-chrome 실행 후 로그인하세요.`
          : "이미지 생성 실패: " + e.message;
        return json(res, 503, { ok: false, engine, error: hint });
      }
    }

    if (req.method === "POST" && path === "/api/clone") {
      let b;
      try { b = await body(req); }
      catch { return json(res, 400, { ok: false, error: "요청 본문 파싱 실패 — JSON 형식을 확인해 주세요." }); }
      const m = /github\.com[/:]([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/.exec(b.url || "");
      if (!m) return json(res, 400, { ok: false, error: "GitHub URL 형식 오류 — 예: https://github.com/owner/repo" });
      const dest = join(root, "sources", `${m[1]}__${m[2]}`);
      if (existsSync(dest)) return json(res, 409, { ok: false, error: "이미 존재합니다. 삭제 후 다시 시도하거나 rescan을 실행하세요." });
      await mkdir(join(root, "sources"), { recursive: true });
      const cloneCode = await new Promise((resolve, reject) => {
        const proc = spawn("git", ["clone", "--depth", "1", b.url, dest], { stdio: "ignore" });
        proc.on("close", resolve);
        proc.on("error", (e) => reject(e));
        setTimeout(() => { try { proc.kill(); } catch {} reject(new Error("git clone 타임아웃 (60초 초과)")); }, 60000);
      }).catch((e) => { throw new Error("git clone 실패: " + e.message); });
      if (cloneCode !== 0) return json(res, 500, { ok: false, error: "git clone 실패 — URL을 확인하거나 네트워크 연결을 점검해 주세요." });
      // 실시간 반영: 클론한 폴더를 소스로 등록하고 즉시 재스캔.
      await addRepo(b.url, dest);
      const ok = await runScan();
      return json(res, ok ? 200 : 500, { ok, dest, total: INDEX?.total });
    }

    if (req.method === "POST" && path === "/api/rescan") {
      const ok = await runScan();
      return ok ? json(res, 200, { ok: true, total: INDEX.total }) : json(res, 500, { ok: false, error: "scan 실패" });
    }

    if (req.method !== "GET") return json(res, 405, { ok: false, error: "method not allowed" });

    // --- 정적 파일 ---
    let rel = decodeURIComponent(path);
    let fileBase = webDir;
    if (rel.startsWith("/data/")) { fileBase = root; }
    else if (rel.startsWith("/media/")) { fileBase = root; }
    else if (rel === "/") rel = "/index.html";
    const filePath = rel.startsWith("/data/") || rel.startsWith("/media/")
      ? join(root, rel) : join(webDir, rel);
    if (!filePath.startsWith(root)) { res.writeHead(403); return res.end("forbidden"); }
    if (!existsSync(filePath) || (await stat(filePath)).isDirectory()) { res.writeHead(404); return res.end("not found"); }
    const ext = extname(filePath).toLowerCase();
    // 개발용 로컬 도구 — JS/CSS/HTML이 브라우저 캐시에 묶여 옛 코드가 도는 일을 막는다.
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(await readFile(filePath));
  } catch (e) { json(res, 500, { ok: false, error: e.message }); }
});

await ensureSourcesFile().catch(() => {}); // data/sources.json 시드 고정(관리 UI 노출용)
await loadIndex().catch(() => console.warn("⚠️ index.json 없음 — 먼저 node src/scan.mjs 실행"));
server.listen(port, () => console.log(`🎒 Loadout: http://localhost:${port}`));
