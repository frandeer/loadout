// 사용량 = 경험치 수집기 — ~/.claude/projects/*/*.jsonl 세션 로그를 훑어
// Skill/Agent 도구 호출 횟수를 집계한다. Node 내장만 사용(의존성 0, ESM, 동기 IO로 단순하게).
// 결과는 data/usage.json 에 적재하고 counts(이름 소문자 → 횟수)를 반환한다.
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const dataDir = join(root, "data");
const projectsDir = join(homedir(), ".claude", "projects");

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000; // mtime 이보다 오래된 파일은 스킵
const MAX_FILE_BYTES = 64 * 1024 * 1024;          // 64MB 초과 파일은 스킵(거대 로그 보호)
const MAX_FILES = 200;                            // 전체 스캔 파일 캡

// 매치된 이름을 카운트에 누적. 풀네임(소문자)과 네임스페이스 제거형(마지막 ':' 뒤) 둘 다 키로 적재
// → index.json 의 bare name("frontend-design")과 세션 로그의 "superpowers:foo" 양쪽 매칭률을 높인다.
function bump(counts, raw) {
  if (!raw) return;
  const full = raw.toLowerCase();
  counts[full] = (counts[full] || 0) + 1;
  const tail = full.includes(":") ? full.slice(full.lastIndexOf(":") + 1) : null;
  if (tail && tail !== full) counts[tail] = (counts[tail] || 0) + 1;
}

// ~/.claude/projects/*/*.jsonl 목록을 수집(프로젝트 폴더 1뎁스 → 그 안의 .jsonl).
function listSessionFiles() {
  let dirs;
  try { dirs = readdirSync(projectsDir, { withFileTypes: true }); }
  catch { return []; } // projects 폴더 자체가 없으면 빈 결과
  const files = [];
  const cutoff = Date.now() - NINETY_DAYS_MS;
  for (const d of dirs) {
    if (!d.isDirectory()) continue;
    const pdir = join(projectsDir, d.name);
    let entries;
    try { entries = readdirSync(pdir); } catch { continue; }
    for (const name of entries) {
      if (!name.endsWith(".jsonl")) continue;
      const fp = join(pdir, name);
      let st;
      try { st = statSync(fp); } catch { continue; }
      if (!st.isFile()) continue;
      if (st.mtimeMs < cutoff) continue;       // 90일 이내만
      if (st.size > MAX_FILE_BYTES) continue;   // 64MB 초과 스킵
      files.push({ fp, mtimeMs: st.mtimeMs });
    }
  }
  // 최신 파일 우선으로 정렬 후 캡 적용(많이 쌓였을 때 최근 활동을 보존).
  files.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return files.slice(0, MAX_FILES).map((f) => f.fp);
}

const SKILL_RE = /"skill":"([^"]+)"/g;            // Skill 도구 호출
const SUBAGENT_RE = /"subagent_type":"([^"]+)"/g; // Agent(Task) 호출

// 모든 세션 로그를 훑어 도구 호출 횟수를 집계. { "<이름 소문자>": 횟수 } 반환.
export function collectUsage() {
  const counts = {};
  for (const fp of listSessionFiles()) {
    let text;
    try { text = readFileSync(fp, "utf8"); } catch { continue; }
    let m;
    SKILL_RE.lastIndex = 0;
    while ((m = SKILL_RE.exec(text))) bump(counts, m[1]);
    SUBAGENT_RE.lastIndex = 0;
    while ((m = SUBAGENT_RE.exec(text))) bump(counts, m[1]);
  }
  try {
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(
      join(dataDir, "usage.json"),
      JSON.stringify({ updatedAt: new Date().toISOString(), counts }, null, 2)
    );
  } catch { /* 쓰기 실패해도 counts 는 반환(읽기 전용 환경 보호) */ }
  return counts;
}
