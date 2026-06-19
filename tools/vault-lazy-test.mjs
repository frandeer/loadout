// vault.mjs lazy-import 확장(moveToVault / setActive onResident:'vault' / resolveDivergence) 샌드박스 테스트.
// 실 ~/.claude / 실 vault는 절대 건드리지 않는다 — 모든 경로는 os.tmpdir() 아래 임시 샌드박스로 주입한다.
// 실행: node D:\lab\loadout\tools\vault-lazy-test.mjs
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, lstatSync, readFileSync, rmSync } from "node:fs";
import { join, sep } from "node:path";
import { tmpdir } from "node:os";
import {
  moveToVault, setActive, resolveDivergence, dirHash, isJunction,
} from "../src/vault.mjs";

let passes = 0;
const total = 4;
const log = (...a) => console.log(...a);

// ----- 샌드박스 구성 -----
const sandbox = mkdtempSync(join(tmpdir(), "vault-lazy-test-"));
const vaultRoot = join(sandbox, "vault");
const claudeDir = join(sandbox, "claude");      // 가짜 ~/.claude
const backupDir = join(sandbox, "backup");      // 가짜 백업 루트
mkdirSync(vaultRoot, { recursive: true });
mkdirSync(claudeDir, { recursive: true });
mkdirSync(backupDir, { recursive: true });

const liveName = "fake-skill";                  // 상주 스킬 폴더명(=같은-자리 이름)
const residentDir = join(claudeDir, "skills", liveName);

// 가짜 item: source가 claudeDir 아래 상주 스킬(skills/<liveName>/SKILL.md)을 가리킨다.
//   resolveSourcePath(item) === residentDir (skill = SKILL.md의 dirname)
//   liveDestForManaged(item, claudeDir, liveName) === residentDir (같은-자리)
const item = {
  id: "fake-skill/SKILL.md",
  kind: "skill",
  name: liveName,
  source: { root: claudeDir, path: join("skills", liveName, "SKILL.md"), owner: "tester" },
};

// 상주 스킬 폴더를 (재)생성 — SKILL.md + 하위 디렉토리/파일 포함.
function buildResident(extraByte = "") {
  rmSync(residentDir, { recursive: true, force: true });
  mkdirSync(join(residentDir, "sub"), { recursive: true });
  writeFileSync(join(residentDir, "SKILL.md"), "# Fake Skill\n본문 내용입니다." + extraByte);
  writeFileSync(join(residentDir, "sub", "extra.txt"), "subdir 파일 내용");
}

// 샌드박스 전체 해시(dryRun 불변 검증용) — 임시 디렉토리 트리를 평탄화해 해시.
function snapshotHash(rootPath) {
  return dirHash(rootPath); // dirHash는 디렉토리 전체를 안정적으로 해시(심링크 제외)
}

let result = { code: 1 };
try {
  // ============ Test 1: moveToVault ============
  await (async () => {
    buildResident();
    const preHash = await dirHash(residentDir);
    const mv = await moveToVault(item, { vaultRoot });
    const okReturn = mv && mv.ok === true && typeof mv.vaultPath === "string";
    const vaultExists = okReturn && existsSync(mv.vaultPath);
    const vaultHash = vaultExists ? await dirHash(mv.vaultPath) : null;
    const hashMatch = vaultHash === preHash;
    const originalGone = !existsSync(residentDir);
    const pass = okReturn && vaultExists && hashMatch && originalGone;
    if (pass) passes++;
    log(`Test 1 (moveToVault): ${pass ? "PASS" : "FAIL"}`);
    log(`  return.ok=${mv?.ok} vaultExists=${vaultExists} hashMatch=${hashMatch} originalGone=${originalGone}`);
    log(`  preHash=${preHash}`);
    log(`  vaultHash=${vaultHash}`);
    if (!pass) log(`  >>> mv=`, JSON.stringify(mv));
  })();

  // ============ Test 2: lazy OFF (onResident:'vault') → ON 라운드트립 ============
  await (async () => {
    buildResident();
    const preHash = await dirHash(residentDir);

    // OFF: 상주를 vault로 무손실 MOVE.
    const off = await setActive(item, false, { vaultRoot, claudeDir, backupDir, liveName, onResident: "vault" });
    const destGone = !existsSync(residentDir);
    const vaultPath = off?.moved?.vaultPath || off?.vaultSrc;
    const vaultExists = !!(vaultPath && existsSync(vaultPath));
    const vaultHash = vaultExists ? await dirHash(vaultPath) : null;
    const offOk = off?.ok === true && destGone && vaultExists && vaultHash === preHash;

    // ON: vault에서 같은-자리로 다시 링크.
    const on = await setActive(item, true, { vaultRoot, claudeDir, backupDir, liveName, vaultPath });
    const destExists = existsSync(residentDir);
    const st = destExists ? lstatSync(residentDir) : null;
    const isLinky = destExists && (st.isSymbolicLink() || isJunction(residentDir));
    let readThrough = false;
    try { readThrough = existsSync(join(residentDir, "SKILL.md")) && readFileSync(join(residentDir, "SKILL.md"), "utf8").includes("Fake Skill"); } catch {}
    const onOk = on?.ok === true && destExists && isLinky && readThrough;

    const pass = offOk && onOk;
    if (pass) passes++;
    log(`Test 2 (lazy OFF→ON round-trip): ${pass ? "PASS" : "FAIL"}`);
    log(`  OFF: ok=${off?.ok} destGone=${destGone} vaultExists=${vaultExists} hashEq=${vaultHash === preHash} (planned moved=${!!off?.moved})`);
    log(`  ON : ok=${on?.ok} destExists=${destExists} isLink=${isLinky} readThrough=${readThrough}`);
    if (!pass) { log(`  >>> off=`, JSON.stringify(off)); log(`  >>> on=`, JSON.stringify(on)); }
  })();

  // ============ Test 3: resolveDivergence 'pull' (live→vault) ============
  await (async () => {
    // 깨끗한 상태로: 상주(ON 링크) 제거하고 vault/상주를 새로 만든다.
    rmSync(residentDir, { recursive: true, force: true });
    // 1) vault 사본을 만든다(moveToVault로 상주 한 부 흡수).
    buildResident();
    const mv = await moveToVault(item, { vaultRoot });
    const vaultPath = mv.vaultPath;
    // 2) 상주를 한 바이트 다르게 재생성(분기 유발).
    buildResident("X"); // SKILL.md 끝에 1바이트 추가 → live != vault
    const vaultHashBefore = await dirHash(vaultPath);
    const liveHashBefore = await dirHash(residentDir);
    const diverged = vaultHashBefore !== liveHashBefore;

    const r = await resolveDivergence(item, "pull", { vaultRoot, claudeDir, backupDir, liveName, vaultPath });
    const vaultHashAfter = await dirHash(vaultPath);
    const liveHashAfter = await dirHash(residentDir);
    const converged = vaultHashAfter === liveHashAfter;
    const backupMade = !!(r?.backupTo && existsSync(r.backupTo));
    const pass = diverged && r?.ok === true && converged && backupMade;
    if (pass) passes++;
    log(`Test 3 (resolveDivergence pull): ${pass ? "PASS" : "FAIL"}`);
    log(`  diverged(before)=${diverged} ok=${r?.ok} converged(vault==live)=${converged} backupMade=${backupMade}`);
    log(`  vaultHash ${vaultHashBefore} -> ${vaultHashAfter}`);
    log(`  liveHash  ${liveHashBefore} -> ${liveHashAfter}`);
    if (!pass) log(`  >>> r=`, JSON.stringify(r));
  })();

  // ============ Test 4: dryRun 안전성 (어떤 함수도 디스크를 바꾸지 않음) ============
  await (async () => {
    // 분기 상태를 유지한 채(현재: vault==live) 한 바이트 다시 틀어 분기 만들고 스냅샷.
    buildResident("Y"); // live를 vault와 다르게 (Test3에서 vault==live였으므로)
    const beforeSnap = await snapshotHash(sandbox);

    // vaultPath 계산: Test3에서 만든 vault 사본을 다시 찾는다(규약 경로).
    const vaultPathGuess = join(vaultRoot, "skills", "tester__" + liveName);
    const vaultPath = existsSync(vaultPathGuess) ? vaultPathGuess : null;

    const d1 = await moveToVault(item, { vaultRoot, dryRun: true });
    const d2 = await setActive(item, false, { vaultRoot, claudeDir, backupDir, liveName, onResident: "vault", dryRun: true });
    const d3 = await resolveDivergence(item, "pull", { vaultRoot, claudeDir, backupDir, liveName, vaultPath, dryRun: true });
    const d4 = await resolveDivergence(item, "push", { vaultRoot, claudeDir, backupDir, liveName, vaultPath, dryRun: true });

    const afterSnap = await snapshotHash(sandbox);
    const unchanged = beforeSnap === afterSnap;
    // dryRun 반환이 계획을 보고하는지(FS는 안 건드림).
    const reported =
      d1?.dryRun === true && d1?.to &&
      d2?.dryRun === true && d2?.plan?.action === "move-to-vault" &&
      d3?.dryRun === true && d3?.plan?.action === "pull" &&
      d4?.dryRun === true && d4?.plan?.action === "push";
    const pass = unchanged && reported;
    if (pass) passes++;
    log(`Test 4 (dryRun safety): ${pass ? "PASS" : "FAIL"}`);
    log(`  diskUnchanged=${unchanged} plansReported=${reported}`);
    log(`  d1.to=${d1?.to ? "set" : "MISSING"} d2.action=${d2?.plan?.action} d3.action=${d3?.plan?.action} d4.action=${d4?.plan?.action}`);
    if (!pass) {
      log(`  beforeSnap=${beforeSnap}`);
      log(`  afterSnap =${afterSnap}`);
      if (!reported) { log(`  >>> d1=`, JSON.stringify(d1)); log(`  >>> d2=`, JSON.stringify(d2)); log(`  >>> d3=`, JSON.stringify(d3)); log(`  >>> d4=`, JSON.stringify(d4)); }
    }
  })();

  log("");
  log(`RESULT: ${passes}/${total} PASS`);
  result = { code: passes === total ? 0 : 1 };
} catch (e) {
  log("TEST HARNESS ERROR:", e && e.stack ? e.stack : e);
  log(`RESULT: ${passes}/${total} PASS`);
  result = { code: 1 };
} finally {
  // 정리: 임시 샌드박스 제거.
  try { rmSync(sandbox, { recursive: true, force: true }); } catch {}
}
process.exit(result.code);
