// Loadout 카드 드랍 — 최근 Claude Code 세션에서 "재사용 가능한 해결 패턴"을 추출해
// 신규 스킬 카드(SKILL.md)로 굳힌다(획득 연출). Node 내장만 사용(의존성 0, ESM).
//
// 프라이버시/토큰 보호: 세션 전문을 보내지 않는다. 도구 사용 빈도·최근 수정 파일·
// 실행 명령 일부·짧은 대화 발췌만 모아 요약 신호로 만든다(캡 적용).
//
// AI 생성은 server.mjs가 주입하는 aiJson(prompt)으로 수행(기존 verify 엔진 셸아웃 인프라
// 재사용 — 중복 구현 금지). 엔진 실패/부재 시 휴리스틱 템플릿으로 폴백한다.
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { addRoot } from "./sources.mjs";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const projectsDir = join(homedir(), ".claude", "projects");
// 드랍은 sources/_drops 아래에 모은다(전용 스캔 루트 — 기존 repo 루트와 겹치지 않음).
export const dropsDir = join(root, "sources", "_drops");

// ---------- 캡(토큰/프라이버시/성능 보호) ----------
const MAX_SESSIONS = 3;                    // 최근 세션 N개만
const MAX_READ_BYTES = 2 * 1024 * 1024;    // 세션당 최대 읽기 바이트(꼬리=최근 위주)
const MAX_FILES = 20;                      // 추출 최근 수정 파일 캡
const MAX_COMMANDS = 12;                   // 실행 명령 발췌 캡
const MAX_SNIPPETS = 12;                   // 대화 발췌 캡
const SNIPPET_LEN = 200;                   // 발췌 1개 길이 캡

// 한국어 허용 kebab-case slug
export function slugify(s) {
  return String(s || "drop").trim().toLowerCase()
    .replace(/[^\w가-힣]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "drop";
}

// ~/.claude/projects/*/*.jsonl 중 최근 수정 세션 MAX_SESSIONS개의 경로.
function recentSessions() {
  let dirs;
  try { dirs = readdirSync(projectsDir, { withFileTypes: true }); } catch { return []; }
  const files = [];
  for (const d of dirs) {
    if (!d.isDirectory()) continue;
    const pdir = join(projectsDir, d.name);
    let entries; try { entries = readdirSync(pdir); } catch { continue; }
    for (const name of entries) {
      if (!name.endsWith(".jsonl")) continue;
      const fp = join(pdir, name);
      let st; try { st = statSync(fp); } catch { continue; }
      if (st.isFile()) files.push({ fp, mtimeMs: st.mtimeMs });
    }
  }
  files.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return files.slice(0, MAX_SESSIONS).map((f) => f.fp);
}

// 신호 누적기에 항목 추가(캡 준수).
function pushTool(acc, name) { if (name) acc.tools[name] = (acc.tools[name] || 0) + 1; }
function pushFile(acc, fp) { if (fp && !acc.files.includes(fp) && acc.files.length < MAX_FILES) acc.files.push(fp); }
function pushCommand(acc, c) { if (c && acc.commands.length < MAX_COMMANDS * 3) acc.commands.push(String(c).replace(/\s+/g, " ").trim().slice(0, 120)); }
function pushSnippet(acc, role, txt) {
  if (!txt || acc.snippets.length >= MAX_SNIPPETS) return;
  const t = String(txt).replace(/\s+/g, " ").trim();
  if (t) acc.snippets.push(`${role}: ${t.slice(0, SNIPPET_LEN)}`);
}

// message.content(문자열 또는 블록 배열)를 훑어 도구/파일/명령/텍스트 신호 추출.
// tool_result(장황한 실행 결과)는 의도적으로 제외(프라이버시/토큰).
function walkContent(content, role, acc) {
  if (typeof content === "string") { if (role === "user" || role === "assistant") pushSnippet(acc, role, content); return; }
  if (!Array.isArray(content)) return;
  for (const blk of content) {
    if (!blk || typeof blk !== "object") continue;
    if (blk.type === "text" && blk.text) pushSnippet(acc, role, blk.text);
    else if (blk.type === "tool_use") {
      pushTool(acc, blk.name);
      const inp = blk.input || {};
      if (inp.file_path) pushFile(acc, inp.file_path);
      if (inp.command) pushCommand(acc, inp.command);
    }
  }
}

function extractFromText(text, acc) {
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    let ev; try { ev = JSON.parse(line); } catch { continue; } // 잘린/비정상 라인 스킵
    const msg = ev.message;
    if (msg && (ev.type === "user" || ev.type === "assistant")) walkContent(msg.content, msg.role || ev.type, acc);
  }
}

// 추출 신호를 사람이 읽을 수 있는 요약(프롬프트/휴리스틱 공용)으로.
function buildSummary(acc) {
  const topTools = Object.entries(acc.tools).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const parts = [];
  parts.push(`자주 쓴 도구: ${topTools.map(([n, c]) => `${n}(${c})`).join(", ") || "(없음)"}`);
  if (acc.files.length) parts.push(`최근 수정 파일:\n${acc.files.slice(0, MAX_FILES).map((f) => " - " + f).join("\n")}`);
  const cmds = [...new Set(acc.commands)].slice(0, MAX_COMMANDS);
  if (cmds.length) parts.push(`실행 명령(일부):\n${cmds.map((c) => " - " + c).join("\n")}`);
  if (acc.snippets.length) parts.push(`대화 발췌:\n${acc.snippets.map((s) => " - " + s).join("\n")}`);
  return parts.join("\n\n");
}

function buildDropPrompt(summary) {
  return (
    `당신은 Claude Code 세션 로그에서 "재사용 가능한 해결 패턴" 1개를 발견해 스킬 문서(SKILL.md)로 정리하는 전문가입니다.\n` +
    `아래는 최근 세션의 요약 신호입니다(전문이 아닌 발췌).\n\n` +
    `${summary}\n\n` +
    `위 활동에서 가장 반복적으로 재사용할 만한 작업 패턴 1개를 골라 한국어 SKILL.md로 작성하세요.\n` +
    `- name: 짧은 영문 kebab-case 또는 간결한 한국어 제목\n` +
    `- description: 이 스킬을 언제 쓰는지 1~2문장(한국어)\n` +
    `- body: 마크다운 본문(한국어) — 목적, 사용 시점, 단계별 절차, 주의사항\n` +
    `반드시 JSON만 출력하세요. 예시: {"name":"...","description":"...","body":"# ...\\n..."}`
  );
}

function normalizeCard(p) {
  return {
    name: (p.name || "").toString().trim().slice(0, 80) || "session-drop",
    description: (p.description || "").toString().trim().slice(0, 300) || "세션에서 추출한 재사용 가능한 작업 패턴.",
    body: (p.body || "").toString().trim().slice(0, 8000),
  };
}

// 엔진 부재/실패 시: 가장 빈번한 도구/명령 패턴으로 템플릿 SKILL.md 생성.
function heuristicCard(acc) {
  const topTools = Object.entries(acc.tools).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const toolList = topTools.map(([n, c]) => `- ${n} (${c}회)`).join("\n") || "- (도구 신호 없음)";
  const cmdList = [...new Set(acc.commands)].slice(0, 8).map((c) => "- `" + c + "`").join("\n");
  const fileList = acc.files.slice(0, 10).map((f) => "- " + f).join("\n");
  const primary = topTools[0]?.[0] || "작업";
  const name = slugify(`${primary}-워크플로`);
  const description = `최근 세션에서 ${primary} 중심으로 반복된 작업 패턴을 템플릿화한 스킬.`;
  const body =
    `# ${primary} 워크플로\n\n` +
    `## 목적\n최근 세션에서 자주 등장한 작업 흐름을 재사용 가능한 절차로 정리한다.\n\n` +
    `## 자주 쓴 도구\n${toolList}\n` +
    (cmdList ? `\n## 자주 실행한 명령\n${cmdList}\n` : "") +
    (fileList ? `\n## 최근 작업 파일\n${fileList}\n` : "") +
    `\n## 사용 시점\n비슷한 작업을 다시 수행할 때 이 절차를 참고한다.\n\n` +
    `## 주의\n이 문서는 세션 활동에서 자동 생성된 초안이므로, 실제 사용 전 검토·보강이 필요하다.\n`;
  return { name, description, body };
}

// 프론트매터 값 안전화(개행/따옴표 제거 — 간이 파서 호환).
const fmSafe = (s) => String(s || "").replace(/[\r\n]+/g, " ").replace(/"/g, "'").trim();

// SKILL.md 저장. 동일 slug 존재 시 -2, -3 suffix. { skillPath, slug, dir } 반환.
async function writeSkill(card) {
  await mkdir(dropsDir, { recursive: true });
  const base = slugify(card.name);
  let slug = base, dir = join(dropsDir, slug), n = 2;
  while (existsSync(dir)) { slug = `${base}-${n}`; dir = join(dropsDir, slug); n++; }
  await mkdir(dir, { recursive: true });
  const fm = `---\nname: ${fmSafe(card.name)}\ndescription: ${fmSafe(card.description)}\n---\n\n`;
  const skillPath = join(dir, "SKILL.md");
  await writeFile(skillPath, fm + card.body + "\n", "utf8");
  return { skillPath, slug, dir };
}

// 카드 드랍 본체. aiJson(prompt)→{parsed,engine}|null 을 주입받아 AI 생성 시도, 실패 시 휴리스틱.
// { name, slug, skillPath, dir, fromAI, engine, note, summaryEmpty } 반환.
export async function generateDrop({ aiJson } = {}) {
  const acc = { tools: {}, files: [], commands: [], snippets: [] };
  for (const fp of recentSessions()) {
    let text; try { text = readFileSync(fp, "utf8"); } catch { continue; }
    if (text.length > MAX_READ_BYTES) text = text.slice(text.length - MAX_READ_BYTES); // 최근(꼬리) 위주
    extractFromText(text, acc);
  }
  const summary = buildSummary(acc);
  const hasSignal = !!(Object.keys(acc.tools).length || acc.files.length || acc.snippets.length);

  let card = null, fromAI = false, engine = "heuristic", note = null;
  if (aiJson && hasSignal) {
    const r = await aiJson(buildDropPrompt(summary)).catch(() => null);
    if (r && r.parsed && (r.parsed.name || r.parsed.body)) {
      card = normalizeCard(r.parsed);
      engine = r.engine || "ai";
      fromAI = true;
    }
  }
  if (!card) {
    card = heuristicCard(acc);
    note = aiJson ? "AI 엔진 호출 실패/부재 — 휴리스틱 템플릿으로 생성됨" : "휴리스틱 템플릿으로 생성됨";
    if (!hasSignal) note = "최근 세션 신호를 찾지 못해 빈 템플릿으로 생성됨";
  }

  const { skillPath, slug, dir } = await writeSkill(card);
  await addRoot(dropsDir).catch(() => {}); // sources/_drops 를 스캔 루트로 등록(최초 1회, 멱등)
  return { name: card.name, slug, skillPath, dir, fromAI, engine, note, summaryEmpty: !hasSignal };
}
