// Design Forge · 세션 오케스트레이션 (data/forge/ 가 DB)
// 책임: 세션 CRUD, 병렬 변형 생성, A/B Elo 기록, 개선(refine), 풀 키트 내보내기.
// 생성 자체는 forge-engines.mjs(CLI/CDP)에 위임. 이 파일은 상태/파일시스템/Elo만 다룬다.
import { readFile, writeFile, mkdir, readdir, rm, rename, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildHtmlPrompt, buildImagePrompt, generateHtmlVariant, generateImageVariant,
  availableClis, STRATEGIES, STYLE_PRESETS,
} from "./forge-engines.mjs";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const forgeDir = join(root, "data", "forge");
const sessionsDir = join(forgeDir, "sessions");

const nowId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const readJson = async (p, fb) => { try { return JSON.parse(await readFile(p, "utf8")); } catch { return fb; } };
// 원자적 쓰기: 같은 디렉토리에 tmp 작성 후 rename(같은 FS에서 원자적) → 동시 읽기가 torn JSON을 보지 않음.
const writeJson = async (p, v) => {
  await mkdir(dirname(p), { recursive: true });
  const data = JSON.stringify(v, null, 2);
  const tmp = `${p}.tmp-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
  await writeFile(tmp, data, "utf8");
  try {
    await rename(tmp, p); // POSIX: 대상 존재해도 원자적 교체
  } catch (e) {
    // Windows 등 대상 존재 시 rename 실패 → 제거 후 재시도(세션 락이 동시성은 이미 차단).
    try { await rm(p, { force: true }); await rename(tmp, p); }
    catch (e2) { await rm(tmp, { force: true }).catch(() => {}); throw e2; }
  }
};

// ---------- 세션별 직렬화 뮤텍스 ----------
// 같은 세션의 meta.json read-modify-write를 순차 실행해 lost update(동시 RMW로 변경 유실)를 막는다.
// 외부 의존성 없이 in-memory promise 체인으로 구현. 다른 세션끼리는 병렬 유지.
const _sessionLocks = new Map(); // sessionId -> Promise(체인 꼬리, 절대 reject 안 함)
function withSessionLock(id, fn) {
  const prev = _sessionLocks.get(id) || Promise.resolve();
  const run = prev.then(() => fn(), () => fn()); // 이전 작업 성공/실패와 무관하게 이어서 실행
  const tail = run.then(() => {}, () => {});     // 다음 작업의 선행(에러 삼킴)
  _sessionLocks.set(id, tail);
  // 체인이 모두 끝나면 Map 정리(메모리 누수 방지).
  tail.then(() => { if (_sessionLocks.get(id) === tail) _sessionLocks.delete(id); });
  return run; // 호출자에는 fn의 결과/에러를 그대로 전달
}
// 락 보호 하의 meta.json RMW. mutator(meta)가 meta를 변형하면 원자적으로 저장. 세션 없으면 null.
async function updateMeta(id, mutator) {
  return withSessionLock(id, async () => {
    const meta = await readJson(metaPath(id), null);
    if (!meta) return null;
    const r = mutator(meta);
    await writeJson(metaPath(id), meta);
    return r === undefined ? meta : r;
  });
}

function sessDir(id) { return join(sessionsDir, id); }
function metaPath(id) { return join(sessDir(id), "meta.json"); }
function variantsDir(id) { return join(sessDir(id), "variants"); }
function matchesPath(id) { return join(sessDir(id), "matches.json"); }
function outputDir(id) { return join(sessDir(id), "output"); }
// 변형 산출물의 웹 경로(서버가 /data 정적 서빙) — 새로고침해도 접근 가능.
function variantWebPath(sessionId, file) { return `/data/forge/sessions/${sessionId}/variants/${file}`; }

// ---------- 기본 생성 매트릭스(8 변형) ----------
// HTML 4(CLI) + 이미지 4(CDP). 사용자 config로 덮어쓸 수 있다.
export function defaultMatrix() {
  return [
    { kind: "html", engine: "claude", strategy: "detailed", style: "frontend" },
    { kind: "html", engine: "codex", strategy: "detailed", style: "taste" },
    { kind: "html", engine: "gemini", strategy: "reference", style: "reference" },
    { kind: "html", engine: "claude", strategy: "system", style: "soft" },
    { kind: "image", engine: "chatgpt", style: "frontend" },
    { kind: "image", engine: "grok", style: "taste" },
    { kind: "image", engine: "google", style: "soft" },        // 드라이버 미구현 → graceful 실패
    { kind: "image2html", engine: "chatgpt", strategy: "detailed", style: "reference" },
  ];
}

// ---------- 세션 CRUD ----------
export async function ensureForge() { await mkdir(sessionsDir, { recursive: true }); }

export async function listSessions() {
  await ensureForge();
  const ids = await readdir(sessionsDir).catch(() => []);
  const out = [];
  for (const id of ids) {
    const m = await readJson(metaPath(id), null);
    if (m) out.push({ id: m.id, title: m.title, status: m.status, createdAt: m.createdAt, variantCount: (m.variants || []).length });
  }
  out.sort((a, b) => b.createdAt - a.createdAt);
  return out;
}

export async function createSession({ title, prompt, matrix, style }) {
  await ensureForge();
  if (!prompt || !prompt.trim()) throw new Error("prompt(디자인 설명)가 필요합니다.");
  const id = nowId();
  // 매트릭스에 세션 공통 style이 있으면 비어있는 항목에 채워준다.
  const plan = (Array.isArray(matrix) && matrix.length ? matrix : defaultMatrix())
    .map((m) => ({ ...m, style: m.style || style }));
  const meta = {
    id,
    title: (title || prompt).trim().slice(0, 120),
    prompt: prompt.trim(),
    createdAt: Date.now(),
    status: "created",      // created | generating | ready | error
    matrix: plan,
    variants: [],           // 변형 메타 배열(아래 스키마)
  };
  await writeJson(metaPath(id), meta);
  await mkdir(variantsDir(id), { recursive: true });
  await writeJson(matchesPath(id), { matches: [], elo: {} });
  return meta;
}

export async function getSession(id) {
  const meta = await readJson(metaPath(id), null);
  if (!meta) return null;
  const matches = await readJson(matchesPath(id), { matches: [], elo: {} });
  return { ...meta, matches };
}

export async function deleteSession(id) {
  const d = sessDir(id);
  if (existsSync(d)) await rm(d, { recursive: true, force: true });
  return { ok: true };
}

// ---------- 변형 메타 스키마 헬퍼 ----------
// { id, sessionId, kind, engine, strategy, style, prompt, status, file, fileSize,
//   generatedAt, generationTimeMs, elo, wins, losses, error, derivedFrom }
function newVariant(sessionId, spec) {
  return {
    id: nowId(), sessionId,
    kind: spec.kind, engine: spec.engine, strategy: spec.strategy || null, style: spec.style || null,
    prompt: null, status: "pending",
    file: null, fileSize: 0, generatedAt: null, generationTimeMs: 0,
    elo: 1500, wins: 0, losses: 0, error: null, derivedFrom: spec.derivedFrom || null,
  };
}

async function patchVariant(sessionId, variantId, patch) {
  // 락 보호 RMW — 풀 워커들이 동시에 같은 meta.json을 변형해도 직렬화되어 유실/손상 없음.
  return updateMeta(sessionId, (meta) => {
    const v = (meta.variants || []).find((x) => x.id === variantId);
    if (v) Object.assign(v, patch);
  });
}

// 한 변형을 실제 생성(엔진 위임 후 산출물 저장 + 메타 갱신).
async function runVariant(sessionId, variant, intent) {
  await patchVariant(sessionId, variant.id, { status: "running" });
  const vdir = variantsDir(sessionId);
  await mkdir(vdir, { recursive: true });
  try {
    if (variant.kind === "html") {
      const prompt = buildHtmlPrompt({ intent, strategy: variant.strategy, style: variant.style });
      const r = await generateHtmlVariant({ engine: variant.engine, prompt });
      if (!r.ok) return patchVariant(sessionId, variant.id, { status: "error", error: r.error, engine: r.engine, generationTimeMs: r.timeMs, prompt });
      const file = `${variant.id}.html`;
      await writeFile(join(vdir, file), r.html, "utf8");
      const sz = (await stat(join(vdir, file))).size;
      return patchVariant(sessionId, variant.id, {
        status: "done", engine: r.engine, prompt,
        file: variantWebPath(sessionId, file), fileSize: sz,
        generatedAt: Date.now(), generationTimeMs: r.timeMs,
      });
    }

    if (variant.kind === "image") {
      const prompt = buildImagePrompt({ intent, style: variant.style, engine: variant.engine });
      const r = await generateImageVariant({ engine: variant.engine, prompt, outDir: vdir });
      if (!r.ok) return patchVariant(sessionId, variant.id, { status: "error", error: r.error, engine: r.engine, generationTimeMs: r.timeMs, prompt });
      // 첫 산출물을 변형 id 파일명으로 정규화.
      const first = r.files[0];
      const ext = (first.filename.split(".").pop() || "png").toLowerCase();
      const file = `${variant.id}.${ext}`;
      const dest = join(vdir, file);
      await rm(dest, { force: true });
      await rename(first.path, dest);
      const sz = (await stat(dest)).size;
      return patchVariant(sessionId, variant.id, {
        status: "done", engine: r.engine, prompt,
        file: variantWebPath(sessionId, file), fileSize: sz,
        generatedAt: Date.now(), generationTimeMs: r.timeMs,
      });
    }

    if (variant.kind === "image2html") {
      // 1) 이미지 생성 → 2) 같은 의도를 CLI로 HTML 구현(이미지에서 영감받은 디자인).
      const imgPrompt = buildImagePrompt({ intent, style: variant.style, engine: variant.engine });
      const img = await generateImageVariant({ engine: variant.engine, prompt: imgPrompt, outDir: vdir });
      let refNote = "";
      let imgFile = null;
      if (img.ok && img.files[0]) {
        const ext = (img.files[0].filename.split(".").pop() || "png").toLowerCase();
        imgFile = `${variant.id}-ref.${ext}`;
        await rm(join(vdir, imgFile), { force: true });
        await rename(img.files[0].path, join(vdir, imgFile));
        refNote = "A reference design image was generated for this brief; reproduce its overall layout, mood, and color direction in clean semantic HTML/CSS.";
      } else {
        refNote = "Implement the brief directly as polished HTML/CSS.";
      }
      const prompt = buildHtmlPrompt({ intent, strategy: variant.strategy, style: variant.style, reference: refNote });
      const r = await generateHtmlVariant({ engine: "claude", prompt });
      if (!r.ok) return patchVariant(sessionId, variant.id, { status: "error", error: r.error, generationTimeMs: r.timeMs, prompt });
      const file = `${variant.id}.html`;
      await writeFile(join(vdir, file), r.html, "utf8");
      const sz = (await stat(join(vdir, file))).size;
      return patchVariant(sessionId, variant.id, {
        status: "done", engine: `${variant.engine}→html`, prompt,
        file: variantWebPath(sessionId, file), fileSize: sz,
        refImage: imgFile ? variantWebPath(sessionId, imgFile) : null,
        generatedAt: Date.now(), generationTimeMs: r.timeMs,
      });
    }

    return patchVariant(sessionId, variant.id, { status: "error", error: `알 수 없는 kind: ${variant.kind}` });
  } catch (e) {
    return patchVariant(sessionId, variant.id, { status: "error", error: e.message });
  }
}

// 동시성 풀 — N개 워커가 큐를 비울 때까지.
async function pool(items, conc, worker) {
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(conc, items.length) }, async () => {
    while (cursor < items.length) { const it = items[cursor++]; await worker(it); }
  }));
}

/**
 * 변형 병렬 생성 시작. 변형 메타를 즉시 기록(status: pending)하고, 백그라운드 풀로 채운다.
 * HTTP 응답을 막지 않도록 await 하지 않고 반환(서버 프로세스가 살아있는 한 계속 진행).
 * @returns 생성 계획(변형 메타 배열)
 */
export async function startGeneration(id, { concurrency = 3 } = {}) {
  const meta = await readJson(metaPath(id), null);
  if (!meta) throw new Error("세션 없음");
  if (meta.status === "generating") return { already: true, variants: meta.variants };

  const variants = (meta.matrix || defaultMatrix()).map((spec) => newVariant(id, spec));
  await updateMeta(id, (m) => { m.variants = variants; m.status = "generating"; });

  // 백그라운드 실행 — 완료를 기다리지 않음.
  pool(variants, concurrency, (v) => runVariant(id, v, meta.prompt))
    .then(() => updateMeta(id, (m) => {
      const anyDone = (m.variants || []).some((v) => v.status === "done");
      m.status = anyDone ? "ready" : "error";
    }))
    .catch(() => {});

  return { already: false, variants };
}

// 진행 상태(폴링용). { status, total, done, error, pending, variants }
export async function getStatus(id) {
  const meta = await readJson(metaPath(id), null);
  if (!meta) return null;
  const vs = meta.variants || [];
  return {
    status: meta.status,
    total: vs.length,
    done: vs.filter((v) => v.status === "done").length,
    error: vs.filter((v) => v.status === "error").length,
    pending: vs.filter((v) => v.status === "pending" || v.status === "running").length,
    variants: vs,
  };
}

// ---------- Elo (design-system src/lib/elo.ts 차용, K=32) ----------
const K = 32;
function expectedScore(a, b) { return 1 / (1 + Math.pow(10, (b - a) / 400)); }
function updateElo(ra, rb, result) {
  const ea = expectedScore(ra, rb);
  return { a: Math.round(ra + K * (result - ea)), b: Math.round(rb + K * ((1 - result) - (1 - ea))) };
}

/**
 * A/B 비교 결과 기록 + Elo 업데이트. result: 1=A승, 0=B승, 0.5=무.
 */
export async function recordMatch(id, { variantA, variantB, result, timeMs }) {
  // meta+matches RMW 전체를 세션 락 안에서 — 동시 기록 시 Elo lost update/파일 손상 방지.
  return withSessionLock(id, async () => {
    const meta = await readJson(metaPath(id), null);
    if (!meta) throw new Error("세션 없음");
    const va = (meta.variants || []).find((v) => v.id === variantA);
    const vb = (meta.variants || []).find((v) => v.id === variantB);
    if (!va || !vb) throw new Error("비교 대상 변형을 찾을 수 없음");
    const res = result === 1 || result === 0 || result === 0.5 ? result : 0.5;

    const { a, b } = updateElo(va.elo ?? 1500, vb.elo ?? 1500, res);
    va.elo = a; vb.elo = b;
    if (res === 1) { va.wins++; vb.losses++; }
    else if (res === 0) { vb.wins++; va.losses++; }
    await writeJson(metaPath(id), meta);

    const mm = await readJson(matchesPath(id), { matches: [], elo: {} });
    mm.matches.push({ variantA, variantB, result: res, timeMs: timeMs || 0, at: Date.now() });
    mm.elo[variantA] = a; mm.elo[variantB] = b;
    await writeJson(matchesPath(id), mm);
    return { variantA: { id: variantA, elo: a }, variantB: { id: variantB, elo: b } };
  });
}

// 다음 비교쌍 추천 — done 변형 중 비교 횟수가 가장 적은 둘(또는 elo 인접).
export async function nextMatchup(id) {
  const meta = await readJson(metaPath(id), null);
  if (!meta) return null;
  const live = (meta.variants || []).filter((v) => v.status === "done");
  if (live.length < 2) return null;
  const mm = await readJson(matchesPath(id), { matches: [], elo: {} });
  const count = {};
  for (const v of live) count[v.id] = 0;
  for (const m of mm.matches) { count[m.variantA] = (count[m.variantA] || 0) + 1; count[m.variantB] = (count[m.variantB] || 0) + 1; }
  // 비교가 적은 변형 우선, 그다음 elo 근접도.
  const sorted = [...live].sort((x, y) => (count[x.id] - count[y.id]) || (y.elo - x.elo));
  const a = sorted[0];
  const seen = new Set(mm.matches.filter((m) => m.variantA === a.id || m.variantB === a.id)
    .map((m) => (m.variantA === a.id ? m.variantB : m.variantA)));
  const b = sorted.slice(1).find((v) => !seen.has(v.id)) || sorted[1];
  return { variantA: a, variantB: b };
}

// ---------- 개선(refine) ----------
// 선택 변형을 기반으로 개선 지시를 더해 새 변형 1개 생성(파생).
export async function refine(id, { variantId, instructions }) {
  const meta = await readJson(metaPath(id), null);
  if (!meta) throw new Error("세션 없음");
  const base = (meta.variants || []).find((v) => v.id === variantId);
  if (!base) throw new Error("기준 변형 없음");

  const intent = `${meta.prompt}\n\n## Refinement\nImprove on the previous direction with these changes: ${instructions || "tighten spacing, sharpen hierarchy, refine color"}.`;
  const spec = { kind: "html", engine: base.kind === "image" ? "claude" : (base.engine || "claude").replace("→html", ""), strategy: base.strategy || "detailed", style: base.style, derivedFrom: variantId };
  const variant = newVariant(id, spec);
  // 변형 추가는 락 보호 RMW로. (이후 runVariant는 내부 patchVariant가 락을 잡으므로 여기서 락을 들고 있으면 재진입 교착 → 락 밖에서 실행.)
  await updateMeta(id, (m) => { (m.variants || (m.variants = [])).push(variant); m.status = "generating"; });

  // 즉시 동기 생성(단일이라 빠름) 후 상태 정리.
  await runVariant(id, variant, intent);
  await updateMeta(id, (m) => { m.status = (m.variants || []).some((v) => v.status === "done") ? "ready" : "error"; });
  const fresh = (await readJson(metaPath(id), null))?.variants?.find((v) => v.id === variant.id);
  return fresh;
}

// ---------- 풀 키트 내보내기 ----------
// 선택 변형(기본: Elo 1위 HTML)에서 DESIGN.md + variables.css + example.html 생성.
export async function exportKit(id, { variantId } = {}) {
  const meta = await readJson(metaPath(id), null);
  if (!meta) throw new Error("세션 없음");
  const htmlVariants = (meta.variants || []).filter((v) => v.status === "done" && v.file && v.file.endsWith(".html"));
  if (!htmlVariants.length) throw new Error("내보낼 HTML 변형이 없습니다(이미지 변형만으로는 키트를 만들 수 없음).");
  const chosen = (variantId && htmlVariants.find((v) => v.id === variantId))
    || [...htmlVariants].sort((a, b) => b.elo - a.elo)[0];

  const vdir = variantsDir(id);
  const fileName = chosen.file.split("/").pop();
  const html = await readFile(join(vdir, fileName), "utf8").catch(() => "");
  const tokens = extractTokens(html);

  const odir = outputDir(id);
  await mkdir(odir, { recursive: true });

  const variablesCss = renderVariablesCss(tokens);
  const designMd = renderDesignMd(meta, chosen, tokens);
  await writeFile(join(odir, "variables.css"), variablesCss, "utf8");
  await writeFile(join(odir, "DESIGN.md"), designMd, "utf8");
  await writeFile(join(odir, "example.html"), html, "utf8");

  const webBase = `/data/forge/sessions/${id}/output`;
  return {
    ok: true, chosenId: chosen.id,
    files: {
      designMd: `${webBase}/DESIGN.md`,
      variablesCss: `${webBase}/variables.css`,
      exampleHtml: `${webBase}/example.html`,
    },
    tokens,
  };
}

// HTML에서 색상/폰트/커스텀 프로퍼티를 추출(가벼운 정규식 기반).
function extractTokens(html) {
  const colors = new Set();
  for (const m of html.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) colors.add(m[0].toLowerCase());
  for (const m of html.matchAll(/(?:rgb|hsl)a?\([^)]+\)/g)) colors.add(m[0].replace(/\s+/g, ""));
  const vars = {};
  for (const m of html.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) vars[m[1]] = m[2].trim();
  const fonts = new Set();
  for (const m of html.matchAll(/font-family\s*:\s*([^;}{]+)[;}]/g)) fonts.add(m[1].trim());
  return {
    colors: [...colors].slice(0, 24),
    fonts: [...fonts].slice(0, 6),
    customProps: vars,
  };
}

function renderVariablesCss(tokens) {
  const lines = [":root {"];
  const props = Object.entries(tokens.customProps);
  if (props.length) {
    lines.push("  /* 추출된 디자인 토큰 */");
    for (const [k, v] of props) lines.push(`  ${k}: ${v};`);
  } else {
    lines.push("  /* HTML에 CSS 변수가 없어 색상 팔레트를 토큰화 */");
    tokens.colors.forEach((c, i) => lines.push(`  --color-${i + 1}: ${c};`));
  }
  if (tokens.fonts.length) {
    lines.push("");
    tokens.fonts.forEach((f, i) => lines.push(`  --font-${i + 1}: ${f};`));
  }
  lines.push("}");
  return lines.join("\n") + "\n";
}

function renderDesignMd(meta, chosen, tokens) {
  const palette = tokens.colors.length
    ? tokens.colors.map((c) => `- \`${c}\``).join("\n")
    : "_(추출된 색상 없음)_";
  const fonts = tokens.fonts.length ? tokens.fonts.map((f) => `- ${f}`).join("\n") : "_(추출된 폰트 없음)_";
  const props = Object.entries(tokens.customProps);
  const propBlock = props.length ? props.map(([k, v]) => `- \`${k}\`: \`${v}\``).join("\n") : "_(CSS 변수 없음 — variables.css에서 색상 토큰 생성)_";
  return [
    `# DESIGN.md — ${meta.title}`,
    "",
    `> Design Forge 세션 \`${meta.id}\` 에서 내보냄. 기준 변형: \`${chosen.id}\` (${chosen.engine}, ${chosen.strategy || "-"}/${chosen.style || "-"}, Elo ${chosen.elo}).`,
    "",
    "## 브리프",
    meta.prompt,
    "",
    "## 색상 팔레트",
    palette,
    "",
    "## 타이포그래피",
    fonts,
    "",
    "## 디자인 토큰",
    propBlock,
    "",
    "## 산출물",
    "- `variables.css` — CSS 커스텀 프로퍼티(이 디렉토리)",
    "- `example.html` — 선택된 변형의 전체 HTML",
    "",
    "## 재현 가이드",
    `이 디자인은 \`${chosen.engine}\` 엔진 + \`${chosen.strategy}\` 전략 + \`${chosen.style}\` 스타일 프리셋으로 생성되었습니다. ` +
    "동일 방향을 유지하려면 위 토큰과 팔레트를 새 컴포넌트의 기준으로 사용하세요.",
    "",
  ].join("\n");
}

// 서버에서 엔진/전략/스타일 메타를 UI에 노출하기 위한 헬퍼.
export async function forgeCapabilities() {
  const clis = await availableClis();
  return {
    clis,                                  // 설치된 CLI(claude/codex/gemini/grok)
    strategies: STRATEGIES,
    styles: Object.entries(STYLE_PRESETS).map(([k, v]) => ({ key: k, label: v.label })),
    imageEngines: ["chatgpt", "grok", "google"],
  };
}
