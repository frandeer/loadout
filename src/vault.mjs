// Loadout Vault — 스킬/에이전트를 vault로 무손실 복사(가져오기)하고, vault<->~/.claude 상태를
// 읽기 전용으로 점검한다. Phase E1: 복사 + 읽기 전용 status 만. 실제 링크/이동은 E2(별도 단위).
// Node 내장 모듈만 사용(ESM). 멱등 지향(같은 입력 -> 같은 출력; dirHash는 시간 비의존).
//
// 안전 규약(E1):
//   - import = 순수 복사. 원본은 절대 건드리지 않는다.
//   - status = 읽기 전용. ~/.claude 아래 어떤 것도 이동/삭제/링크/수정하지 않는다.
//   - activate/deactivate = E2용 크로스플랫폼 프리미티브를 "작성만" 한다. E1에서는 실데이터 경로로 호출하지 않는다.
import { readdir, readFile, writeFile, mkdir, rename, rm, cp } from "node:fs/promises";
import * as fsSync from "node:fs";
import { existsSync, lstatSync, readlinkSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, resolve, dirname, basename, relative, sep } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const dataDir = join(root, "data");
const claudeHome = join(homedir(), ".claude");
const claudeSkills = join(claudeHome, "skills");
const claudeAgents = join(claudeHome, "agents");

// 기본 vault 위치(프로젝트 내, gitignore). 호출부에서 vaultRoot를 넘기면 그걸 우선한다.
export const defaultVaultRoot = join(root, "vault");
// 기본 활성화 표면(~/.claude)과 백업 루트. setActive/deactivate가 주입받지 못하면 이 실경로를 쓴다.
export const defaultClaudeDir = claudeHome;
export const defaultBackupDir = join(claudeHome, ".loadout-backup");

// ---------- 경로/이름 유틸 ----------
// vault 폴더/파일명 안전화: 경로 구분자만 제거하고 한국어/유니코드는 보존(scan의 sanitize와 동일 정신).
function sanitizeName(s) {
  return String(s || "item")
    .replace(/[\\/]+/g, "-")        // 경로 구분자 -> 대시(디렉토리 탈출 방지)
    .replace(/[<>:"|?*]/g, "_")     // Windows 금지문자
    .replace(/[\x00-\x1f]/g, "_")   // 제어문자
    .replace(/^\.+/, "_")           // 선행 점(상위경로/숨김) 차단
    .replace(/[. ]+$/, "")          // Windows: 후행 점/공백 금지
    .slice(0, 120) || "item";
}

// 아이템의 원본 경로 -> 디스크상의 실제 위치 해석.
// skill: SKILL.md의 디렉토리(=스킬 폴더). agent: .md 파일 그 자체.
function resolveSourcePath(item) {
  if (!item?.source?.root || !item?.source?.path) return null;
  const full = resolve(item.source.root, item.source.path);
  if (!existsSync(full)) return null;
  if (item.kind === "skill") return dirname(full); // 스킬 폴더
  return full;                                      // agent .md 파일
}

// vault 내 목적지 경로(아직 생성 전). skill -> vault/skills/<owner>__<name>/, agent -> vault/agents/<name>.md
function vaultDestFor(item, vaultRoot) {
  if (item.kind === "skill") {
    const owner = sanitizeName(item.source?.owner || "unknown");
    const name = sanitizeName(item.name || basename(item.id));
    return { dir: join(vaultRoot, "skills"), leaf: `${owner}__${name}`, isDir: true };
  }
  if (item.kind === "agent") {
    const name = sanitizeName(item.name || basename(item.id).replace(/\.md$/i, ""));
    return { dir: join(vaultRoot, "agents"), leaf: `${name}.md`, isDir: false };
  }
  return null; // mcp/memory는 E1 import 대상 아님
}

// 충돌 시 -2, -3 ... 접미사로 유일화(scan의 디듀프 정신). 디렉토리/파일 모두 대응.
// taken: 이미 사용 중인 leaf 이름 Set(같은 배치 내 중복까지 막기 위함).
function uniqueLeaf(parentDir, leaf, isDir, taken) {
  const dot = isDir ? -1 : leaf.lastIndexOf(".");
  const base = dot > 0 ? leaf.slice(0, dot) : leaf;
  const ext = dot > 0 ? leaf.slice(dot) : "";
  let candidate = leaf;
  let n = 2;
  while (taken.has(candidate) || existsSync(join(parentDir, candidate))) {
    candidate = `${base}-${n}${ext}`;
    n++;
  }
  taken.add(candidate);
  return candidate;
}

// ---------- 디렉토리 해시(분기 감지용) ----------
// 디렉토리의 전체 내용을 안정적으로 해시: 정렬된 (상대경로, 크기, 파일내용해시) 목록을 합쳐 SHA-256.
// 단일 파일이면 그 파일만 해시. 시간(mtime) 비의존 -> 멱등. 심볼릭링크는 따라가지 않고 무시(루프/외부 회피).
async function collectFiles(dirPath, baseDir, out) {
  let entries;
  try { entries = await readdir(dirPath, { withFileTypes: true }); }
  catch { return; }
  entries.sort((a, b) => a.name.localeCompare(b.name)); // 결정적 순서
  for (const e of entries) {
    const full = join(dirPath, e.name);
    if (e.isSymbolicLink()) continue;        // 링크는 해시에서 제외(타겟 따라가지 않음)
    if (e.isDirectory()) {
      await collectFiles(full, baseDir, out);
    } else if (e.isFile()) {
      const rel = relative(baseDir, full).split(sep).join("/");
      out.push({ rel, full });
    }
  }
}

export async function dirHash(targetPath) {
  let st;
  try { st = lstatSync(targetPath); } catch { return null; } // 존재하지 않으면 null
  const h = createHash("sha256");
  if (st.isDirectory()) {
    const files = [];
    await collectFiles(targetPath, targetPath, files);
    files.sort((a, b) => a.rel.localeCompare(b.rel)); // 경로 정렬 -> 순서 무관 안정성
    for (const f of files) {
      let buf;
      try { buf = await readFile(f.full); } catch { buf = Buffer.alloc(0); }
      const fh = createHash("sha256").update(buf).digest("hex");
      h.update(f.rel).update("\0").update(String(buf.length)).update("\0").update(fh).update("\n");
    }
  } else if (st.isFile()) {
    let buf;
    try { buf = await readFile(targetPath); } catch { buf = Buffer.alloc(0); }
    const fh = createHash("sha256").update(buf).digest("hex");
    h.update(basename(targetPath)).update("\0").update(String(buf.length)).update("\0").update(fh);
  } else {
    return null; // 심볼릭링크/기타는 해시 대상 아님(상위에서 따로 판정)
  }
  return "d" + h.digest("hex").slice(0, 32);
}

// ---------- 크로스플랫폼 링크 프리미티브 (E2용 — E1에서는 실데이터로 호출 금지) ----------
// src = vault 경로(진실의 출처), dest = ~/.claude/... 경로(활성화 표면).
// 동기 fs로 작성(스펙 시그니처와 일치). 단위 테스트는 임시 디렉토리에서만 수행할 것.
export function activate(kind, src, dest) {
  if (kind === "skill") {                       // 폴더: junction(Windows) / symlink dir(mac/linux)
    fsSync.symlinkSync(src, dest, process.platform === "win32" ? "junction" : "dir");
  } else if (kind === "agent") {                // 파일: Windows는 복사(파일 심링크=관리자 필요), 그 외 symlink
    if (process.platform === "win32") fsSync.cpSync(src, dest, { recursive: false });
    else fsSync.symlinkSync(src, dest, "file");
  }
}

// dest가 링크/복사본이면 제거(vault 불가침). 상주 실폴더/실파일은 백업 디렉토리로 "이동"(하드삭제 금지).
// ts: 백업 타임스탬프(서버 컨텍스트에서는 요청 시각을 넘기는 것을 권장).
// backupDir: 백업 루트 주입점(기본 ~/.claude/.loadout-backup). 샌드박스 테스트에서 실경로 대신 임시경로로 덮어쓴다.
export function deactivate(dest, ts = Date.now(), backupDir = defaultBackupDir) {
  let st;
  try { st = fsSync.lstatSync(dest); } catch { return { action: "noop", reason: "not-found" }; }
  if (st.isSymbolicLink()) {                    // symlink -> 링크만 제거(vault 보존)
    fsSync.unlinkSync(dest);
    return { action: "unlink" };
  }
  if (isJunction(dest)) {                        // Windows junction -> 정션만 제거(타겟 보존, 따라 들어가지 않음)
    fsSync.rmSync(dest, { recursive: false, force: true });
    return { action: "remove-junction" };
  }
  if (st.isDirectory() || st.isFile()) {         // 상주 실폴더/실파일 -> 백업으로 이동(삭제 아님)
    const backupRoot = join(backupDir, String(ts));
    fsSync.mkdirSync(backupRoot, { recursive: true });
    const moved = join(backupRoot, basename(dest));
    fsSync.renameSync(dest, moved);
    return { action: "backup-move", to: moved };
  }
  return { action: "noop", reason: "unknown-type" };
}

// 경로가 Windows junction(디렉토리 reparse point)인지 판정. 심볼릭링크가 아니면서 디렉토리고
// readlink가 가능하면 junction으로 본다. 비-Windows에서는 항상 false.
export function isJunction(p) {
  if (process.platform !== "win32") return false;
  let st;
  try { st = lstatSync(p); } catch { return false; }
  if (st.isSymbolicLink()) return false;        // 일반 심링크는 따로 처리됨
  if (!st.isDirectory()) return false;
  try { readlinkSync(p); return true; }          // junction은 readlink가 타겟을 돌려줌
  catch { return false; }
}

// 경로가 "우리 링크"(symlink 또는 junction)인지 — status에서 상주 실폴더와 구분하기 위함.
function isLink(p) {
  let st;
  try { st = lstatSync(p); } catch { return false; }
  if (st.isSymbolicLink()) return true;
  return isJunction(p);
}

// ---------- setActive (실 on/off 오케스트레이션 — E2) ----------
// 활성화 표면(claudeDir) 안의 목적지 경로. equip 규약과 동일: <owner>-<name>(스킬 폴더) / <owner>-<name>.md(에이전트).
// 이 이름은 import가 보존한 "상주 실폴더의 원래 이름"(status의 livePath)과 달라 충돌을 피한다.
function liveDestFor(item, claudeDir) {
  const owner = String(item.source?.owner || "unknown");
  if (item.kind === "skill") {
    const safe = `${owner}-${item.name}`.replace(/[^\w가-힣.-]/g, "_");
    return { kind: "skill", dir: join(claudeDir, "skills"), path: join(claudeDir, "skills", safe), name: safe, isDir: true };
  }
  if (item.kind === "agent") {
    const base = item.name || basename(item.id).replace(/\.md$/i, "");
    const safe = `${owner}-${base}`.replace(/[^\w가-힣.-]/g, "_") + ".md";
    return { kind: "agent", dir: join(claudeDir, "agents"), path: join(claudeDir, "agents", safe), name: safe, isDir: false };
  }
  return null; // mcp/memory는 링크 대상 아님
}

// ---------- E3: 상주 원래 이름 보존 + 같은 자리 링크 ----------
// 아이템이 현재 ~/.claude 아래에서 점유하고 있는 "원래 이름"을 유도한다.
//   - skill: ~/.claude/skills/<폴더명>/SKILL.md 형태이므로 SKILL.md의 부모 폴더명(=스킬 폴더명, 예: "gstack").
//   - agent: ~/.claude/agents/<파일명>.md 형태이므로 .md 파일명 그 자체.
// 소스가 ~/.claude 아래가 "아닌"(외부/클론) 경우 null을 반환한다 — 이런 항목은 상주가 아니므로
// <owner>-<name> 규약(liveDestFor)으로 새 자리에 링크해야 한다.
// 주의: 이 함수는 source가 아직 ~/.claude를 가리킬 때(=cutover/import 시점) 호출해 liveName을 포착해야 한다.
//       scan 루트가 vault로 전환된 뒤에는 source.root가 바뀌어 더는 ~/.claude로 해석되지 않는다.
export function originalLiveName(item) {
  if (!item?.source?.root || !item?.source?.path) return null;
  if (item.kind !== "skill" && item.kind !== "agent") return null;
  const root = resolve(item.source.root);
  // 소스 루트가 ~/.claude 아래인가? (경로 구분자 경계까지 비교 — 접두사 오탐 방지)
  const homeNorm = resolve(claudeHome);
  const rootNorm = root;
  const underHome =
    rootNorm === homeNorm ||
    rootNorm.toLowerCase().startsWith((homeNorm + sep).toLowerCase());
  if (!underHome) return null; // 외부/클론 스킬 — 상주 아님
  const full = resolve(item.source.root, item.source.path);
  if (item.kind === "skill") return basename(dirname(full)); // 스킬 폴더명 (예: gstack)
  return basename(full);                                      // agent .md 파일명
}

// 활성화 표면(claudeDir) 안에서 "원래 이름"(liveName)을 그대로 점유하는 목적지 경로.
// 상주를 백업으로 치우고 그 "같은 자리"에 vault 링크를 거는 용도. liveDestFor(<owner>-<name>)와 달리
// 중복을 만들지 않는다(원래 폴더를 대체). liveName이 비면 null — 호출부가 liveDestFor로 폴백해야 한다.
function liveDestForManaged(item, claudeDir, liveName) {
  if (!liveName) return null;
  // liveName은 단일 경로 세그먼트여야 한다(디렉토리 탈출 방지). 구분자/상위참조가 들어오면 거부.
  if (/[\\/]/.test(liveName) || liveName === "." || liveName === "..") return null;
  if (item.kind === "skill") {
    return { kind: "skill", dir: join(claudeDir, "skills"), path: join(claudeDir, "skills", liveName), name: liveName, isDir: true };
  }
  if (item.kind === "agent") {
    const leaf = /\.md$/i.test(liveName) ? liveName : `${liveName}.md`;
    return { kind: "agent", dir: join(claudeDir, "agents"), path: join(claudeDir, "agents", leaf), name: leaf, isDir: false };
  }
  return null;
}

// vault 안의 원본(진실의 출처) 경로 해석. 1순위: vault.json에 기록된 vaultPath(있고 실재하면).
// 2순위: vaultDestFor 규약으로 계산한 정규 경로. import가 -2 접미사를 붙였을 수 있어 상태파일을 우선한다.
function vaultSrcFor(item, vaultRoot, recordedPath) {
  if (recordedPath && existsSync(recordedPath)) return recordedPath;
  const dest = vaultDestFor(item, vaultRoot);
  if (!dest) return null;
  const canonical = join(dest.dir, dest.leaf);
  return existsSync(canonical) ? canonical : null;
}

// 스킬 링크 검증: 링크가 해석되고 SKILL.md가 링크를 통해 읽히는지. agent는 파일 존재/내용 일치만.
function verifyLinkReadable(kind, destPath) {
  if (!existsSync(destPath)) return { ok: false, reason: "dest가 존재하지 않음" };
  if (kind === "skill") {
    // 링크/정션을 통해 내부 파일이 읽혀야 한다(타겟 해석 확인).
    const candidates = ["SKILL.md", "skill.md"];
    for (const c of candidates) {
      const f = join(destPath, c);
      if (existsSync(f)) {
        try { const txt = fsSync.readFileSync(f, "utf8"); return { ok: true, readThrough: c, bytes: Buffer.byteLength(txt) }; }
        catch (e) { return { ok: false, reason: "링크를 통해 SKILL.md 읽기 실패: " + e.message }; }
      }
    }
    // SKILL.md가 없어도 디렉토리 자체는 열려야 한다(빈 스킬 방어).
    try { fsSync.readdirSync(destPath); return { ok: true, readThrough: null, note: "SKILL.md 없음(디렉토리는 해석됨)" }; }
    catch (e) { return { ok: false, reason: "링크 디렉토리 읽기 실패: " + e.message }; }
  }
  // agent: 파일이 존재하고 읽히면 OK.
  try { const txt = fsSync.readFileSync(destPath, "utf8"); return { ok: true, bytes: Buffer.byteLength(txt) }; }
  catch (e) { return { ok: false, reason: "agent 파일 읽기 실패: " + e.message }; }
}

// 스킬/에이전트의 활성화(켜기/끄기)를 안전하게 토글. activate/deactivate 프리미티브 위에서 동작한다.
// 모든 실경로(vaultRoot, claudeDir, backupDir)는 주입 가능 — 테스트는 샌드박스로 덮어쓴다.
// 켜기 절차: vault 존재 확인 → 상주 실본 백업(이동, 삭제 아님)/잔여 링크 제거 → activate 링크 생성 →
//            링크 해석+읽기 검증 → 실패 시 롤백(부분 링크 제거 + 백업 복원).
// 끄기 절차: deactivate(dest)로 링크 제거/상주본 백업 이동 → dest 부재 검증. vault는 절대 손대지 않음.
// onResident('backup' 기본 | 'vault'): 끄기 시 상주 실본을 어떻게 치울지. 'backup'=기존 동작(백업 이동).
//   'vault'=상주 실본을 vault로 무손실 MOVE(moveToVault) — lazy import. 이 경로(만)는 비동기이므로 Promise를 반환한다.
//   (dest가 우리 링크면 onResident와 무관하게 기존처럼 unlink/remove-junction — 동기 반환.)
// dryRun: 파일시스템 변형 없이 계획(plan)만 반환.
// 반환: 각 단계 결과를 담은 구조화 객체 { ok, id, kind, on, dryRun, dest, vaultSrc, plan|actions, verify?, rolledBack?, error? }.
//   주의: onResident==='vault' + 상주 끄기일 때만 Promise<결과>를, 그 외 모든 경로는 동기 객체를 반환한다
//         (서버/cutover의 기존 호출 형태를 깨지 않기 위함 — 기본 onResident='backup'은 항상 동기).
export function setActive(item, on, opts = {}) {
  const {
    vaultRoot = defaultVaultRoot,
    claudeDir = defaultClaudeDir,
    backupDir = defaultBackupDir,
    dryRun = false,
    ts = Date.now(),
    vaultPath: recordedVaultPath = null,
    liveName = null, // E3: 지정되면 <owner>-<name> 대신 이 "원래 이름" 자리(같은 자리)에 링크한다.
    onResident = "backup", // 끄기 시 상주 실본 처리: 'backup'(기본, 동기) | 'vault'(moveToVault, 비동기).
  } = opts;

  const base = { ok: false, id: item?.id, kind: item?.kind, name: item?.name, on: !!on, dryRun: !!dryRun };
  // E3: liveName이 주어지면 같은-자리 목적지(liveDestForManaged)를 우선. 없으면 기존 <owner>-<name> 규약.
  const live = (liveName && liveDestForManaged(item, claudeDir, liveName)) || liveDestFor(item, claudeDir);
  if (!live) return { ...base, error: `${item?.kind}는 링크 on/off 대상이 아님(skill/agent만)` };
  const dest = live.path;

  // 현재 dest 상태 판정(공통).
  const destExists = existsSync(dest);
  const destIsLink = destExists && isLink(dest);
  const destIsResident = destExists && !destIsLink; // 상주 실폴더/실파일(우리 링크 아님)

  // ===== 끄기 =====
  if (!on) {
    // 상주 실본 + onResident='vault'이면 백업 이동 대신 vault로 무손실 MOVE(lazy import).
    const moveResident = onResident === "vault" && destIsResident;

    if (dryRun) {
      let plannedAction = "noop";
      if (!destExists) plannedAction = "noop(부재)";
      else if (destIsLink) plannedAction = process.platform === "win32" && isJunction(dest) ? "remove-junction" : "unlink";
      else plannedAction = moveResident ? "move-to-vault" : "backup-move"; // 상주본: vault 이동 또는 백업 이동
      const plan = { action: plannedAction, dest };
      if (plannedAction === "backup-move") plan.backupTo = join(backupDir, String(ts), basename(dest));
      else if (plannedAction === "move-to-vault") plan.moveTo = vaultDestFor(item, vaultRoot) ? join(vaultDestFor(item, vaultRoot).dir, vaultDestFor(item, vaultRoot).leaf) : null;
      return {
        ...base, ok: true, dest, vaultSrc: vaultSrcFor(item, vaultRoot, recordedVaultPath), plan,
      };
    }

    // onResident='vault' + 상주: vault로 MOVE(비동기). 이 분기만 Promise를 반환한다.
    if (moveResident) {
      return (async () => {
        let mv;
        try { mv = await moveToVault(item, { vaultRoot, dryRun: false }); }
        catch (e) { return { ...base, dest, error: "vault 이동 실패: " + e.message }; }
        if (!mv.ok) return { ...base, dest, actions: [{ step: "move-to-vault", ok: false }], error: mv.error };
        // 검증: dest가 더 이상 활성 표면에 없어야 한다(상주 원본이 vault로 이동됨).
        if (existsSync(dest)) return { ...base, dest, actions: [{ step: "move-to-vault", to: mv.vaultPath }], error: "끄기 후에도 dest가 남아 있음" };
        // 표준 끄기 반환 형태 + moved/vaultSrc(새 vault 경로) 병합.
        return {
          ...base, ok: true, dest, vaultSrc: mv.vaultPath,
          actions: [{ action: "move-to-vault", to: mv.vaultPath, hash: mv.hash }],
          moved: { vaultPath: mv.vaultPath, hash: mv.hash }, verify: { destPresent: false },
        };
      })();
    }

    // 기존 동작(onResident='backup' 또는 dest가 링크): 백업 이동 / 링크 제거.
    let result;
    try { result = deactivate(dest, ts, backupDir); }
    catch (e) { return { ...base, dest, error: "비활성화 실패: " + e.message }; }
    // 검증: dest가 더 이상 활성 표면에 없어야 한다(백업으로 이동했거나 링크가 제거됨).
    const stillPresent = existsSync(dest);
    if (stillPresent) return { ...base, dest, actions: [result], error: "끄기 후에도 dest가 남아 있음" };
    return { ...base, ok: true, dest, actions: [result], verify: { destPresent: false } };
  }

  // ===== 켜기 =====
  // (a) vault에 원본이 있어야 한다.
  const vaultSrc = vaultSrcFor(item, vaultRoot, recordedVaultPath);
  if (!vaultSrc) return { ...base, dest, error: "vault에 없음 — 먼저 import" };

  if (dryRun) {
    const plan = { link: { from: vaultSrc, to: dest, type: live.isDir ? (process.platform === "win32" ? "junction" : "dir") : (process.platform === "win32" ? "copy" : "file") } };
    if (destIsResident) plan.backupOriginal = { from: dest, to: join(backupDir, String(ts), basename(dest)) };
    else if (destIsLink) plan.removeStaleLink = { dest };
    return { ...base, ok: true, dest, vaultSrc, plan };
  }

  const actions = [];
  let backedUp = null; // { to } — 롤백 시 복원할 백업 위치

  // (c) dest 정리: 상주 실본은 백업 이동(절대 삭제 안 함), 잔여 링크는 제거.
  try {
    if (destIsResident) {
      const backupRoot = join(backupDir, String(ts));
      fsSync.mkdirSync(backupRoot, { recursive: true });
      const moved = join(backupRoot, basename(dest));
      fsSync.renameSync(dest, moved);
      backedUp = { to: moved };
      actions.push({ step: "backup-resident", to: moved });
    } else if (destIsLink) {
      if (lstatSync(dest).isSymbolicLink()) fsSync.unlinkSync(dest);
      else fsSync.rmSync(dest, { recursive: false, force: true }); // junction
      actions.push({ step: "remove-stale-link" });
    }
  } catch (e) {
    return { ...base, dest, vaultSrc, actions, error: "dest 정리 실패: " + e.message };
  }

  // (d) 부모 디렉토리 보장 + 링크 생성.
  try {
    fsSync.mkdirSync(live.dir, { recursive: true });
    activate(item.kind, vaultSrc, dest);
    actions.push({ step: "activate", type: live.isDir ? "link-dir" : "file" });
  } catch (e) {
    // 롤백: 부분 링크 제거 + 백업 복원.
    const rb = rollback(dest, backedUp);
    return { ...base, dest, vaultSrc, actions, rolledBack: rb, error: "링크 생성 실패: " + e.message };
  }

  // (e) 검증: 링크 해석 + (스킬) SKILL.md 읽기.
  const verify = verifyLinkReadable(item.kind, dest);
  if (!verify.ok) {
    const rb = rollback(dest, backedUp);
    return { ...base, dest, vaultSrc, actions, verify, rolledBack: rb, error: "검증 실패: " + verify.reason };
  }

  return { ...base, ok: true, dest, vaultSrc, actions, verify, backedUp };
}

// 롤백: 새로 만든(부분) 링크/복사본을 dest에서 제거하고, 백업해둔 원본을 dest로 복원.
// vault는 절대 만지지 않는다. 베스트-에포트(실패해도 정보만 담아 반환).
function rollback(dest, backedUp) {
  const steps = [];
  try {
    if (existsSync(dest)) {
      let st = null;
      try { st = lstatSync(dest); } catch {}
      if (st && st.isSymbolicLink()) { fsSync.unlinkSync(dest); steps.push("unlink-partial"); }
      else if (isJunction(dest)) { fsSync.rmSync(dest, { recursive: false, force: true }); steps.push("remove-partial-junction"); }
      else if (st && st.isDirectory()) { fsSync.rmSync(dest, { recursive: true, force: true }); steps.push("rm-partial-dir"); }
      else if (st && st.isFile()) { fsSync.rmSync(dest, { force: true }); steps.push("rm-partial-file"); }
    }
  } catch (e) { steps.push("partial-remove-failed:" + e.message); }
  try {
    if (backedUp && backedUp.to && existsSync(backedUp.to) && !existsSync(dest)) {
      fsSync.renameSync(backedUp.to, dest);
      steps.push("restored-original");
    }
  } catch (e) { steps.push("restore-failed:" + e.message); }
  return { ok: !steps.some((s) => s.includes("failed")), steps };
}

// ---------- oversized 가드용 경계 디렉토리 워크 ----------
// 파일 수/총 크기를 세되, 한도에 닿으면 즉시 중단(거대 번들에서 비싼 전수 스캔을 피함).
// 반환: { files, bytes, capped }(capped=true면 한도 초과로 조기 종료 — 정확한 총합은 아님).
const OVERSIZED_MAX_FILES = 2000;       // > 2000 파일이면 oversized
const OVERSIZED_MAX_BYTES = 50 * 1024 * 1024; // 또는 > 50 MB이면 oversized
function measureBounded(targetPath, maxFiles = OVERSIZED_MAX_FILES, maxBytes = OVERSIZED_MAX_BYTES) {
  let files = 0, bytes = 0, capped = false;
  let st;
  try { st = lstatSync(targetPath); } catch { return { files: 0, bytes: 0, capped: false, exists: false }; }
  if (st.isFile()) return { files: 1, bytes: st.size, capped: false, exists: true };
  if (!st.isDirectory()) return { files: 0, bytes: 0, capped: false, exists: true };
  // 반복(스택) DFS — 심볼릭링크는 따라가지 않음(루프/외부 회피).
  const stack = [targetPath];
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try { entries = fsSync.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      if (e.isSymbolicLink()) continue;
      const full = join(dir, e.name);
      if (e.isDirectory()) { stack.push(full); continue; }
      if (e.isFile()) {
        files++;
        try { bytes += fsSync.statSync(full).size; } catch {}
        if (files > maxFiles || bytes > maxBytes) { capped = true; break; }
      }
    }
    if (capped) break;
  }
  return { files, bytes, capped, exists: true };
}

// ---------- import (순수 복사) ----------
// 아이템 1개를 vault로 무손실 복사. 원본 미변경. { id, vaultPath, ok, [skipped|error] } 반환.
// taken: 같은 배치 내 leaf 이름 충돌 방지용 Set(단독 호출 시 새로 만들어 전달).
export async function importItem(item, vaultRoot = defaultVaultRoot, taken = new Set()) {
  const dest = vaultDestFor(item, vaultRoot);
  if (!dest) return { id: item.id, ok: false, skipped: true, reason: `${item.kind}는 import 대상 아님(E1)` };
  const srcPath = resolveSourcePath(item);
  if (!srcPath) return { id: item.id, ok: false, error: "원본 경로를 찾을 수 없습니다." };
  await mkdir(dest.dir, { recursive: true });
  const leaf = uniqueLeaf(dest.dir, dest.leaf, dest.isDir, taken);
  const vaultPath = join(dest.dir, leaf);
  try {
    await cp(srcPath, vaultPath, { recursive: dest.isDir, errorOnExist: false });
  } catch (e) {
    return { id: item.id, ok: false, error: "복사 실패: " + e.message };
  }
  // E3: liveName(상주 원래 이름)을 import 시점에 포착해 결과에 실어 보낸다(소스가 아직 ~/.claude를
  // 가리킬 때여야 정확). 서버가 vault.json에 그대로 영속한다(scan 루트 전환 후에도 활성화가 같은 자리를 찾도록).
  return { id: item.id, ok: true, vaultPath, from: srcPath, kind: item.kind, liveName: originalLiveName(item) };
}

// ---------- moveToVault (무손실 이동: ~/.claude 상주본 → vault) ----------
// 상주 스킬/에이전트를 vault로 "이동"한다(복사가 아니라 원본 제거까지). "비활성화 시 lazy import" 용도 —
// 거대 번들을 백업으로 옮기는 대신 vault로 흡수하고, C:→D: 같은 볼륨 경계도 안전하게 넘는다.
// 안전 규약: 어떤 실패에서도 원본은 그대로 둔다. 원본 제거는 "검증된 동일 vault 사본"이 생긴 뒤에만.
//   fs.rename은 볼륨 경계(EXDEV)에서 실패하므로 copy → verify(dirHash) → remove 순서로 무손실 이동.
// opts: { vaultRoot, dryRun, taken }(taken = 같은 배치 내 leaf 충돌 방지 Set).
// 반환: { ok, vaultPath, from, kind, liveName, hash } | { ok:false, error } | { ok:true, dryRun, from, to, kind }.
export async function moveToVault(item, opts = {}) {
  const { vaultRoot = defaultVaultRoot, dryRun = false, taken = new Set() } = opts;

  // 1) 상주 원본 해석(skill=폴더, agent=.md 파일). 없으면 즉시 중단(원본 미변경).
  const srcPath = resolveSourcePath(item);
  if (!srcPath) return { ok: false, error: "원본 경로를 찾을 수 없습니다." };

  // 2) vault 목적지 계산(importItem과 동일 패턴: vaultDestFor + uniqueLeaf).
  const dest = vaultDestFor(item, vaultRoot);
  if (!dest) return { ok: false, error: `${item.kind}는 vault 이동 대상 아님(skill/agent만)` };
  await mkdir(dest.dir, { recursive: true });
  const leaf = uniqueLeaf(dest.dir, dest.leaf, dest.isDir, taken);
  const vaultPath = join(dest.dir, leaf);

  // 3) dryRun: 계획만 반환(파일시스템 변형 0).
  if (dryRun) return { ok: true, dryRun: true, from: srcPath, to: vaultPath, kind: item.kind };

  // 4) COPY(이동 아님): src → vaultPath. EXDEV 회피 위해 rename 대신 cp.
  try {
    await cp(srcPath, vaultPath, { recursive: dest.isDir, errorOnExist: false });
  } catch (e) {
    // 복사 자체 실패 — 부분 사본을 치우고 원본은 그대로 둔다.
    await rm(vaultPath, { recursive: true, force: true }).catch(() => {});
    return { ok: false, error: "복사 실패: " + e.message };
  }

  // 5) VERIFY: vault 사본과 원본의 dirHash가 같아야 한다. 다르면 부분 사본 제거 + 원본 보존.
  const srcHash = await dirHash(srcPath);
  const vaultHash = await dirHash(vaultPath);
  if (!srcHash || !vaultHash || srcHash !== vaultHash) {
    await rm(vaultPath, { recursive: true, force: true }).catch(() => {});
    return { ok: false, error: "해시 불일치 — 이동 중단, 원본 보존" };
  }

  // 6) 검증 통과 후에만 원본(상주) 제거. (이 시점에 동일한 vault 사본이 보장됨.)
  await rm(srcPath, { recursive: true, force: true });

  // 7) 결과: liveName(상주 원래 이름)을 함께 실어 보낸다(소스가 아직 ~/.claude를 가리킬 때여야 정확).
  return { ok: true, vaultPath, from: srcPath, kind: item.kind, liveName: originalLiveName(item), hash: vaultHash };
}

// 무엇을 어디로 복사할지 계산(dryRun이면 쓰기 없이 계획만). skill/agent만 대상.
// oversized 가드: 각 타겟의 파일수/크기를 경계 워크로 재고, > 2000 파일 또는 > 50 MB면 oversized로 분리한다.
//   - dry-run: planned(정상)와 oversized(거대 — copy 대신 move-link 권장)를 모두 노출.
//   - 실제 실행: oversized는 기본적으로 복사에서 제외(skippedOversized로 반환) — "전체 가져오기"가 1.5GB 번들을
//     무턱대고 복사하는 사고를 막는다. (정상 항목의 기본 복사 동작은 그대로.)
// 반환(dryRun): { dryRun, count, planned, oversized }
// 반환(실행):   { dryRun:false, count, ok, failed, planned, oversized, results, skippedOversized }
export async function importAll(items, { dryRun = false, vaultRoot = defaultVaultRoot } = {}) {
  const targets = (items || []).filter((it) => it.kind === "skill" || it.kind === "agent");
  const planTaken = new Set();
  const planned = [];
  const oversized = [];
  const oversizedIds = new Set();
  for (const it of targets) {
    const dest = vaultDestFor(it, vaultRoot);
    if (!dest) continue;
    const from = resolveSourcePath(it);
    // 계획 단계에서도 유일 leaf를 예약해 dry-run 미리보기 경로가 실제와 일치하게 한다.
    const leaf = uniqueLeaf(dest.dir, dest.leaf, dest.isDir, planTaken);
    const entry = { id: it.id, kind: it.kind, name: it.name, from, to: join(dest.dir, leaf), missingSource: !from };
    // 원본 크기/파일수 측정(경계 워크 — 한도 닿으면 조기 종료). 원본이 없으면 측정 생략.
    if (from) {
      const m = measureBounded(from);
      const isOver = m.files > OVERSIZED_MAX_FILES || m.bytes > OVERSIZED_MAX_BYTES;
      entry.files = m.files; entry.bytes = m.bytes; entry.capped = m.capped;
      if (isOver) {
        entry.oversized = true;
        entry.note = `거대 번들(${m.files}${m.capped ? "+" : ""} 파일 / ${(m.bytes / 1048576).toFixed(1)}${m.capped ? "+" : ""} MB) — 복사 대신 move-link 권장, 기본 가져오기에서 제외`;
        oversized.push(entry);
        oversizedIds.add(it.id);
        continue; // 정상 planned에는 넣지 않음
      }
    }
    planned.push(entry);
  }
  if (dryRun) return { dryRun: true, count: planned.length, planned, oversized };

  // 실제 복사: oversized는 제외. importItem 내부의 uniqueLeaf가 디스크 상태(이미 복사된 것 포함)를 보며 유일성을 보장한다.
  const results = [];
  const writeTaken = new Set();
  const skippedOversized = [];
  for (const it of targets) {
    if (oversizedIds.has(it.id)) {
      const o = oversized.find((x) => x.id === it.id);
      skippedOversized.push({ id: it.id, kind: it.kind, name: it.name, oversized: true, note: o?.note || "거대 번들 — 기본 가져오기에서 제외(move-link 권장)" });
      continue;
    }
    results.push(await importItem(it, vaultRoot, writeTaken));
  }
  const ok = results.filter((r) => r.ok).length;
  return { dryRun: false, count: results.length, ok, failed: results.length - ok, planned, oversized, results, skippedOversized };
}

// ---------- status (읽기 전용) ----------
// 각 skill/agent에 대해 vault 존재/해시, 실폴더(상주) 해시, claudeState, 분기 여부를 계산한다.
// 절대 쓰지 않는다(이동/삭제/링크/수정 없음).
//   claudeState: 'resident'(우리 링크가 아닌 실폴더/실파일) | 'link'(우리 symlink/junction) | 'absent'
//   divergent  : vault와 live가 둘 다 존재하고 해시가 다를 때 true
export async function status(items, vaultRoot = defaultVaultRoot) {
  const targets = (items || []).filter((it) => it.kind === "skill" || it.kind === "agent");
  const out = [];
  const summary = { total: targets.length, resident: 0, link: 0, absent: 0, inVault: 0, divergent: 0 };

  for (const it of targets) {
    // vault 목적지(고정 규칙으로 계산). import가 -2 접미사를 붙였다면 정확히 일치하지 않을 수 있으나
    // 단순/결정적 매핑을 우선한다(정밀 추적은 vault.json=saveVaultState가 담당).
    const dest = vaultDestFor(it, vaultRoot);
    const vaultPath = dest ? join(dest.dir, dest.leaf) : null;
    const inVault = !!(vaultPath && existsSync(vaultPath));
    const vaultHash = inVault ? await dirHash(vaultPath) : null;

    // live(상주) 경로: ~/.claude/skills/<원본 폴더명> 또는 ~/.claude/agents/<파일명>.
    // 원본 폴더/파일명은 source.path의 말단에서 유도(scan이 이 이름으로 폴더를 만든다).
    let livePath = null;
    if (it.kind === "skill") {
      const full = resolve(it.source.root, it.source.path);
      livePath = join(claudeSkills, basename(dirname(full)));
    } else {
      livePath = join(claudeAgents, basename(it.source.path));
    }

    let claudeState = "absent";
    let liveHash = null;
    if (existsSync(livePath)) {
      if (isLink(livePath)) {
        claudeState = "link";                  // symlink/junction — 상주 실데이터 아님(우리 링크)
      } else {
        claudeState = "resident";              // 상주 실폴더/실파일
        liveHash = await dirHash(livePath);     // 상주본만 해시(우리 링크는 vault를 가리키므로 중복)
      }
    }

    const divergent = !!(inVault && liveHash && vaultHash && liveHash !== vaultHash);

    if (claudeState === "resident") summary.resident++;
    else if (claudeState === "link") summary.link++;
    else summary.absent++;
    if (inVault) summary.inVault++;
    if (divergent) summary.divergent++;

    out.push({
      id: it.id,
      kind: it.kind,
      name: it.name,
      inVault,
      vaultPath: inVault ? vaultPath : null,
      vaultHash,
      livePath,
      liveHash,
      claudeState,
      divergent,
    });
  }

  return { summary, items: out };
}

// 단건 읽기 전용 활성화 상태 — 존재/isLink만 본다(해시 없음). status()의 경량판.
// /api/index 오버레이에서 항목마다 ~/.claude 점유 상태(on/off)를 싸게 확인하는 용도.
// 절대 쓰지 않는다(이동/삭제/링크/수정 없음). liveName이 주어지면 그 "원래 이름" 자리를, 없으면 유도한다.
export function liveState(item, liveName = null) {
  const name = liveName || originalLiveName(item);
  let livePath = null;
  if (name) {
    livePath = item.kind === "agent"
      ? join(claudeAgents, /\.md$/i.test(name) ? name : `${name}.md`)
      : join(claudeSkills, name);
  }
  let claudeState = "absent", oversized = false;
  if (livePath && existsSync(livePath)) {
    claudeState = isLink(livePath) ? "link" : "resident";
    if (claudeState === "resident") {
      const m = measureBounded(livePath);
      oversized = m.files > OVERSIZED_MAX_FILES || m.bytes > OVERSIZED_MAX_BYTES;
    }
  }
  return { claudeState, livePath, oversized };
}

// ---------- E3: cutover (상주 → 관리되는 링크 전환) ----------
// 읽기 전용 계획. status()를 기반으로 각 skill/agent를 "어떻게" 전환할지 분류한다(파일시스템 변형 0).
//   action:
//     'already-managed'     — 이미 우리 링크(claudeState==='link'). 할 일 없음.
//     'external'            — 소스가 ~/.claude 밖(클론/외부). liveName 없음 → 같은-자리 전환 불가(별도 자리 링크 대상).
//     'oversized-move-link' — 거대 번들(>2000 파일 or >50MB). 복사 대신 "원본을 vault로 이동 후 링크" 권장(이번 라운드 비구현).
//     'import+link'         — 일반 상주. vault로 복사(필요 시) 후 같은-자리(liveName)에 링크.
//   willBackup : 전환 시 백업으로 옮겨질 상주 원본 경로(없으면 null).
//   divergent  : vault본과 상주본이 둘 다 있고 dirHash가 다름(플러그인 갱신 등 충돌 — 자동해소 안 함).
//   liveName   : 같은-자리 링크 목적지 이름(상주 폴더/파일명). 외부 항목은 null.
// vaultRoot/claudeDir 주입 가능 — 샌드박스 테스트는 실경로 대신 임시경로를 넘긴다.
export async function planCutover(items, opts = {}) {
  const {
    vaultRoot = defaultVaultRoot,
    claudeDir = defaultClaudeDir,
  } = opts;
  const targets = (items || []).filter((it) => it.kind === "skill" || it.kind === "agent");

  // status는 ~/.claude 실경로 기준으로 계산되도록 claudeDir에 맞춰 livePath를 재계산해야 하지만,
  // 기존 status()는 모듈 상수(claudeSkills/claudeAgents)를 사용한다. cutover 계획은 "원래 자리(liveName)"가
  // 핵심이므로 여기서 직접 livePath/해시/분기를 재계산한다(claudeDir 주입 반영).
  const byId = new Map();
  for (const it of targets) {
    const liveName = originalLiveName(it); // 외부면 null
    const dest = vaultDestFor(it, vaultRoot);
    const vaultPath = dest ? join(dest.dir, dest.leaf) : null;
    const inVault = !!(vaultPath && existsSync(vaultPath));
    const vaultHash = inVault ? await dirHash(vaultPath) : null;

    // 같은-자리 livePath: liveName이 있으면 claudeDir 안의 그 자리. 없으면 외부.
    let livePath = null;
    if (liveName) {
      livePath = it.kind === "skill"
        ? join(claudeDir, "skills", liveName)
        : join(claudeDir, "agents", /\.md$/i.test(liveName) ? liveName : `${liveName}.md`);
    }

    let claudeState = "absent";
    let liveHash = null;
    if (livePath && existsSync(livePath)) {
      if (isLink(livePath)) claudeState = "link";
      else { claudeState = "resident"; liveHash = await dirHash(livePath); }
    }
    const divergent = !!(inVault && liveHash && vaultHash && liveHash !== vaultHash);

    // oversized: 상주 원본(있으면)을 경계 측정. 없으면 vault본을 측정(전환 후 링크 대상 크기 참고).
    let oversized = false, measured = null;
    const measureTarget = (livePath && existsSync(livePath) && claudeState === "resident") ? livePath
      : (inVault ? vaultPath : null);
    if (measureTarget) {
      const m = measureBounded(measureTarget);
      oversized = m.files > OVERSIZED_MAX_FILES || m.bytes > OVERSIZED_MAX_BYTES;
      measured = { files: m.files, bytes: m.bytes, capped: m.capped };
    }

    // 분류.
    let action;
    if (!liveName) action = "external";
    else if (claudeState === "link") action = "already-managed";
    else if (oversized) action = "oversized-move-link";
    else action = "import+link"; // resident 또는 absent(=vault만 있고 자리 비었으면 링크만)

    byId.set(it.id, {
      id: it.id,
      name: it.name,
      kind: it.kind,
      liveName,
      action,
      willBackup: claudeState === "resident" && livePath ? livePath : null,
      divergent,
      inVault,
      vaultPath: inVault ? vaultPath : null,
      claudeState,
      oversized,
      measured,
      note: action === "oversized-move-link"
        ? `거대 번들(${measured?.files ?? "?"}${measured?.capped ? "+" : ""} 파일 / ${measured ? (measured.bytes / 1048576).toFixed(1) : "?"}${measured?.capped ? "+" : ""} MB) — 복사 대신 MOVE(원본→vault) 후 링크 권장. 이번 라운드 미구현.`
        : (action === "external" ? "소스가 ~/.claude 밖 — 상주 아님(같은-자리 전환 대상 아님)." : null),
    });
  }

  const plan = [...byId.values()];
  const summary = {
    total: plan.length,
    byAction: {},
    divergent: plan.filter((p) => p.divergent).length,
    oversized: plan.filter((p) => p.action === "oversized-move-link").map((p) => p.name),
  };
  for (const p of plan) summary.byAction[p.action] = (summary.byAction[p.action] || 0) + 1;
  return { summary, plan };
}

// 오케스트레이션: 상주를 관리되는 링크로 전환. 비-oversized 상주만 처리한다.
// 각 항목: (필요 시) vault로 import → setActive(item, true, { ...sandboxPaths, liveName })로 같은-자리 링크.
//   setActive가 상주 원본을 backupDir로 이동(삭제 아님)한 뒤 링크 생성 + 검증 + 실패 시 롤백.
// dryRun: 변형 없이 planCutover 결과만 반환.
// 안전: 모든 실경로(vaultRoot/claudeDir/backupDir) 주입 가능 — 테스트/실행 모두 명시적으로 넘긴다.
//       기본값은 실경로지만, 이 함수는 사용자 게이트 뒤에서만 비-dryRun으로 호출해야 한다.
export async function cutover(items, opts = {}) {
  const {
    vaultRoot = defaultVaultRoot,
    claudeDir = defaultClaudeDir,
    backupDir = defaultBackupDir,
    dryRun = false,
    ts = Date.now(),
    includeOversized = false, // 기본: oversized는 건너뜀(MOVE 권장 — 이번 라운드 비구현).
  } = opts;

  const planned = await planCutover(items, { vaultRoot, claudeDir });
  if (dryRun) return { dryRun: true, ...planned, results: [] };

  const targets = (items || []).filter((it) => it.kind === "skill" || it.kind === "agent");
  const byId = new Map(targets.map((it) => [it.id, it]));
  const results = [];
  const writeTaken = new Set();

  for (const entry of planned.plan) {
    const item = byId.get(entry.id);
    if (!item) continue;

    if (entry.action === "already-managed") { results.push({ id: entry.id, name: entry.name, skipped: "already-managed" }); continue; }
    if (entry.action === "external")        { results.push({ id: entry.id, name: entry.name, skipped: "external" }); continue; }
    if (entry.action === "oversized-move-link" && !includeOversized) {
      results.push({ id: entry.id, name: entry.name, skipped: "oversized-move-link", note: entry.note });
      continue;
    }

    // 1) vault 보장: 이미 있으면 그대로, 없으면 import(순수 복사).
    let vaultPath = entry.vaultPath;
    if (!vaultPath || !existsSync(vaultPath)) {
      const imp = await importItem(item, vaultRoot, writeTaken);
      if (!imp.ok) { results.push({ id: entry.id, name: entry.name, ok: false, step: "import", error: imp.error || imp.reason }); continue; }
      vaultPath = imp.vaultPath;
    }

    // 2) 같은-자리 링크: liveName으로 setActive(켜기). 상주 원본은 setActive가 백업 이동.
    let act;
    try {
      act = setActive(item, true, { vaultRoot, claudeDir, backupDir, ts, liveName: entry.liveName, vaultPath });
    } catch (e) {
      results.push({ id: entry.id, name: entry.name, ok: false, step: "setActive", error: e.message });
      continue;
    }
    results.push({
      id: entry.id, name: entry.name, ok: act.ok, action: entry.action,
      liveName: entry.liveName, dest: act.dest, vaultSrc: act.vaultSrc,
      backedUp: act.backedUp || null, verify: act.verify || null,
      rolledBack: act.rolledBack || null, error: act.error || null,
    });
  }

  const ok = results.filter((r) => r.ok).length;
  return { dryRun: false, summary: planned.summary, plan: planned.plan, results, ok, failed: results.filter((r) => r.ok === false).length };
}

// ---------- resolveDivergence (분기 해소: vault본 ⟷ 상주본 충돌 조정) ----------
// vault 사본과 ~/.claude 상주 사본이 둘 다 있고 dirHash가 다를 때(플러그인 갱신 등) 한쪽으로 수렴시킨다.
//   choice='pull' (live→vault): 더 새로운 "상주본"을 vault가 받아들인다. 현재 vault본을 백업한 뒤 상주본으로 덮어쓴다.
//   choice='push' (vault→live): vault본으로 상주를 다시 링크한다. 기존 켜기(setActive ON) 로직 재사용(상주 백업 + 링크 + 검증/롤백).
// opts: { vaultRoot, claudeDir, backupDir, dryRun, ts, liveName, vaultPath }.
//   - vaultPath: vault.json에 기록된 vault 경로(있으면 우선). 없으면 vaultDestFor 규약으로 계산.
//   - liveName: 같은-자리 상주 이름(있으면 liveDestForManaged, 없으면 liveDestFor<owner>-<name>).
// 모든 실경로 주입 가능 — 샌드박스 테스트는 임시경로를 넘긴다. dryRun이면 계획만(FS 변형 0).
export async function resolveDivergence(item, choice, opts = {}) {
  const {
    vaultRoot = defaultVaultRoot,
    claudeDir = defaultClaudeDir,
    backupDir = defaultBackupDir,
    dryRun = false,
    ts = Date.now(),
    liveName = null,
    vaultPath: recordedVaultPath = null,
  } = opts;

  const base = { ok: false, id: item?.id, kind: item?.kind, name: item?.name, choice, dryRun: !!dryRun };
  if (choice !== "pull" && choice !== "push") return { ...base, error: "choice는 'pull' 또는 'push'여야 합니다." };
  if (item?.kind !== "skill" && item?.kind !== "agent") return { ...base, error: `${item?.kind}는 분기 해소 대상이 아님(skill/agent만)` };

  // vault 원본 경로(기록 우선 → 규약). 없으면 분기 자체가 성립 안 함.
  const vaultSrc = vaultSrcFor(item, vaultRoot, recordedVaultPath);
  if (!vaultSrc) return { ...base, error: "vault에 없음 — 먼저 import(분기 해소 불가)" };

  // 상주(live) 목적지: liveName 우선(같은-자리), 없으면 <owner>-<name> 규약.
  const live = (liveName && liveDestForManaged(item, claudeDir, liveName)) || liveDestFor(item, claudeDir);
  if (!live) return { ...base, error: "live 목적지를 해석할 수 없음(skill/agent만)" };
  const livePath = live.path;
  const isDir = !!live.isDir;

  // 양쪽 해시(현 상태).
  const vaultHash = await dirHash(vaultSrc);
  const liveHash = existsSync(livePath) ? await dirHash(livePath) : null;

  // ----- dryRun: 계획만 -----
  if (dryRun) {
    if (choice === "pull") {
      const backupTo = join(backupDir, String(ts), `vault-${basename(vaultSrc)}`);
      return {
        ...base, ok: true, choice, vaultSrc, livePath, vaultHash, liveHash,
        plan: { action: "pull", backupVault: { from: vaultSrc, to: backupTo }, copy: { from: livePath, to: vaultSrc, recursive: isDir } },
      };
    }
    // push: setActive(ON)을 dryRun으로 위임(상주 백업 + vault 링크 계획).
    const sub = setActive(item, true, { vaultRoot, claudeDir, backupDir, ts, liveName, vaultPath: vaultSrc, dryRun: true });
    const subRes = (sub && typeof sub.then === "function") ? await sub : sub;
    return { ...base, ok: true, choice, vaultSrc, livePath, vaultHash, liveHash, plan: { action: "push", relink: subRes.plan || subRes } };
  }

  // ----- pull: live → vault (vault가 상주본을 채택) -----
  if (choice === "pull") {
    if (!existsSync(livePath)) return { ...base, vaultSrc, livePath, error: "상주(live) 경로가 없어 pull 불가" };
    // 1) 현재 vault본을 백업(변경 가역성 보장). 백업 실패는 곧 데이터 손실 위험이므로 중단.
    const backupRoot = join(backupDir, String(ts));
    const backupTo = join(backupRoot, `vault-${basename(vaultSrc)}`);
    try {
      await mkdir(backupRoot, { recursive: true });
      await cp(vaultSrc, backupTo, { recursive: isDir, errorOnExist: false });
    } catch (e) {
      return { ...base, vaultSrc, livePath, error: "vault 백업 실패 — pull 중단(원본 보존): " + e.message };
    }
    // 2) 상주본으로 vault 덮어쓰기(vault == live).
    try {
      await cp(livePath, vaultSrc, { recursive: isDir, force: true, errorOnExist: false });
    } catch (e) {
      return { ...base, vaultSrc, livePath, backupTo, error: "vault 덮어쓰기 실패(백업 보존됨): " + e.message };
    }
    // 3) 검증: vault 해시 == live 해시.
    const newVaultHash = await dirHash(vaultSrc);
    const newLiveHash = await dirHash(livePath);
    if (!newVaultHash || newVaultHash !== newLiveHash) {
      return { ...base, vaultSrc, livePath, backupTo, vaultHash: newVaultHash, liveHash: newLiveHash, error: "pull 후 해시 불일치(백업 보존됨)" };
    }
    return {
      ...base, ok: true, choice, vaultSrc, livePath, backupTo,
      before: { vaultHash, liveHash }, vaultHash: newVaultHash, liveHash: newLiveHash,
      verify: { converged: true },
    };
  }

  // ----- push: vault → live (vault본으로 상주 재링크) -----
  // 기존 켜기 로직 재사용: 상주 백업 + vault에서 링크 + 검증/롤백.
  const sub = setActive(item, true, { vaultRoot, claudeDir, backupDir, ts, liveName, vaultPath: vaultSrc });
  const act = (sub && typeof sub.then === "function") ? await sub : sub;
  return { ...base, ok: !!act.ok, choice, vaultSrc, livePath, before: { vaultHash, liveHash }, relink: act };
}

// ---------- vault 상태 파일 (data/vault.json) — 원자적 쓰기 ----------
const vaultStatePath = join(dataDir, "vault.json");

export async function loadVaultState() {
  try { return JSON.parse(await readFile(vaultStatePath, "utf8")); }
  catch { return { version: 1, items: {} }; }
}

// 원자적 쓰기: 같은 디렉토리에 tmp 작성 후 rename(forge.mjs와 동일 패턴 — torn JSON 방지, Windows 폴백).
export async function saveVaultState(state) {
  await mkdir(dataDir, { recursive: true });
  const data = JSON.stringify(state ?? { version: 1, items: {} }, null, 2);
  const tmp = `${vaultStatePath}.tmp-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
  await writeFile(tmp, data, "utf8");
  try {
    await rename(tmp, vaultStatePath);
  } catch {
    try { await rm(vaultStatePath, { force: true }); await rename(tmp, vaultStatePath); }
    catch (e2) { await rm(tmp, { force: true }).catch(() => {}); throw e2; }
  }
  return state;
}
