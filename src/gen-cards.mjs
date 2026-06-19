#!/usr/bin/env node
// gen-cards.mjs — 스킬 카드 아트 배치 생성기
// 사용법: node src/gen-cards.mjs [옵션]
//
// 옵션:
//   --engine=grok|chatgpt   이미지 생성 백엔드 (기본: grok)
//   --kind=skill|agent|mcp  아이템 종류 필터
//   --rarity=legendary|epic|rare|uncommon|common  등급 필터
//   --limit=N               최대 처리 개수 (기본: 20)
//   --ids=a,b,c             특정 id만 처리 (쉼표 구분)
//   --force                 이미 생성된 항목도 재생성
//   --delayMs=2000          각 생성 사이 대기 ms (기본: 2000)
//   --dry-run               실제 생성 없이 선택 목록만 출력
//   --help                  도움말 출력

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// ── 경로 상수 ─────────────────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const INDEX_PATH = join(REPO_ROOT, "data", "index.json");
const MAP_PATH = join(REPO_ROOT, "data", "card-images.json");
const OUT_DIR = join(REPO_ROOT, "media", "generated", "cards");

// ── 동적 import (실행 시 로드) ─────────────────────────────────────────────────
async function loadDeps() {
  const [{ generate }, { buildPrompt }] = await Promise.all([
    import("../skills/web-image-forge/lib/imagegen.js"),
    import("../skills/web-image-forge/prompts.js"),
  ]);
  return { generate, buildPrompt };
}

// ── CLI 파싱 ──────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const args = {
    engine: "grok",
    kind: null,
    rarity: null,
    limit: 20,
    ids: null,
    force: false,
    delayMs: 2000,
    dryRun: false,
    help: false,
  };

  for (const raw of argv.slice(2)) {
    if (raw === "--help" || raw === "-h") { args.help = true; continue; }
    if (raw === "--force") { args.force = true; continue; }
    if (raw === "--dry-run") { args.dryRun = true; continue; }

    const [key, val] = raw.startsWith("--") ? raw.slice(2).split("=") : [null, null];
    if (!key || val === undefined) {
      console.error(`알 수 없는 인자: ${raw}`);
      process.exit(1);
    }
    switch (key) {
      case "engine":  args.engine  = val; break;
      case "kind":    args.kind    = val; break;
      case "rarity":  args.rarity  = val; break;
      case "limit":   args.limit   = Math.max(1, parseInt(val, 10) || 20); break;
      case "ids":     args.ids     = val.split(",").map(s => s.trim()).filter(Boolean); break;
      case "delayMs": args.delayMs = Math.max(0, parseInt(val, 10) || 2000); break;
      default:
        console.error(`알 수 없는 옵션: --${key}`);
        process.exit(1);
    }
  }
  return args;
}

function printHelp() {
  console.log(`
gen-cards.mjs — 스킬 카드 아트 배치 생성기

사용법:
  node src/gen-cards.mjs [옵션]

옵션:
  --engine=grok|chatgpt    이미지 생성 백엔드 (기본: grok)
  --kind=skill|agent|mcp   아이템 종류 필터
  --rarity=<등급>           등급 필터 (legendary|epic|rare|uncommon|common)
  --limit=N                최대 처리 개수 (기본: 20)
  --ids=a,b,c              특정 id만 처리 (쉼표 구분)
  --force                  이미 생성된 항목도 재생성
  --delayMs=2000           각 생성 사이 대기 ms (기본: 2000)
  --dry-run                실제 생성 없이 선택 목록만 출력
  --help                   이 도움말 출력

예시:
  node src/gen-cards.mjs --engine=grok --rarity=legendary --limit=10
  node src/gen-cards.mjs --engine=chatgpt --kind=agent --limit=5 --force
  node src/gen-cards.mjs --ids=foo,bar --dry-run
  node src/gen-cards.mjs --dry-run --limit=5
`);
}

// ── 유틸 ──────────────────────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function loadJson(path, fallback) {
  try {
    const text = await readFile(path, "utf8");
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

async function saveJson(path, data) {
  await writeFile(path, JSON.stringify(data, null, 2), "utf8");
}

// ── 아이템 필터링 및 정렬 ───────────────────────────────────────────────────────
function selectItems(items, args, existingMap) {
  let filtered = items;

  // ids 지정 시 해당 항목만
  if (args.ids && args.ids.length > 0) {
    const idSet = new Set(args.ids);
    filtered = filtered.filter(item => idSet.has(item.id));
  } else {
    // kind 필터
    if (args.kind) {
      filtered = filtered.filter(item => item.kind === args.kind);
    }
    // rarity 필터
    if (args.rarity) {
      filtered = filtered.filter(item => item.rarity === args.rarity);
    }
  }

  // --force 없으면 이미 생성된 항목 제외
  if (!args.force) {
    filtered = filtered.filter(item => !existingMap[item.id]);
  }

  // score 내림차순 (전설/고득점 우선)
  filtered = filtered.slice().sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  // limit 적용
  filtered = filtered.slice(0, args.limit);

  return filtered;
}

// ── 메인 ──────────────────────────────────────────────────────────────────────
async function main() {
  const args = parseArgs(process.argv);

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  // 엔진 유효성 검사
  if (!["grok", "chatgpt"].includes(args.engine)) {
    console.error(`오류: --engine은 "grok" 또는 "chatgpt"여야 합니다. 입력값: "${args.engine}"`);
    process.exit(1);
  }

  // index.json 로드
  console.log("index.json 로드 중...");
  let indexData;
  try {
    indexData = await loadJson(INDEX_PATH, null);
  } catch (e) {
    console.error(`오류: index.json 읽기 실패 — ${e.message}`);
    process.exit(1);
  }
  if (!indexData || !Array.isArray(indexData.items)) {
    console.error("오류: index.json 형식이 잘못되었습니다 (items 배열 없음).");
    process.exit(1);
  }

  // card-images.json 로드 (없으면 빈 객체)
  const existingMap = await loadJson(MAP_PATH, {});

  // 아이템 선택
  const selected = selectItems(indexData.items, args, existingMap);

  if (selected.length === 0) {
    console.log("처리할 항목이 없습니다. (--force로 재생성하거나 필터를 조정하세요)");
    process.exit(0);
  }

  // dry-run: 목록만 출력하고 종료
  if (args.dryRun) {
    console.log(`\n[dry-run] 선택된 ${selected.length}개 항목 (score 내림차순):\n`);
    selected.forEach((item, i) => {
      const already = existingMap[item.id] ? " [이미 생성됨]" : "";
      console.log(
        `  ${String(i + 1).padStart(3)}. [${item.rarity ?? "?"}] ${item.kind}/${item.name}` +
        `  (score=${item.score ?? "?"})${already}`
      );
    });
    console.log(`\nengine: ${args.engine}, delayMs: ${args.delayMs}ms`);
    console.log("실제 생성하려면 --dry-run을 제거하세요.");
    process.exit(0);
  }

  // outDir 준비
  await mkdir(OUT_DIR, { recursive: true });

  // deps 로드 (실제 생성 시에만)
  const { generate, buildPrompt } = await loadDeps();

  const total = selected.length;
  let successCount = 0;
  let failCount = 0;

  console.log(`\n카드 생성 시작: 총 ${total}개, engine=${args.engine}, outDir=${OUT_DIR}\n`);

  for (let i = 0; i < selected.length; i++) {
    const item = selected[i];
    const idx = `[${i + 1}/${total}]`;

    // 이미 있고 --force 없으면 건너뜀 (selectItems에서 걸러지지만 동시 실행 방어)
    if (!args.force && existingMap[item.id]) {
      console.log(`${idx} ${item.name} — 건너뜀 (이미 생성됨)`);
      continue;
    }

    const prompt = buildPrompt("card", {
      name: item.name,
      kind: item.kind,
      category: item.category,
      rarity: item.rarity,
      description: item.description,
    });

    process.stdout.write(`${idx} ${item.name} (${item.rarity ?? "?"}) ... `);

    try {
      const results = await generate({
        engine: args.engine,
        prompt,
        count: 1,
        outDir: OUT_DIR,
      });

      if (!results || results.length === 0) {
        throw new Error("generate()가 빈 배열을 반환했습니다.");
      }

      const { filename } = results[0];
      const webPath = `/media/generated/cards/${filename}`;

      // 매핑 즉시 저장 (중단 복구 가능)
      existingMap[item.id] = webPath;
      await saveJson(MAP_PATH, existingMap);

      console.log(`ok → ${filename}`);
      successCount++;
    } catch (err) {
      console.log(`실패 — ${err.message}`);
      failCount++;
    }

    // 마지막 항목이 아닐 때만 대기
    if (i < selected.length - 1 && args.delayMs > 0) {
      await sleep(args.delayMs);
    }
  }

  console.log(`\n완료: 성공 ${successCount}개, 실패 ${failCount}개 / 총 ${total}개`);
  if (failCount > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error("예기치 않은 오류:", err);
  process.exit(1);
});
