// Loadout 스캐너 — sources를 훑어 skill/agent/mcp 카드 데이터(index.json) 생성.
// Node 내장 모듈만 사용. 멱등(같은 입력 → 같은 출력).
import { readdir, readFile, stat, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFile } from "node:child_process";
import { join, resolve, basename, relative, sep } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { loadRoots, expandHome } from "./sources.mjs";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const cfg = JSON.parse(await readFile(join(root, "src/config.json"), "utf8"));
const dataDir = join(root, "data");

// ---------- 유틸 ----------
const clamp = (n, lo = 0, hi = 99) => Math.max(lo, Math.min(hi, Math.round(n)));
const norm = (s) => (s || "").toLowerCase().replace(/[^a-z0-9가-힣]+/g, "");

// ---------- git 신선도 (repo별 1회 배치 호출, 파일→마지막 커밋시각 맵) ----------
// 성능: per-file git 호출(파일당 ~0.3s, 6000개면 수십 분)을 피하고
// repo당 단 한 번 `git log --name-only`로 전체 맵을 만든다(최대 repo가 ~3s).
const execFileAsync = (cmd, args, opts) =>
  new Promise((res) => {
    execFile(cmd, args, opts, (err, stdout) => res(err ? null : stdout));
  });

// repoDir(절대경로) → Map<relPathInRepo, commitEpochMs>
const gitMtimeCache = new Map();
async function getGitMtimeMap(repoDir) {
  if (gitMtimeCache.has(repoDir)) return gitMtimeCache.get(repoDir);
  const map = new Map();
  if (!existsSync(join(repoDir, ".git"))) {
    gitMtimeCache.set(repoDir, map);
    return map;
  }
  // 'C<epoch>' 헤더 + 해당 커밋에서 변경된 파일 목록. 최신 커밋이 먼저 나오므로
  // 파일을 처음 만난 시점(=가장 최근 커밋)만 기록한다.
  const out = await execFileAsync(
    "git",
    ["-C", repoDir, "log", "--format=C%ct", "--name-only", "-z"],
    { maxBuffer: 256 * 1024 * 1024 }
  );
  if (out) {
    let curTs = 0;
    // -z: 레코드가 NUL로 구분됨. 커밋 헤더 줄과 파일경로가 섞여 들어온다.
    for (const rec of out.split("\0")) {
      if (!rec) continue;
      const lines = rec.split(/\r?\n/);
      for (const line of lines) {
        if (!line) continue;
        if (line[0] === "C" && /^C\d+$/.test(line)) {
          curTs = parseInt(line.slice(1), 10) * 1000;
        } else if (curTs && !map.has(line)) {
          map.set(line.replace(/\\/g, "/"), curTs);
        }
      }
    }
  }
  gitMtimeCache.set(repoDir, map);
  return map;
}

// repo 디렉토리(sourceRoot 바로 아래) 절대경로
function repoDirOf(rootPath, repo) {
  return join(rootPath, repo);
}

// 파일의 "진짜" 신선도용 시각: git 마지막 커밋 > 디렉토리 폴더 git시각 > 파일 mtime
function effectiveMtimeMs(gitMap, relPathInRepo, fallbackMtimeMs) {
  const direct = gitMap.get(relPathInRepo);
  if (direct) return direct;
  // 파일 자체 기록이 없으면 같은 폴더의 다른 파일 중 최신 커밋시각으로 근사
  const dir = relPathInRepo.replace(/\/[^/]*$/, "/");
  let best = 0;
  if (dir && dir !== relPathInRepo) {
    for (const [p, ts] of gitMap) {
      if (p.startsWith(dir) && ts > best) best = ts;
    }
  }
  return best || fallbackMtimeMs;
}

// ---------- 카테고리 도메인 추론 ----------
// 경로상 카테고리가 의미 없을 때(예: antigravity는 전부 ".../skills/<name>/SKILL.md")
// 이름+설명+태그에서 도메인 키워드를 찾아 분류한다. 멱등(시간 비의존).
const GENERIC_CATEGORY = new Set([
  "skills", "skill", "src", "lib", "plugins", "plugin", "main", "master",
  "skill.md", "agents", "agent", "docs", "doc", "general", "misc", "."
]);

// 우선순위 순으로 검사(앞선 도메인이 더 구체적). 단어경계 매칭.
const DOMAIN_RULES = [
  ["security", ["security", "secur", "pentest", "pentesting", "exploit", "vulnerab", "owasp", "kerberos", "privilege escalation", "red team", "redteam", "malware", "forensic", "cve", "xss", "csrf", "sqli", "injection", "auth bypass", "cryptograph", "hacking", "attack", "threat"]],
  ["testing", ["testing", "unit test", "e2e", "playwright", "cypress", "jest", "pytest", "tdd", "qa ", "test coverage", "regression test", "test suite", "a/b test", "ab-test"]],
  ["devops", ["devops", "kubernetes", "k8s", "docker", "terraform", "ansible", "ci/cd", "ci cd", "cicd", "deployment", "deploy", "infrastructure", "helm", "vercel", "aws ", "cloud", "pipeline", "observability", "monitoring", "sre ", "provisioning"]],
  ["ml", ["machine learning", "ml ", "deep learning", "neural", "llm", "fine-tun", "huggingface", "hugging face", "pytorch", "tensorflow", "embedding", "rag ", "transformer", "training", "model train", "dataset", "inference"]],
  ["data", ["data engineering", "data pipeline", "etl", "sql", "database", "postgres", "mysql", "mongodb", "analytics", "data analysis", "dashboard", "warehouse", "bigquery", "spark", "pandas", "data science", "cdp", "segment"]],
  ["design", ["design", "ui/ux", "ux ", "ui ", "figma", "typography", "color palette", "branding", "wireframe", "mockup", "visual", "aesthetic", "layout", "css", "tailwind", "animation", "motion design", "illustration"]],
  ["game", ["game", "gamedev", "game-dev", "unity", "unreal", "godot", "level design", "gameplay", "shader", "sprite", "roguelike", "platformer", "rpg "]],
  ["web", ["web", "frontend", "front-end", "react", "vue", "angular", "next.js", "nextjs", "svelte", "html", "browser", "website", "spa ", "three.js", "threejs", "webgl", "dom "]],
  ["api", ["api", "rest", "graphql", "endpoint", "webhook", "openapi", "swagger", "grpc", "fastapi", "express", "backend", "back-end", "microservice", "server-side"]],
  ["mobile", ["mobile", "android", "ios ", "swift", "kotlin", "react native", "flutter", "app store", "spm "]],
  ["marketing", ["marketing", "seo ", "seo-", "ad creative", "campaign", "growth", "conversion", "competitor", "pricing strategy", "go-to-market", "ecommerce", "e-commerce", "social media", "content strategy"]],
  ["writing", ["writing", "copywrit", "content writ", "blog", "documentation", "technical writing", "editor", "proofread", "translation", "summariz", "narrative"]],
  ["productivity", ["productivity", "workflow", "automation", "automate", "task management", "calendar", "scheduling", "note-taking", "knowledge base", "obsidian", "notion"]],
  ["ai-agents", ["agent", "multi-agent", "orchestrat", "autonomous", "tool use", "computer use", "mcp ", "prompt engineer", "claude", "subagent"]],
  ["engineering", ["refactor", "architecture", "code review", "debugging", "algorithm", "typescript", "python", "golang", "rust ", "best practices", "clean code", "design pattern", "concurrency", "performance optim", "framework migration"]],
  ["business", ["business", "finance", "legal", "advogado", "consultant", "strategy", "invoice", "accounting", "hr ", "recruit", "sales"]],
  ["media", ["video", "audio", "image gen", "photo", "podcast", "music", "render", "3d ", "vision"]]
];

function inferDomain(text) {
  const t = " " + (text || "").toLowerCase() + " ";
  for (const [domain, kws] of DOMAIN_RULES) {
    for (const kw of kws) {
      if (t.includes(kw)) return domain;
    }
  }
  return null;
}

// frontmatter category/tags → 구조적 경로 → 키워드 추론 → "general"
function deriveCategory({ fm, pathSegs, name, description }) {
  // 1) frontmatter category (의미 있는 값일 때만)
  const fmCat = (fm.category || "").toString().trim().toLowerCase();
  if (fmCat && !GENERIC_CATEGORY.has(fmCat) && fmCat.length <= 40) {
    return fmCat.replace(/\s+/g, "-");
  }
  // 2) frontmatter tags 첫 번째(도메인 매핑 시도, 아니면 원값)
  const tags = Array.isArray(fm.tags)
    ? fm.tags
    : (fm.tags ? String(fm.tags).split(/[,;]/) : []);
  for (const raw of tags) {
    const tag = String(raw).trim().toLowerCase();
    if (!tag || GENERIC_CATEGORY.has(tag)) continue;
    const dom = inferDomain(tag);
    if (dom) return dom;
    if (tag.length <= 24 && /^[a-z0-9가-힣][a-z0-9가-힣 _\/-]*$/.test(tag)) {
      return tag.replace(/[\s_\/]+/g, "-");
    }
  }
  // 3) 구조적 경로 세그먼트(의미 있을 때만). 호출부에서 repo명을 제외한
  //    "그룹 디렉토리" 후보만 우선순위 순으로 넘겨준다.
  for (const seg of pathSegs) {
    const s = (seg || "").toLowerCase();
    if (s && !GENERIC_CATEGORY.has(s) && s.length <= 40 && !/\.(md|json)$/.test(s)) {
      return s;
    }
  }
  // 4) 이름 + 설명에서 도메인 추론
  return inferDomain(name + " " + description) || "general";
}

function parseFrontmatter(text) {
  // --- ... --- 블록에서 name/description/model/allowed-tools 추출 (간이 파서)
  const m = text.match(/^﻿?---\s*\r?\n([\s\S]*?)\r?\n---/);
  const fm = {};
  if (!m) return fm;
  const body = m[1];
  const lines = body.split(/\r?\n/);
  let key = null;
  for (const line of lines) {
    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (kv) {
      key = kv[1].toLowerCase();
      let val = kv[2].trim();
      val = val.replace(/^["']|["']$/g, "");
      if (val === "|" || val === ">") {
        fm[key] = "";
      } else {
        fm[key] = val;
      }
    } else if (key && /^\s*-\s+/.test(line)) {
      fm[key] = (Array.isArray(fm[key]) ? fm[key] : []).concat(
        line.replace(/^\s*-\s+/, "").trim()
      );
    } else if (key && /^\s+\S/.test(line)) {
      if (typeof fm[key] === "string") {
        const trimmed = line.trim();
        if (fm[key] === "") {
          fm[key] = trimmed;
        } else {
          fm[key] += " " + trimmed;
        }
      }
    }
  }
  return fm;
}

async function walk(dir, onFile, depth = 0) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  // 파일 먼저 처리(이 폴더가 스킬 루트인지 판정도 겸함)
  let hasSkillMd = false;
  for (const e of entries) {
    if (e.isFile()) {
      if (e.name.toLowerCase() === "skill.md") hasSkillMd = true;
      await onFile(join(dir, e.name));
    }
  }
  // 스킬 루트(SKILL.md 보유)면 하위로 더 내려가지 않는다 — 스킬의 하위 폴더는
  // 별도 스킬이 아니다. Claude Code도 `~/.claude/skills/<name>/`를 1단계로만 보고
  // 하위를 재귀하지 않으므로 그 동작과 일치시킨다. 이렇게 하면 gstack 같은 번들
  // repo가 내부에 같은 스킬을 .cursor/.kiro 미러로 수십 벌 복제해도(또한 top-level
  // 엔트리포인트와도 중복) 카드 1장(gstack)으로만 잡힌다. 디스크는 안 건드림.
  if (hasSkillMd) return;
  for (const e of entries) {
    if (e.isDirectory()) {
      if (cfg.ignoreDirs.includes(e.name)) continue;
      if (e.name.startsWith(".")) continue;
      if (depth > 12) continue;
      await walk(join(dir, e.name), onFile, depth + 1);
    }
  }
}

// repo 이름 추정: sourceRoot 바로 아래 폴더
function repoOf(rootPath, filePath) {
  const rel = relative(rootPath, filePath).split(sep);
  return rel[0] || basename(rootPath);
}

function ownerGuess(repo) {
  const map = {
    "anthropics__skills": "anthropics",
    "skills": "anthropics",
    "antigravity-awesome-skills": "sickn33",
    "Claude-Code-Game-Studios": "Donchitos",
    "matt-skills": "matt",
    "claude-skills": "community",
    "supanova-design-skill": "uxjoseph",
    "prompt-master": "nidhinjs",
    "my-skills": "me",
    "web-image-forge": "loadout"
  };
  return map[repo] || repo.split("__")[0] || "unknown";
}

// ---------- 스탯 ----------
// freshMs: git 마지막 커밋시각(없으면 파일 mtime). 신선도 계산에 사용.
function computeStats({ repo, size, mtimeMs, freshMs, fm, kind, refCount }) {
  const now = Date.now();
  const ageDays = Math.max(0, (now - (freshMs || mtimeMs)) / 86400000);

  const popularity = clamp(cfg.repoPopularity[repo] ?? 50);
  // 신선도: 최근 30일은 만점에 가깝고, 1년(365일)이면 0 근처가 되도록 비선형.
  const freshness = clamp(100 - Math.min(100, Math.pow(ageDays / 365, 0.6) * 100));
  const desc = (fm.description || "").toString();
  const tools = Array.isArray(fm["allowed-tools"])
    ? fm["allowed-tools"].length
    : (fm["allowed-tools"] ? String(fm["allowed-tools"]).split(",").length : 0);

  // power: 분량/도구/참조를 더 넓은 동적 범위로 분산(한쪽 쏠림 완화).
  // 로그 스케일 본문 분량 + 도구 + 참조. 베이스를 낮추고 상한을 넓혀 분포를 펼친다.
  const sizeKb = size / 1024;
  const power = clamp(
    8 +
      Math.min(58, Math.log2(1 + sizeKb) * 13) + // 본문 분량(로그): 0.5KB≈11, 4KB≈45, 16KB≈58상한 근처
      Math.min(16, tools * 4) +                   // 도구 수
      Math.min(18, refCount * 2.5)                // 참조/스크립트 수
  );
  // clarity: 설명 품질. 이상적 길이(~160자)에 가까울수록 높은 연속 점수를 주어
  // 값이 한 점에 뭉치지 않고 부드럽게 분산되게 한다. (콘텐츠 의존 → 멱등)
  const dlen = desc.length;
  // 이상 길이 160자에서 멀어질수록 감점(연속). 0~30 범위.
  const lenScore = dlen === 0 ? 0 : Math.round(30 * Math.exp(-Math.pow(Math.log((dlen + 1) / 160), 2) / 1.4));
  // 문장 수(1~5문장이 읽기 좋음). 0~8.
  const sentences = (desc.match(/[.!?。]/g) || []).length;
  const sentScore = Math.min(8, sentences * 2);
  const clarity = clamp(
    (fm.name ? 20 : 0) +
      (desc ? 14 : 0) +
      lenScore +
      sentScore +
      (/use when|사용|when to|예시|example|trigger/i.test(desc) ? 16 : 0) +
      (/[A-Z가-힣]/.test(desc.slice(0, 1)) ? 4 : 0) // 대문자/한글로 시작(정돈됨)
  );
  const weight = clamp(Math.min(99, sizeKb * 2.2)); // 클수록 무거움(비용)
  return { popularity, freshness, power, clarity, weight };
}

function rarityOf(stats, ai) {
  const base =
    0.25 * stats.popularity +
    0.2 * stats.power +
    0.2 * stats.clarity +
    0.2 * stats.freshness +
    0.15 * (ai?.usefulness ?? (stats.power + stats.clarity) / 2);
  const score = clamp(base);
  let rarity = "common";
  if (score >= 85) rarity = "legendary";
  else if (score >= 70) rarity = "epic";
  else if (score >= 55) rarity = "rare";
  else if (score >= 40) rarity = "uncommon";
  return { score, rarity };
}

// 간단 해시(내용 변경 감지용) — djb2
function quickHash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return "h" + (h >>> 0).toString(16);
}

// ---------- 수집 ----------
const items = [];
let scanned = 0;

async function countSiblings(dir) {
  try {
    const es = await readdir(dir, { withFileTypes: true });
    return es.filter((e) => e.isFile() || e.isDirectory()).length;
  } catch {
    return 0;
  }
}

async function handleSkill(rootPath, file) {
  const head = await readFile(file, "utf8").catch(() => "");
  const fm = parseFrontmatter(head);
  const st = await stat(file).catch(() => null);
  if (!st) return;
  const repo = repoOf(rootPath, file);
  const relPath = relative(rootPath, file).split(sep).join("/");
  const dir = file.slice(0, file.length - basename(file).length);
  const refCount = await countSiblings(dir);
  const segs = relPath.split("/");
  const name = fm.name || basename(dir.replace(/[\\/]+$/, "")) || "skill";
  const description = (fm.description || "").toString();
  // 구조적 카테고리 후보: 스킬 폴더의 부모 디렉토리(단, repo명은 제외).
  const structSegs = [];
  if (segs.length >= 3) {
    const parent = segs[segs.length - 3];
    if (parent && parent !== repo) structSegs.push(parent);
  }
  const category = deriveCategory({ fm, pathSegs: structSegs, name, description });
  // git 신선도: repo당 1회 배치 맵. relPath에서 repo 세그먼트를 떼면 repo 내부 경로.
  const gitMap = await getGitMtimeMap(repoDirOf(rootPath, repo));
  const relInRepo = segs.slice(1).join("/");
  const freshMs = effectiveMtimeMs(gitMap, relInRepo, st.mtimeMs);
  const stats = computeStats({ repo, size: st.size, mtimeMs: st.mtimeMs, freshMs, fm, kind: "skill", refCount });
  const r = rarityOf(stats, null);
  items.push({
    id: `${repo}/${relPath}`,
    kind: "skill",
    name,
    displayName: name,
    description: description.slice(0, 600),
    category,
    source: { repo, owner: ownerGuess(repo), path: relPath, root: rootPath, sizeBytes: st.size, mtime: Math.round(freshMs) },
    meta: { allowedTools: fm["allowed-tools"] || null, model: fm.model || null, refCount },
    stats,
    score: r.score,
    rarity: r.rarity,
    contentHash: quickHash(head.slice(0, 4000) + st.size),
    nameKey: norm(name),
    image: null,
    equipped: false
  });
}

async function handleAgent(rootPath, file) {
  const head = await readFile(file, "utf8").catch(() => "");
  const fm = parseFrontmatter(head);
  if (!fm.name && !fm.description) return; // frontmatter 없는 일반 md 제외
  const st = await stat(file).catch(() => null);
  if (!st) return;
  const repo = repoOf(rootPath, file);
  const relPath = relative(rootPath, file).split(sep).join("/");
  const name = fm.name || basename(file).replace(/\.md$/i, "");
  // git 신선도 (skill과 동일 방식)
  const gitMap = await getGitMtimeMap(repoDirOf(rootPath, repo));
  const relInRepo = relPath.split("/").slice(1).join("/");
  const freshMs = effectiveMtimeMs(gitMap, relInRepo, st.mtimeMs);
  const stats = computeStats({ repo, size: st.size, mtimeMs: st.mtimeMs, freshMs, fm, kind: "agent", refCount: 0 });
  // 모델 tier로 등급 살짝 가산
  const r = rarityOf(stats, null);
  const tier = (fm.model || "").toLowerCase();
  if (tier.includes("opus")) r.rarity = "legendary";
  else if (tier.includes("sonnet") && r.rarity === "common") r.rarity = "uncommon";
  items.push({
    id: `${repo}/${relPath}`,
    kind: "agent",
    name,
    displayName: name,
    description: (fm.description || "").toString().slice(0, 600),
    category: "agent",
    source: { repo, owner: ownerGuess(repo), path: relPath, root: rootPath, sizeBytes: st.size, mtime: Math.round(freshMs) },
    meta: { model: fm.model || null, role: fm.role || null, allowedTools: fm.tools || fm["allowed-tools"] || null },
    stats,
    score: r.score,
    rarity: r.rarity,
    contentHash: quickHash(head.slice(0, 4000) + st.size),
    nameKey: norm(name),
    image: null,
    equipped: false
  });
}

async function handleMcpFile(rootPath, file) {
  const txt = await readFile(file, "utf8").catch(() => "");
  let servers = {};
  try {
    const j = JSON.parse(txt);
    servers = j.mcpServers || (j.command ? { [basename(file)]: j } : {});
  } catch {
    return;
  }
  const repo = repoOf(rootPath, file);
  for (const [name, def] of Object.entries(servers)) {
    items.push(mcpItem(name, def, { repo, owner: ownerGuess(repo), path: relative(rootPath, file).split(sep).join("/"), root: rootPath }));
  }
}

function mcpItem(name, def, source) {
  const cmd = def?.command ? `${def.command} ${(def.args || []).join(" ")}`.trim() : (def?.url || "");
  const stats = {
    popularity: 60, freshness: 70,
    power: clamp(40 + (def?.args?.length || 0) * 6 + (def?.url ? 20 : 0)),
    clarity: clamp(cmd ? 70 : 40),
    weight: 30
  };
  const r = rarityOf(stats, null);
  // 스키마 일관성: 모든 MCP item의 source가 {repo,owner,path,sizeBytes,mtime}를 갖도록 보강.
  // sizeBytes는 정의 직렬화 길이로 근사, mtime은 0(시간 비의존 → 멱등).
  const fullSource = {
    repo: source.repo || "cc-config",
    owner: source.owner || "unknown",
    path: source.path || "",
    root: source.root || join(homedir(), ".claude"),
    sizeBytes: source.sizeBytes ?? Buffer.byteLength(JSON.stringify(def || {}), "utf8"),
    mtime: source.mtime ?? 0,
    ...(source.fromCc ? { fromCc: true } : {})
  };
  return {
    id: `mcp/${source.repo || "cc-config"}/${name}`,
    kind: "mcp",
    name, displayName: name,
    description: cmd ? `명령: ${cmd}` : "MCP 서버",
    category: "weapon",
    source: fullSource,
    meta: { command: def?.command || null, args: def?.args || [], url: def?.url || null, env: def?.env ? Object.keys(def.env) : [] },
    stats, score: r.score, rarity: r.rarity,
    contentHash: quickHash(JSON.stringify(def)),
    nameKey: norm(name), image: null, equipped: false
  };
}

async function scanCcMcp() {
  for (const cand of cfg.ccConfigCandidates) {
    const p = expandHome(cand);
    if (!existsSync(p)) continue;
    const txt = await readFile(p, "utf8").catch(() => "");
    try {
      const j = JSON.parse(txt);
      const servers = j.mcpServers || {};
      for (const [name, def] of Object.entries(servers)) {
        items.push(mcpItem(name, def, { repo: "cc-config", owner: "me", path: cand, root: join(homedir(), ".claude"), fromCc: true }));
      }
    } catch {}
  }
}

// ---------- 메인 ----------
// 소스 루트: data/sources.json(사용자 관리) → 없으면 config.json + ~/.claude 시드.
const sourceRoots = loadRoots();
console.log(`📂 스캔 루트 ${sourceRoots.length}개:\n   ${sourceRoots.join("\n   ")}`);
for (const rootPath of sourceRoots) {
  if (!existsSync(rootPath)) {
    console.warn(`⚠️  소스 없음(건너뜀): ${rootPath}`);
    continue;
  }
  await walk(rootPath, async (file) => {
    if (scanned >= cfg.maxScanFiles) return;
    const lower = file.toLowerCase();
    const base = basename(lower);
    if (base === "skill.md") { scanned++; await handleSkill(rootPath, file); }
    else if (lower.includes(`${sep}agents${sep}`) && base.endsWith(".md")) { scanned++; await handleAgent(rootPath, file); }
    else if (base === ".mcp.json" || base === "mcp.json") { scanned++; await handleMcpFile(rootPath, file); }
  });
}
await scanCcMcp();

// ── 동일 내용 복사본 디듀프 ────────────────────────────────────────────────
// antigravity-awesome-skills 등은 같은 스킬을 여러 번들 플러그인에 그대로 복제한다.
// (예: googlesheets-automation 이 10개 경로에 존재, 내용은 동일)
// kind+contentHash 가 같으면 같은 스킬의 복사본으로 보고 대표 1장만 남긴다.
{
  const before = items.length;
  const byHash = new Map();
  for (const it of items) {
    const key = it.kind + "|" + it.contentHash;
    if (!byHash.has(key)) byHash.set(key, []);
    byHash.get(key).push(it);
  }
  const deduped = [];
  for (const arr of byHash.values()) {
    if (arr.length === 1) { deduped.push(arr[0]); continue; }
    // 대표: 점수 높은 것 → 경로 짧은(원본스러운) 것
    arr.sort((a, b) => (b.score - a.score) || (a.source.path.length - b.source.path.length));
    const rep = arr[0];
    rep.copies = arr.length;                                   // 동일 복사본 수
    rep.copySources = [...new Set(arr.map((x) => x.source.repo))];
    rep.copyPaths = arr.slice(1, 6).map((x) => x.source.path); // 일부 위치만
    deduped.push(rep);
  }
  items.length = 0;
  items.push(...deduped);
  console.log(`🧹 동일 복사본 디듀프: ${before} → ${items.length} (제거 ${before - items.length})`);
}

// 중복 그룹: 같은 nameKey가 2개 이상 → group 지정.
// 단, "readme/index" 같은 너무 흔한 일반 단어와 지나치게 짧은 키는 그룹에서 제외한다.
const STOP_NAMEKEYS = new Set([
  "readme", "index", "skill", "agent", "main", "config", "setup", "test",
  "template", "example", "default", "untitled", "todo", "notes", "draft"
]);
const isGroupableKey = (k) => !!k && k.length >= 4 && !STOP_NAMEKEYS.has(k);

// 모든 item에 group 필드 기본값(null) 보장 — 스키마 일관성.
for (const it of items) if (!("group" in it)) it.group = null;

const byKey = new Map();
for (const it of items) {
  if (!byKey.has(it.nameKey)) byKey.set(it.nameKey, []);
  byKey.get(it.nameKey).push(it);
}
const groupedKeys = new Set();
for (const [key, arr] of byKey) {
  if (arr.length > 1 && isGroupableKey(key)) {
    groupedKeys.add(key);
    for (const it of arr) it.group = key;
  }
}

// 등급 재배치: 점수 백분위 기반 카드게임식 피라미드 (대부분 흔하고, 소수만 전설)
{
  const scored = [...items].sort((a, b) => a.score - b.score);
  const n = Math.max(1, scored.length);
  scored.forEach((it, i) => {
    const pct = i / n;
    let rarity = "common";
    if (pct >= 0.97) rarity = "legendary";
    else if (pct >= 0.85) rarity = "epic";
    else if (pct >= 0.6) rarity = "rare";
    else if (pct >= 0.3) rarity = "uncommon";
    it.rarity = rarity;
  });
  // opus 에이전트는 항상 전설
  for (const it of items)
    if (it.kind === "agent" && (it.meta.model || "").toLowerCase().includes("opus"))
      it.rarity = "legendary";
}

// 정렬: 종류 → 점수 내림차순
items.sort((a, b) => (a.kind.localeCompare(b.kind)) || (b.score - a.score));

const counts = items.reduce((acc, it) => ((acc[it.kind] = (acc[it.kind] || 0) + 1), acc), {});
const dupGroups = groupedKeys.size;

const index = {
  generatedAt: new Date().toISOString(),
  sourceRoots,
  counts,
  dupGroups,
  total: items.length,
  items
};

await mkdir(dataDir, { recursive: true });
await writeFile(join(dataDir, "index.json"), JSON.stringify(index, null, 0));
console.log(`✅ 스캔 완료 — skill:${counts.skill || 0} agent:${counts.agent || 0} mcp:${counts.mcp || 0} (중복그룹 ${dupGroups}) → data/index.json`);
