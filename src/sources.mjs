// Loadout 소스 루트 관리 — scan.mjs와 server.mjs가 공유.
// config.json(시드) + data/sources.json(사용자 관리)에서 "어디서 스킬을 가져올지"를 결정.
// 폴더 추가/삭제·git clone된 폴더 등록을 실시간(파일 갱신 → 재스캔)으로 관리한다.
import { readFileSync, existsSync } from "node:fs";
import { writeFile, mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const dataDir = join(root, "data");
const sourcesPath = join(dataDir, "sources.json");
const configPath = join(root, "src/config.json");

// "~" → 홈 디렉토리. 경로 구분자 앞이나 끝에서만 치환(이메일 등 오탐 방지).
export const expandHome = (p) => (p || "").replace(/^~(?=$|[/\\])/, homedir());
export const absRoot = (p) => resolve(expandHome(p));
const uniq = (xs) => [...new Set(xs)];

function readJson(p, fallback) {
  try { return JSON.parse(readFileSync(p, "utf8")); } catch { return fallback; }
}

// 기본 시드: "우선은 .claude 에 있는 것만" — 설치된 스킬/에이전트/플러그인 +
// config.json의 sourceRoots(있으면)를 합쳐 둔다. 사용자는 UI에서 자유롭게 가감.
function seedRoots() {
  const cc = [
    join(homedir(), ".claude", "skills"),
    join(homedir(), ".claude", "agents"),
    join(homedir(), ".claude", "plugins"),
  ];
  const cfg = readJson(configPath, {});
  const cfgRoots = (cfg.sourceRoots || []).map(absRoot);
  return uniq([...cc, ...cfgRoots]);
}

// data/sources.json 원본( {roots, repos} ). 없으면 시드로 대체(영속화는 호출부 책임).
export function loadSources() {
  const s = readJson(sourcesPath, null);
  if (s && Array.isArray(s.roots)) return { roots: s.roots, repos: Array.isArray(s.repos) ? s.repos : [] };
  return { roots: seedRoots(), repos: [] };
}

// 스캔에 쓸 "실제 존재하는" 절대경로 루트 목록(중복 제거).
export function loadRoots() {
  return uniq(loadSources().roots.map(absRoot)).filter(existsSync);
}

export async function saveSources(s) {
  await mkdir(dataDir, { recursive: true });
  await writeFile(sourcesPath, JSON.stringify(s, null, 2));
  return s;
}

// 시드 상태(파일 없음)면 현재 시드를 디스크에 고정 — 관리 UI에 노출되도록.
export async function ensureSourcesFile() {
  if (existsSync(sourcesPath)) return loadSources();
  return saveSources(loadSources());
}

export async function addRoot(p) {
  const abs = absRoot(p);
  if (!existsSync(abs)) throw new Error("경로가 존재하지 않습니다: " + abs);
  const s = loadSources();
  if (!s.roots.map(absRoot).includes(abs)) s.roots.push(abs);
  await saveSources(s);
  return abs;
}

export async function removeRoot(p) {
  const abs = absRoot(p);
  const s = loadSources();
  s.roots = s.roots.filter((r) => absRoot(r) !== abs);
  await saveSources(s);
  return abs;
}

// clone된 repo 폴더를 소스로 등록(루트 추가 + repos 메타 기록).
export async function addRepo(url, dir) {
  const s = loadSources();
  const abs = absRoot(dir);
  if (!s.roots.map(absRoot).includes(abs)) s.roots.push(abs);
  s.repos = (s.repos || []).filter((r) => absRoot(r.dir) !== abs);
  s.repos.push({ url, dir: abs });
  await saveSources(s);
  return abs;
}
