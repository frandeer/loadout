// Loadout 로컬 서버 — 정적 SPA 서빙 + 행동 API(장착/검증/이미지생성/슬라이스/clone/rescan).
// Node 내장 http만 사용. 이미지 생성은 skills/web-image-forge/lib(CDP)를 지연 로드.
import { createServer } from "node:http";
import { readFile, writeFile, stat, mkdir, symlink, cp, rm, rename, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, resolve, join, dirname, basename, sep } from "node:path";
import { homedir } from "node:os";
import { spawn, execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadRoots, loadSources, absRoot, addRoot, removeRoot, addRepo, ensureSourcesFile } from "./sources.mjs";
import * as forge from "./forge.mjs";
import { collectUsage } from "./usage.mjs";
import { generateDrop, dropsDir } from "./drop.mjs";

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
// 사용량(경험치) 캐시 — { "<이름 소문자>": 횟수 }. 시작 시 data/usage.json 로드, 없으면 빈 객체.
// /api/usage/refresh 가 collectUsage()로 갱신하고, /api/index 병합부에서 it.uses 로 부여.
let USAGE = {};
async function loadUsage() { try { USAGE = JSON.parse(await readFile(join(dataDir, "usage.json"), "utf8")).counts || {}; } catch { USAGE = {}; } return USAGE; }
async function loadout() { try { return JSON.parse(await readFile(join(dataDir, "loadout.json"), "utf8")); } catch { return { equipped: {} }; } }
async function saveLoadout(lo) { await mkdir(dataDir, { recursive: true }); await writeFile(join(dataDir, "loadout.json"), JSON.stringify(lo, null, 2)); }
// 팀 프리셋: { teams: { id: { name, slots: {role: itemId|null}, at } } } — 작전 준비 화면이 사용.
async function loadTeams() { try { return JSON.parse(await readFile(join(dataDir, "teams.json"), "utf8")); } catch { return { teams: {} }; } }
async function saveTeams(t) { await mkdir(dataDir, { recursive: true }); await writeFile(join(dataDir, "teams.json"), JSON.stringify(t, null, 2)); }
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

// ---------- 멀티 엔진 -p 공용 헬퍼 (verify / team-verify / drop 공유) ----------
// 시도 순서: 요청 엔진(가용시) → 나머지 가용 엔진. 없으면 빈 배열(→ 호출부가 휴리스틱 폴백).
async function resolveEngineOrder(reqEngine) {
  const reqNorm = normEngine(reqEngine);
  if (await checkEngineAvailable(reqNorm)) {
    const others = (await availableEngines()).filter((e) => e !== reqNorm);
    return [reqNorm, ...others];
  }
  return await availableEngines();
}
// 엔진 순서대로 프롬프트를 -p 헤드리스 호출. 각 엔진 지수 백오프 재시도(1초→2초, 최대 2회).
// JSON 파싱 성공 시 { parsed, engine }, 전부 실패 시 null.
async function aiJsonWithFallback(prompt, engineOrder, timeoutMs = 25000) {
  for (const eng of engineOrder) {
    for (let attempt = 0; attempt <= 2; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 1000 * attempt)); // 1초, 2초 백오프
      const output = await runEngine(eng, prompt, timeoutMs); // 프롬프트는 stdin 전달(Windows 멀티라인 인자 잘림 회피)
      const parsed = output == null ? null : parseJsonObject(output);
      if (parsed) return { parsed, engine: eng };
    }
  }
  return null;
}

// ---------- AI judge — 멀티 엔진 -p 어댑터 ----------
// 요청 엔진(claude/codex/gemini/grok)을 헤드리스로 호출해 0~99 점수를 얻는다.
// 요청 엔진이 없으면 사용 가능한 다른 엔진으로, 그래도 없으면 휴리스틱 fallback.
async function aiJudge(item, group, reqEngine) {
  if ((reqEngine || "").toLowerCase() === "heuristic")
    return { ...judge(item, group), engine: "heuristic" };
  const engineOrder = await resolveEngineOrder(reqEngine);
  if (engineOrder.length === 0) return { ...judge(item, group), engine: "heuristic" };

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

  const r = await aiJsonWithFallback(prompt, engineOrder, 25000);
  if (!r) return { ...judge(item, group), engine: "heuristic" }; // 모든 엔진 실패 → 휴리스틱 fallback
  const verdict = {
    usefulness: clamp(Number(r.parsed.usefulness) || 50),
    dominance: clamp(Number(r.parsed.dominance) || 50),
    quality: clamp(Number(r.parsed.quality) || 50),
  };
  // 점수/rarity 재계산
  const newScore = clamp(item.score * 0.4 + verdict.usefulness * 0.35 + verdict.quality * 0.25);
  let rarity = item.rarity;
  if (newScore >= 88) rarity = "legendary"; else if (newScore >= 74) rarity = "epic";
  return { verdict, score: newScore, rarity, engine: r.engine };
}

// ---------- 팀 단위 AI 평가 (POST /api/team/verify) ----------
// 서버측 특성/역할 — 클라이언트 lib/traits.ts의 축약본. 아이템은 scan.mjs가 부여한 tags(특성 key)를 신뢰.
const TEAM_TRAITS = ["build", "recon", "audit", "archive", "memory", "deploy", "plan", "auto", "git", "vision"];
const TEAM_ROLES = [
  { key: "analyst", affinity: ["audit", "memory"] },
  { key: "scout", affinity: ["recon", "vision"] },
  { key: "builder", affinity: ["build", "plan"] },
  { key: "appraiser", affinity: ["audit", "archive"] },
  { key: "enforcer", affinity: ["deploy", "auto", "git"] },
];
const LINK_THRESHOLDS = [2, 4, 6];
const MANA_BUDGET = 24000;
const clamp100 = (n) => Math.max(0, Math.min(100, Math.round(n))); // 팀 점수는 0~100 스케일

// 순수 JS 휴리스틱: coverage=역할 커버리지, synergy=발동 링크 단계, balance=마나 예산 대비 적정성.
function heuristicTeamEval(members, scenario) {
  if (!members.length)
    return { total: 0, scores: { coverage: 0, synergy: 0, balance: 0 }, comment: "편성된 카드가 없습니다 — 카드를 배치한 뒤 평가하세요.", engine: "heuristic" };
  const tagCount = {};
  for (const m of members) for (const t of (m.tags || [])) tagCount[t] = (tagCount[t] || 0) + 1;
  // coverage: 5직제 중 멤버 적성(태그)이 닿는 역할 비율
  const coveredRoles = TEAM_ROLES.filter((r) => members.some((m) => (m.tags || []).some((t) => r.affinity.includes(t)))).length;
  const coverage = clamp100((coveredRoles / TEAM_ROLES.length) * 100);
  // synergy: 발동 링크 단계 합(특성별 2/4/6 임계치)
  let tiers = 0;
  for (const k of TEAM_TRAITS) { const c = tagCount[k] || 0; for (const th of LINK_THRESHOLDS) if (c >= th) tiers++; }
  const synergy = clamp100(Math.min(100, tiers * 25));
  // balance: 컨텍스트 비용(마나) 예산 대비 — 예산 내면 적게 쓸수록 가점, 초과면 감점
  const cost = members.reduce((s, m) => s + (m.cost || 0), 0);
  const balance = cost <= MANA_BUDGET
    ? clamp100(100 - (cost / MANA_BUDGET) * 35)
    : clamp100(Math.max(0, 65 - ((cost - MANA_BUDGET) / MANA_BUDGET) * 120));
  const total = clamp100((coverage + synergy + balance) / 3);
  const grade = total >= 75 ? "우수한" : total >= 50 ? "무난한" : "보강이 필요한";
  const comment = `휴리스틱 평가 — 역할 ${coveredRoles}/5 커버, 발동 링크 단계 ${tiers}, 컨텍스트 비용 ${cost}/${MANA_BUDGET}. 시나리오 «${scenario}» 기준 ${grade} 편성입니다.`;
  return { total, scores: { coverage, synergy, balance }, comment, engine: "heuristic" };
}

// 멀티 엔진 AI 팀 평가 — 엔진 전부 실패/부재 시 휴리스틱 폴백.
async function teamEval(members, scenario, reqEngine) {
  if (!members.length || (reqEngine || "").toLowerCase() === "heuristic")
    return heuristicTeamEval(members, scenario);
  const order = await resolveEngineOrder(reqEngine);
  if (!order.length) return heuristicTeamEval(members, scenario);
  const cardLines = members.map((m, i) =>
    `${i + 1}) [${m.kind}] ${m.name} | 특성:${(m.tags || []).join(",") || "-"} | 비용:${m.cost ?? "-"} | ${(m.description || "").slice(0, 160)}`
  ).join("\n");
  const prompt =
    `당신은 Claude Code의 skill/agent/MCP 카드로 구성된 "작전 팀"을 평가하는 전문가입니다.\n` +
    `시나리오: ${scenario}\n\n` +
    `편성 카드:\n${cardLines}\n\n` +
    `다음 3개 항목을 0~100 정수로 평가하세요.\n` +
    `- coverage: 시나리오에 필요한 역할/기능을 팀이 얼마나 폭넓게 커버하는가\n` +
    `- synergy: 카드 간 상호 보완·시너지가 얼마나 좋은가\n` +
    `- balance: 과/부족 없이 균형 잡혔는가(총 컨텍스트 비용 예산 ${MANA_BUDGET} 고려)\n` +
    `그리고 comment에 한국어로 2~3문장 총평을 작성하세요.\n` +
    `반드시 JSON만 출력하세요. 예시: {"coverage":80,"synergy":72,"balance":65,"comment":"..."}`;
  const r = await aiJsonWithFallback(prompt, order, 25000);
  if (!r) return heuristicTeamEval(members, scenario);
  const scores = {
    coverage: clamp100(Number(r.parsed.coverage) || 0),
    synergy: clamp100(Number(r.parsed.synergy) || 0),
    balance: clamp100(Number(r.parsed.balance) || 0),
  };
  const total = clamp100((scores.coverage + scores.synergy + scores.balance) / 3);
  const comment = (r.parsed.comment || "").toString().trim().slice(0, 800) || "(코멘트 없음)";
  return { total, scores, comment, engine: r.engine };
}

// ---------- 팀 Elo (POST /api/team/ab) ----------
// forge.mjs recordMatch의 Elo 수식을 팀 A/B 비교용으로 재구현(복붙 아님, 소형 헬퍼).
// result: 1=A승, 0=B승, 0.5=무. K=32 표준.
const TEAM_ELO_K = 32;
function teamExpectedScore(ra, rb) { return 1 / (1 + Math.pow(10, (rb - ra) / 400)); }
function teamUpdateElo(ra, rb, result) {
  const ea = teamExpectedScore(ra, rb);
  return { a: Math.round(ra + TEAM_ELO_K * (result - ea)), b: Math.round(rb + TEAM_ELO_K * ((1 - result) - (1 - ea))) };
}

// ---------- OMC /team 설정 변환 (POST /api/team/export-omc) ----------
const LINK_GRADES = ["브론즈", "실버", "골드"];
const TEAM_TRAIT_LABELS = { build: "구축", recon: "정찰", audit: "감찰", archive: "기록", memory: "기억", deploy: "집행", plan: "전략", auto: "자동", git: "형상", vision: "시각" };
// 작전 5직제 슬롯 → OMC canonical agent + 기본 model 티어.
const ROLE_OMC = {
  analyst: { omc: "analyst", label: "분석관", tier: "HIGH" },
  scout: { omc: "explore", label: "정찰관", tier: "MEDIUM" },
  builder: { omc: "executor", label: "구축관", tier: "MEDIUM" },
  appraiser: { omc: "code-reviewer", label: "감정관", tier: "HIGH" },
  enforcer: { omc: "executor", label: "집행관", tier: "MEDIUM" },
};
// 카드 등급/특성으로 model 티어 가중(아키텍처·검증·기억 성격이면 HIGH).
function modelTier(roleKey, item) {
  const base = ROLE_OMC[roleKey]?.tier || "MEDIUM";
  if (!item) return base;
  if (item.rarity === "legendary" || item.rarity === "epic") return "HIGH";
  const tags = item.tags || [];
  if (tags.includes("plan") || tags.includes("audit") || tags.includes("memory")) return "HIGH";
  return base;
}
// 발동된 신호 링크(특성 2/4/6 임계) — team-command.md 시너지 표기용.
function computeTeamLinks(members) {
  const counts = {};
  for (const m of members) for (const t of (m.tags || [])) counts[t] = (counts[t] || 0) + 1;
  const out = [];
  for (const k of TEAM_TRAITS) {
    const c = counts[k] || 0; if (!c) continue;
    let tier = 0; for (const th of LINK_THRESHOLDS) if (c >= th) tier++;
    if (tier > 0) out.push({ key: k, count: c, tier });
  }
  return out.sort((a, b) => b.tier - a.tier || b.count - a.count);
}
// 내보내기 디렉토리명 안전화(경로 탈출 방지, 한국어 허용).
function sanitizeExportId(s) {
  return String(s || "team").replace(/[^\w가-힣.-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 80) || "team";
}
// 슬롯 키(영문 canonical 또는 한국어 라벨) → ROLE_OMC 의 영문 키. 못 찾으면 null.
const ROLE_BY_LABEL = Object.fromEntries(Object.entries(ROLE_OMC).map(([k, v]) => [v.label, k]));
function resolveRoleKey(slotKey) {
  if (ROLE_OMC[slotKey]) return slotKey;
  if (ROLE_BY_LABEL[slotKey]) return ROLE_BY_LABEL[slotKey];
  return null;
}
const ROLE_ORDER = Object.keys(ROLE_OMC);

// teamId/team/idx/장착여부판정 → { "omc.jsonc", "team-command.md" } 문자열 생성.
function buildOmcExport(teamId, team, idx, isUsable) {
  const slots = team.slots || {};
  const teamLabel = team.name || teamId;
  // 채워진 슬롯 수집(슬롯 키는 영문 canonical 또는 한국어 라벨 모두 허용).
  const filled = [];
  for (const [slotKey, id] of Object.entries(slots)) {
    if (!id) continue;
    const roleKey = resolveRoleKey(slotKey);
    const def = roleKey ? ROLE_OMC[roleKey] : { omc: "executor", label: String(slotKey) };
    const item = idx.items.find((i) => i.id === id) || null;
    filled.push({ slotKey: String(slotKey), roleKey, id, item, omc: def.omc, label: def.label, tier: modelTier(roleKey, item) });
  }
  // 안정 정렬: 5직제 순서 → 그 외(커스텀)는 뒤로.
  const ord = (rk) => { const i = ROLE_ORDER.indexOf(rk); return i < 0 ? ROLE_ORDER.length : i; };
  filled.sort((a, b) => ord(a.roleKey) - ord(b.roleKey));

  // omc.jsonc — roleRouting: 키는 OMC canonical role(=omc agent). 같은 canonical로 합쳐지면
  // 1개 항목으로 병합(주석에 두 카드 모두, model 티어는 높은 쪽). 후행 쉼표 없이 유효 JSONC.
  const groups = []; // 등장 순서 보존
  const byOmc = new Map();
  for (const f of filled) {
    let g = byOmc.get(f.omc);
    if (!g) { g = { omc: f.omc, cards: [], tier: "MEDIUM" }; byOmc.set(f.omc, g); groups.push(g); }
    g.cards.push({ label: f.label, name: f.item ? f.item.name : "(미발견 카드)" });
    if (f.tier === "HIGH") g.tier = "HIGH";
  }
  const entries = groups.map((g, i) => {
    const comma = i < groups.length - 1 ? "," : "";
    const comment = g.cards.map((c) => `${c.label}: ${c.name}`).join(", ");
    return `      ${JSON.stringify(g.omc)}: { "agent": ${JSON.stringify(g.omc)}, "model": ${JSON.stringify(g.tier)} }${comma} // ${comment}`;
  });
  const omcJsonc =
    `// Loadout에서 내보낸 OMC 팀 설정 — «${teamLabel}» (id: ${teamId})\n` +
    `// 참고용입니다. ~/.claude 나 프로젝트 .claude/omc.jsonc 를 자동 수정하지 않습니다 — 필요한 부분만 직접 복사하세요.\n` +
    `// roleRouting 키는 OMC canonical role(analyst/explore/executor/code-reviewer 등)이며, 한국어 역할·카드명은 주석으로 표기.\n` +
    `{\n` +
    `  "team": {\n` +
    `    "roleRouting": {\n` +
    `${entries.join("\n")}\n` +
    `    }\n` +
    `  }\n` +
    `}\n`;

  // team-command.md — 실행 명령 + 편성 + 시너지 + 장착 경고.
  const omcCounts = {};
  for (const f of filled) omcCounts[f.omc] = (omcCounts[f.omc] || 0) + 1;
  const cmdSpec = Object.entries(omcCounts).map(([a, n]) => `${n}:${a}`).join(" ");
  const teamCmd = `/oh-my-claudecode:team ${cmdSpec} "여기에 작전 목표를 적으세요"`;

  const links = computeTeamLinks(filled.map((f) => f.item).filter(Boolean));
  const linkLines = links.length
    ? links.map((l) => `- ${TEAM_TRAIT_LABELS[l.key] || l.key} ${LINK_GRADES[l.tier - 1] || ""} (${l.count}장)`).join("\n")
    : "- (발동된 신호 링크 없음 — 같은 특성 카드를 2장 이상 모으면 발동)";

  const cardLines = filled.map((f) => {
    const name = f.item ? f.item.name : "(미발견)";
    const kind = f.item ? f.item.kind : "?";
    const tags = f.item && f.item.tags?.length ? f.item.tags.map((t) => TEAM_TRAIT_LABELS[t] || t).join("/") : "-";
    const eq = f.item && isUsable(f.item, f.id) ? "장착됨 ✅" : "⚠️ 미장착";
    return `- [${f.label} → ${f.omc}] ${name} (${kind}) · 특성:${tags} · ${eq}`;
  }).join("\n");

  const unequipped = filled.filter((f) => f.item && !isUsable(f.item, f.id));
  const warn = unequipped.length
    ? `\n## ⚠️ 장착 전제\n다음 카드는 아직 ~/.claude 에 장착되지 않았습니다 — 인벤토리에서 장착해야 실제 사용 가능합니다:\n${unequipped.map((f) => `- ${f.item.name}`).join("\n")}\n`
    : `\n## 장착 상태\n편성된 모든 카드가 장착(또는 설치)되어 있습니다. ✅\n`;

  const teamCommandMd =
    `# OMC 팀 출격 명령 — «${teamLabel}»\n\n` +
    `## 실행 명령\n` +
    "```\n" + teamCmd + "\n```\n" +
    `- 역할별 에이전트 매핑은 omc.jsonc 의 roleRouting 을 참고하세요.\n\n` +
    `## 편성 카드\n${cardLines}\n\n` +
    `## 발동 시너지(신호 링크)\n${linkLines}\n` +
    warn +
    `\n> 이 문서는 Loadout이 생성한 참고 자료입니다. 환경 설정을 자동 변경하지 않습니다.\n`;

  return { "omc.jsonc": omcJsonc, "team-command.md": teamCommandMd };
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

function buildContentTranslatePrompt(name, content) {
  return (
    `당신은 IT/소프트웨어 문서를 전문으로 번역하는 한국어 번역가입니다.\n` +
    `다음은 '${name}' 카드의 상세 설명 문서(Markdown 형식)입니다. 이 문서를 자연스럽고 가독성 높은 한국어로 번역해 주세요.\n\n` +
    `규칙:\n` +
    `- 마크다운 형식(헤더, 코드 블록, 목록, 굵은 글씨 등)을 그대로 유지하세요.\n` +
    `- 고유명사/기술 용어(Claude Code, git, react, npm, API 등)나 코드 조각, 명령어는 번역하지 말고 원문 그대로 두세요.\n` +
    `- 자연스럽고 친숙한 한국어 경어체로 번역해 주세요.\n` +
    `- 번역 결과만 출력하고, 다른 설명이나 메타 텍스트는 일체 생략하세요.\n\n` +
    `문서 내용:\n${content}`
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

// ---------- MCP 토글: `claude mcp` CLI 셸아웃 ----------
// 결정: ~/.claude.json 직접 수정 금지, 공식 CLI 경로만. 인자는 항상 배열로 전달(셸 문자열 조립 금지 → 인젝션 방지).
const MCP_CLI_TIMEOUT = 15000;
// MCP 서버 이름은 영문/숫자/대시로 정제(CLI 식별자 안전).
function sanitizeMcpName(s) {
  return String(s || "").trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64) || "mcp";
}
// meta.env 는 "KEY=VAL" 문자열 배열일 수 있으니 객체로 변환(claude mcp add-json 의 env 형식).
function envArrayToObject(env) {
  const out = {};
  if (Array.isArray(env)) {
    for (const e of env) {
      const s = String(e);
      const i = s.indexOf("=");
      if (i > 0) out[s.slice(0, i)] = s.slice(i + 1);
    }
  } else if (env && typeof env === "object") {
    for (const [k, v] of Object.entries(env)) out[k] = String(v);
  }
  return out;
}
// index.json 의 meta { command, args, url, env } → claude mcp add-json 페이로드 JSON 문자열.
// url 타입이면 { type:"http"|"sse", url, env }, 아니면 { command, args, env }(= stdio).
function buildMcpAddJson(meta) {
  const env = envArrayToObject(meta?.env);
  if (meta?.url) {
    const type = /\/sse\/?$/.test(meta.url) ? "sse" : "http";
    const obj = { type, url: meta.url };
    if (Object.keys(env).length) obj.env = env;
    return JSON.stringify(obj);
  }
  const obj = { command: meta?.command || "", args: Array.isArray(meta?.args) ? meta.args : [] };
  if (Object.keys(env).length) obj.env = env;
  return JSON.stringify(obj);
}
// claude CLI 를 인자 배열로 호출(셸 미경유). { ok, stdout, stderr, missing } 반환. 부재/실패/타임아웃 모두 ok:false.
function runClaudeMcp(args) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (v) => { if (!settled) { settled = true; resolve(v); } };
    let child;
    try {
      child = execFile("claude", args, { timeout: MCP_CLI_TIMEOUT, windowsHide: true }, (err, stdout, stderr) => {
        if (err) {
          const missing = err.code === "ENOENT"; // claude CLI 자체가 없음
          return done({ ok: false, missing, stdout: stdout || "", stderr: stderr || err.message });
        }
        done({ ok: true, stdout: stdout || "", stderr: stderr || "" });
      });
    } catch (e) { return done({ ok: false, missing: e.code === "ENOENT", stdout: "", stderr: e.message }); }
    child.on("error", (e) => done({ ok: false, missing: e.code === "ENOENT", stdout: "", stderr: e.message }));
  });
}

// ---------- 라우트 ----------
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${port}`);
    const path = url.pathname;

    // --- GET API ---
    if (req.method === "GET" && path === "/api/index") {
      const idx = await loadIndex();
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
        it.uses = USAGE[(it.name || "").toLowerCase()] ?? USAGE[it.nameKey] ?? 0; // 사용량(경험치): name 소문자/nameKey 매칭
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
      let content = "";
      if (item.kind === "mcp") {
        const def = item.meta?.def || item.source?.path || "";
        content = `# ${item.name}\n\n\`\`\`json\n${JSON.stringify(item.meta || {}, null, 2)}\n\`\`\``;
      } else {
        const file = resolveItemPath(item, loadRoots());
        if (!file) return json(res, 404, { ok: false, error: "원본 파일을 찾을 수 없습니다.", path: item.source?.path || null });
        content = await readFile(file, "utf8").catch(() => null);
        if (content == null) return json(res, 500, { ok: false, error: "파일 읽기 실패" });
      }
      const tr = await loadTranslations();
      const contentKo = tr[id]?.contentKo || null;
      return json(res, 200, { ok: true, id, name: item.name, kind: item.kind, content, contentKo, path: item.source?.path || null });
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
        // MCP 해제: claude mcp remove <name> -s user (CLI 부재/실패해도 기록은 제거).
        if (item.kind === "mcp") {
          const name = sanitizeMcpName(item.name);
          const r = await runClaudeMcp(["mcp", "remove", name, "-s", "user"]);
          delete lo.equipped[b.id]; await saveLoadout(lo);
          const note = r.ok ? `claude mcp remove ${name} 완료` : (r.missing ? "claude CLI 없음 — 기록만 제거됨" : `claude mcp remove 실패(기록만 제거됨): ${(r.stderr || "").slice(0, 200)}`);
          return json(res, 200, { ok: true, equipped: false, mcp: r.ok, note });
        }
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
          // MCP 장착: 공식 CLI `claude mcp add-json <name> '<json>' -s user`.
          // ~/.claude.json 직접 수정 금지. 인자는 배열로만 전달(셸 미경유 → 인젝션 방지).
          const name = sanitizeMcpName(item.name);
          const addJson = buildMcpAddJson(item.meta);
          const r = await runClaudeMcp(["mcp", "add-json", name, addJson, "-s", "user"]);
          if (r.ok) {
            lo.equipped[b.id] = { at: Date.now(), target: null, mcp: name };
            await saveLoadout(lo);
            return json(res, 200, { ok: true, equipped: true, mcp: true, note: `claude mcp add-json ${name} 완료` });
          }
          // CLI 부재/실패 → 기존 "기록만" 동작으로 폴백(인벤토리 표시 유지).
          lo.equipped[b.id] = { at: Date.now(), target: null, note: "MCP 기록만" };
          await saveLoadout(lo);
          const note = r.missing ? "claude CLI 없음 — 기록만 됨" : `claude mcp add-json 실패 — 기록만 됨: ${(r.stderr || "").slice(0, 200)}`;
          return json(res, 200, { ok: true, equipped: true, mcp: false, note });
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

    if (req.method === "POST" && path === "/api/translate-content") {
      let b;
      try { b = await body(req); }
      catch { return json(res, 400, { ok: false, error: "요청 본문 파싱 실패 — JSON 형식을 확인해 주세요." }); }
      const id = b.id;
      if (!id) return json(res, 400, { ok: false, error: "id가 필요합니다." });

      const idx = INDEX || (await loadIndex());
      const item = idx.items.find((i) => i.id === id);
      if (!item) return json(res, 404, { ok: false, error: "항목을 찾을 수 없습니다." });

      let content = "";
      if (item.kind === "mcp") {
        const def = item.meta?.def || item.source?.path || "";
        content = `# ${item.name}\n\n\`\`\`json\n${JSON.stringify(item.meta || {}, null, 2)}\n\`\`\``;
      } else {
        const file = resolveItemPath(item, loadRoots());
        if (!file) return json(res, 404, { ok: false, error: "원본 파일을 찾을 수 없습니다." });
        content = await readFile(file, "utf8").catch(() => null);
        if (content == null) return json(res, 500, { ok: false, error: "파일 읽기 실패" });
      }

      let engine = normEngine(b.engine === "heuristic" ? null : b.engine);
      if (!(await checkEngineAvailable(engine))) {
        const others = await availableEngines();
        if (!others.length) return json(res, 400, { ok: false, error: "번역 가능한 AI 엔진이 설치되어 있지 않습니다." });
        engine = others[0];
      }

      const prompt = buildContentTranslatePrompt(item.displayName || item.name, content);
      const raw = await runEngine(engine, prompt, TRANSLATE_TIMEOUT);
      if (!raw) return json(res, 500, { ok: false, error: `${engine}을 통한 본문 번역 실패(타임아웃 또는 엔진 오류)` });

      const tr = await loadTranslations();
      if (!tr[id]) {
        tr[id] = {
          name: item.nameKo || item.name,
          description: item.descKo || item.description,
          at: Date.now(),
          engine,
        };
      }
      tr[id].contentKo = raw.trim();
      tr[id].at = Date.now();
      tr[id].engine = engine;
      await saveTranslations(tr);

      // index.json item sync
      item.translated = true;
      
      return json(res, 200, { ok: true, id, contentKo: tr[id].contentKo });
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

    if (req.method === "GET" && path === "/api/teams") {
      const t = await loadTeams();
      return json(res, 200, { ok: true, teams: t.teams || {} });
    }

    if (req.method === "POST" && path === "/api/teams") {
      let b;
      try { b = await body(req); }
      catch { return json(res, 400, { ok: false, error: "요청 본문 파싱 실패 — JSON 형식을 확인해 주세요." }); }
      // 전체 교체 방식(개인용 앱이라 충돌 우려 없음): { teams: {...} }
      if (!b.teams || typeof b.teams !== "object")
        return json(res, 400, { ok: false, error: "teams 객체가 필요합니다." });
      await saveTeams({ teams: b.teams });
      return json(res, 200, { ok: true, count: Object.keys(b.teams).length });
    }

    if (req.method === "POST" && path === "/api/team/verify") {
      // 팀 단위 AI 평가. teamId가 있으면 teams.json에서 슬롯을 읽고, 없으면 slots를 직접 사용.
      let b;
      try { b = await body(req); }
      catch { return json(res, 400, { ok: false, error: "요청 본문 파싱 실패 — JSON 형식을 확인해 주세요." }); }
      const idx = INDEX || (await loadIndex());
      let slots, team = null, teams = null;
      if (b.teamId) {
        teams = await loadTeams();
        team = teams.teams?.[b.teamId];
        if (!team) return json(res, 404, { ok: false, error: "존재하지 않는 teamId 입니다." });
        slots = team.slots || {};
      } else {
        slots = (b.slots && typeof b.slots === "object") ? b.slots : {};
      }
      const ids = Object.values(slots).filter(Boolean);
      const members = ids.map((id) => idx.items.find((i) => i.id === id)).filter(Boolean);
      const scenario = (b.scenario || "").toString().trim() || "범용 코딩 작업";
      const result = await teamEval(members, scenario, b.engine);
      // teamId가 주어지면 teams.json 해당 팀에 평가 결과 영속(GET /api/teams 응답에 포함).
      if (b.teamId && team) {
        team.eval = { at: Date.now(), total: result.total, scores: result.scores, comment: result.comment, engine: result.engine, scenario };
        await saveTeams(teams);
      }
      return json(res, 200, { ok: true, result });
    }

    if (req.method === "POST" && path === "/api/team/ab") {
      // 팀 A/B 비교: 같은 시나리오로 양 팀(teams.json 저장 프리셋)을 teamEval로 평가,
      // total 비교로 승패 판정 후 Elo 갱신·영속. 계약: team-plan.md /api/team/ab (변경 금지).
      let b;
      try { b = await body(req); }
      catch { return json(res, 400, { ok: false, error: "요청 본문 파싱 실패 — JSON 형식을 확인해 주세요." }); }
      if (!b.aId || !b.bId) return json(res, 400, { ok: false, error: "aId와 bId가 필요합니다." });
      if (b.aId === b.bId) return json(res, 400, { ok: false, error: "서로 다른 두 팀을 비교하세요(aId === bId)." });
      const idx = INDEX || (await loadIndex());
      const teams = await loadTeams();
      const teamA = teams.teams?.[b.aId];
      const teamB = teams.teams?.[b.bId];
      if (!teamA) return json(res, 404, { ok: false, error: `존재하지 않는 teamId 입니다: ${b.aId}` });
      if (!teamB) return json(res, 404, { ok: false, error: `존재하지 않는 teamId 입니다: ${b.bId}` });
      const membersOf = (team) => Object.values(team.slots || {}).filter(Boolean)
        .map((id) => idx.items.find((i) => i.id === id)).filter(Boolean);
      const mA = membersOf(teamA), mB = membersOf(teamB);
      if (!mA.length) return json(res, 400, { ok: false, error: `편성이 비어 있습니다: ${b.aId}` });
      if (!mB.length) return json(res, 400, { ok: false, error: `편성이 비어 있습니다: ${b.bId}` });
      const scenario = (b.scenario || "").toString().trim() || "범용 코딩 작업";
      // 같은 시나리오·엔진으로 양 팀 평가(엔진 폴백은 teamEval 내부 처리).
      const resultA = await teamEval(mA, scenario, b.engine);
      const resultB = await teamEval(mB, scenario, b.engine);
      const winner = resultA.total > resultB.total ? "a" : resultB.total > resultA.total ? "b" : "draw";
      const delta = Math.abs(resultA.total - resultB.total);
      // Elo 갱신: result 1=A승, 0=B승, 0.5=무.
      const eloResult = winner === "a" ? 1 : winner === "b" ? 0 : 0.5;
      const { a: eloA, b: eloB } = teamUpdateElo(teamA.elo ?? 1500, teamB.elo ?? 1500, eloResult);
      const at = Date.now();
      teamA.elo = eloA;
      teamB.elo = eloB;
      teamA.eval = { at, total: resultA.total, scores: resultA.scores, comment: resultA.comment, engine: resultA.engine, scenario };
      teamB.eval = { at, total: resultB.total, scores: resultB.scores, comment: resultB.comment, engine: resultB.engine, scenario };
      await saveTeams(teams); // 응답 전 영속 완료 보장
      return json(res, 200, {
        ok: true,
        a: { teamId: b.aId, name: teamA.name || b.aId, result: resultA },
        b: { teamId: b.bId, name: teamB.name || b.bId, result: resultB },
        winner, delta, elo: { a: eloA, b: eloB },
      });
    }

    if (req.method === "POST" && path === "/api/team/export-omc") {
      // 팀 편성을 OMC /team 설정(omc.jsonc + team-command.md)으로 변환. data/exports/<teamId>/ 에 기록.
      let b;
      try { b = await body(req); }
      catch { return json(res, 400, { ok: false, error: "요청 본문 파싱 실패 — JSON 형식을 확인해 주세요." }); }
      if (!b.teamId) return json(res, 400, { ok: false, error: "teamId가 필요합니다." });
      const teams = await loadTeams();
      const team = teams.teams?.[b.teamId];
      if (!team) return json(res, 404, { ok: false, error: "존재하지 않는 teamId 입니다." });
      const idx = INDEX || (await loadIndex());
      const slots = team.slots || {};
      if (!Object.values(slots).filter(Boolean).length)
        return json(res, 400, { ok: false, error: "편성이 비어 있습니다 — 카드를 배치한 뒤 내보내세요." });
      const lo = await loadout();
      const equipped = lo.equipped || {};
      const isUsable = (item, id) => !!equipped[id] || isInstalled(item); // 장착됐거나 이미 ~/.claude 설치
      const files = buildOmcExport(b.teamId, team, idx, isUsable);
      // data/exports/<teamId>/ 에 기록(자동 환경 수정 금지 — 파일 생성 + 반환만).
      const dir = join(dataDir, "exports", sanitizeExportId(b.teamId));
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, "omc.jsonc"), files["omc.jsonc"], "utf8");
      await writeFile(join(dir, "team-command.md"), files["team-command.md"], "utf8");
      return json(res, 200, { ok: true, files, dir });
    }

    if (req.method === "POST" && path === "/api/usage/refresh") {
      // 세션 로그를 다시 훑어 사용량(경험치)을 재집계하고 메모리 캐시 갱신.
      USAGE = collectUsage();
      // 매칭된 카운트 수 = 현재 인덱스 항목 중 사용량 > 0 인 개수.
      const idx = INDEX || (await loadIndex());
      let total = 0;
      for (const it of idx.items) {
        const u = USAGE[(it.name || "").toLowerCase()] ?? USAGE[it.nameKey] ?? 0;
        if (u > 0) total++;
      }
      return json(res, 200, { ok: true, total });
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

      const outDir = join(mediaDir, "generated");
      const requestedEngine = (b.imageEngine || "auto").toLowerCase();
      let useImageFarm = requestedEngine === "image-farm";

      if (requestedEngine === "auto" || requestedEngine === "chatgpt" || requestedEngine === "grok") {
        try {
          const controller = new AbortController();
          const tId = setTimeout(() => controller.abort(), 600);
          const farmCheck = await fetch("http://127.0.0.1:4180/api/health", { signal: controller.signal });
          if (farmCheck.ok) {
            useImageFarm = true;
          }
          clearTimeout(tId);
        } catch (e) {
          // ignore
        }
      }

      if (useImageFarm) {
        try {
          const farmRes = await fetch("http://127.0.0.1:4180/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt: b.prompt,
              count: b.expectedCount || 1,
              outDir: outDir
            })
          });
          if (!farmRes.ok) {
            const errData = await farmRes.json().catch(() => ({}));
            throw new Error(errData.error || `HTTP ${farmRes.status}`);
          }
          const farmData = await farmRes.json();
          if (!farmData.ok || !farmData.images?.length) {
            throw new Error(farmData.error || "응답 이미지 데이터가 비어 있습니다.");
          }
          
          const images = farmData.images.map((img) => ({ url: `/media/generated/${img.filename}` }));
          
          if (b.itemId) {
            const ext = (farmData.images[0].filename.split(".").pop() || "png").toLowerCase();
            const name = `card-${imgSlug(b.itemId)}.${ext}`;
            const destPath = join(outDir, name);
            const genFilename = farmData.images[0].filename;
            const genPath = join(outDir, genFilename);
            
            if (existsSync(genPath)) {
              await rm(destPath, { force: true });
              await rename(genPath, destPath);
            } else {
              // 이미지 다운로드 폴백
              const imgUrl = `http://127.0.0.1:4180/generated/${genFilename}`;
              const imgRes = await fetch(imgUrl);
              if (!imgRes.ok) throw new Error(`이미지 다운로드 실패 (HTTP ${imgRes.status})`);
              const buf = Buffer.from(await imgRes.arrayBuffer());
              await rm(destPath, { force: true });
              await writeFile(destPath, buf);
            }
            
            const webPath = `/media/generated/${name}`;
            images[0] = { url: webPath };
            await setCardImage(b.itemId, webPath);
          }
          
          return json(res, 200, { ok: true, engine: "image-farm", images });
        } catch (e) {
          if (requestedEngine === "image-farm") {
            return json(res, 503, { ok: false, engine: "image-farm", error: "image-farm 생성 실패: " + e.message });
          }
          console.warn("image-farm 감지되었으나 요청 실패하여 내장 엔진 폴백 시도:", e.message);
        }
      }

      // 디스패처로 ChatGPT/Grok 선택 생성. 저장 경로(outDir)는 항상 media/generated 로 고정.
      let gen;
      try { ({ generate: gen } = await import("../skills/web-image-forge/lib/imagegen.js")); }
      catch (e) { return json(res, 503, { ok: false, error: "이미지 모듈 로드 실패(npm i chrome-remote-interface): " + e.message }); }
      const engine = requestedEngine === "grok" ? "grok" : "chatgpt";
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

    if (req.method === "POST" && path === "/api/drop") {
      // 카드 드랍: 최근 세션에서 해결 패턴을 추출 → SKILL.md 생성 → rescan으로 신규 카드 등록.
      let b;
      try { b = await body(req); }
      catch { return json(res, 400, { ok: false, error: "요청 본문 파싱 실패 — JSON 형식을 확인해 주세요." }); }
      const reqEngine = b.engine;
      // 드랍 AI 생성은 기존 verify 엔진 셸아웃 인프라(resolveEngineOrder/aiJsonWithFallback)를 주입해 재사용.
      const aiJson = (reqEngine || "").toLowerCase() === "heuristic"
        ? null
        : async (prompt) => {
            const order = await resolveEngineOrder(reqEngine);
            if (!order.length) return null;
            return await aiJsonWithFallback(prompt, order, 25000);
          };
      let drop;
      try { drop = await generateDrop({ aiJson }); }
      catch (e) { return json(res, 500, { ok: false, error: "드랍 생성 실패: " + e.message }); }
      // 저장된 SKILL.md를 인-프로세스 rescan으로 카드 등록.
      const ok = await runScan();
      if (!ok) return json(res, 500, { ok: false, error: "카드 저장 후 rescan 실패", skillPath: drop.skillPath });
      // 새 카드 찾기: source.root === sources/_drops 이고 source.path === <slug>/SKILL.md
      const dropsAbs = resolve(dropsDir);
      const relPath = `${drop.slug}/SKILL.md`;
      const card = INDEX.items.find((i) => i.source?.root && resolve(i.source.root) === dropsAbs && i.source.path === relPath)
        || INDEX.items.find((i) => i.source?.path === relPath);
      if (!card)
        return json(res, 200, { ok: true, card: { id: null, name: drop.name, kind: "skill" }, skillPath: drop.skillPath, note: (drop.note ? drop.note + " · " : "") + "카드 등록 확인 실패(수동 rescan 필요)" });
      return json(res, 200, { ok: true, card: { id: card.id, name: card.name, kind: "skill" }, skillPath: drop.skillPath, note: drop.note || undefined });
    }

    // --- Design Forge API ---
    if (path.startsWith("/api/forge")) {
      try {
        if (req.method === "GET" && path === "/api/forge/sessions")
          return json(res, 200, { ok: true, sessions: await forge.listSessions() });
        if (req.method === "GET" && path === "/api/forge/capabilities")
          return json(res, 200, { ok: true, ...(await forge.forgeCapabilities()) });
        if (req.method === "GET" && path === "/api/forge/session") {
          const s = await forge.getSession(url.searchParams.get("id"));
          return s ? json(res, 200, { ok: true, session: s }) : json(res, 404, { ok: false, error: "세션 없음" });
        }
        if (req.method === "GET" && path === "/api/forge/status") {
          const st = await forge.getStatus(url.searchParams.get("id"));
          return st ? json(res, 200, { ok: true, ...st }) : json(res, 404, { ok: false, error: "세션 없음" });
        }
        if (req.method === "GET" && path === "/api/forge/next") {
          const n = await forge.nextMatchup(url.searchParams.get("id"));
          return json(res, 200, { ok: true, matchup: n });
        }
        if (req.method === "POST" && path === "/api/forge/session") {
          const b = await body(req);
          return json(res, 200, { ok: true, session: await forge.createSession(b) });
        }
        if (req.method === "POST" && path === "/api/forge/generate") {
          const b = await body(req);
          const r = await forge.startGeneration(b.id, { concurrency: b.concurrency || 3 });
          return json(res, 200, { ok: true, ...r });
        }
        if (req.method === "POST" && path === "/api/forge/match") {
          const b = await body(req);
          return json(res, 200, { ok: true, ...(await forge.recordMatch(b.id, b)) });
        }
        if (req.method === "POST" && path === "/api/forge/refine") {
          const b = await body(req);
          return json(res, 200, { ok: true, variant: await forge.refine(b.id, b) });
        }
        if (req.method === "POST" && path === "/api/forge/export") {
          const b = await body(req);
          return json(res, 200, await forge.exportKit(b.id, b));
        }
        if (req.method === "POST" && path === "/api/forge/delete") {
          const b = await body(req);
          return json(res, 200, await forge.deleteSession(b.id));
        }
        return json(res, 404, { ok: false, error: "forge 엔드포인트 없음" });
      } catch (e) { return json(res, 400, { ok: false, error: e.message }); }
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
await loadUsage(); // 사용량(경험치) 캐시 로드(없으면 빈 객체)
server.listen(port, () => console.log(`🎒 Loadout: http://localhost:${port}`));
