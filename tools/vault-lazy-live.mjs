// LIVE synthetic test of the server's lazy-import-on-deactivate path, end-to-end, self-cleaning.
// Creates a tiny disposable resident skill in ~/.claude/skills, rescans, toggles OFF (real vault MOVE),
// verifies lossless+absent, toggles ON (re-link), verifies readable, then removes ALL traces.
// Touches only the synthetic skill — never the user's real skills/vault entries.
import { mkdirSync, writeFileSync, existsSync, rmSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const BASE = "http://localhost:4970";
const NAME = "_lazylive_zzz";
const ID = `${NAME}/${NAME}/SKILL.md`;
const liveDir = join(homedir(), ".claude", "skills", NAME);
const liveSkill = join(liveDir, "SKILL.md");
const vaultLeaf = join("D:\\lab\\loadout\\vault\\skills", `unknown__${NAME}`);
const vaultStatePath = "D:\\lab\\loadout\\data\\vault.json";

const get = async (p) => (await fetch(BASE + p)).json();
const post = async (p, b) => (await fetch(BASE + p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) })).json();
const fsState = (p) => existsSync(p) ? "exists" : "ABSENT";
const L = (s) => console.log(s);
let pass = 0, fail = 0;
const check = (label, cond) => { if (cond) { pass++; L(`  PASS ${label}`); } else { fail++; L(`  FAIL ${label}`); } };

function cleanup() {
  try { if (existsSync(liveDir)) rmSync(liveDir, { recursive: true, force: true }); } catch {}
  try { if (existsSync(vaultLeaf)) rmSync(vaultLeaf, { recursive: true, force: true }); } catch {}
  try {
    const st = JSON.parse(readFileSync(vaultStatePath, "utf8"));
    if (st.items[ID]) { delete st.items[ID]; writeFileSync(vaultStatePath, JSON.stringify(st, null, 2)); }
  } catch {}
}

(async () => {
  cleanup(); // 시작 전 잔재 제거
  L("=== synthetic LIVE lazy-move test ===");
  // 1) 가짜 상주 스킬 생성
  mkdirSync(liveDir, { recursive: true });
  writeFileSync(liveSkill, "---\nname: _lazylive_zzz\ndescription: disposable lazy-move test\n---\n\n# temp\nbody\n");
  const preBytes = statSync(liveSkill).size;
  L(`created resident: ${fsState(liveDir)} (${preBytes}B)`);

  // 2) 리스캔 → 인덱스에 등장
  await post("/api/rescan", {});
  let idx = await get("/api/index");
  let it = idx.items.find((i) => i.id === ID);
  check("리스캔 후 인덱스에 상주로 등장 (claudeState=resident, equipped=true)", it && it.claudeState === "resident" && it.equipped === true);

  // 3) OFF (real) — onResident:'vault' 무손실 MOVE
  const off = await post("/api/vault/activate", { id: ID, on: false });
  check("OFF ok", off.ok === true);
  check("OFF 후 라이브 ABSENT (상주가 vault로 이동)", !existsSync(liveDir));
  check("OFF 후 vault에 사본 존재", existsSync(vaultLeaf));
  check("OFF 결과에 moved.vaultPath 기록", !!off.moved?.vaultPath);
  if (existsSync(vaultLeaf)) {
    const movedSkill = join(vaultLeaf, "SKILL.md");
    check("이동된 SKILL.md 내용 보존(무손실)", existsSync(movedSkill) && statSync(movedSkill).size === preBytes);
  }

  // 4) /api/index — 이제 managed + absent (스냅샷으로 카탈로그 유지)
  idx = await get("/api/index");
  it = idx.items.find((i) => i.id === ID);
  check("OFF 후 카탈로그에 유지 (managed=true, claudeState=absent, equipped=false)", it && it.managed === true && it.claudeState === "absent" && it.equipped === false);

  // 5) 리스캔해도 사라지지 않음 (스냅샷 되살리기)
  await post("/api/rescan", {});
  idx = await get("/api/index");
  it = idx.items.find((i) => i.id === ID);
  check("리스캔 후에도 스냅샷으로 되살아남 (off 항목 유지)", it && it.claudeState === "absent");

  // 6) ON (real) — vault에서 재링크
  const on = await post("/api/vault/activate", { id: ID, on: true });
  check("ON ok + 검증 읽힘", on.ok === true && on.verify?.ok === true);
  check("ON 후 라이브 재등장 + vault 유지", existsSync(liveDir) && existsSync(vaultLeaf));

  L(`\nRESULT: ${pass} PASS / ${fail} FAIL`);
  cleanup();
  // 정리 확인
  L(`cleanup: live(${fsState(liveDir)}) vault(${fsState(vaultLeaf)})`);
  await post("/api/rescan", {}); // 인덱스를 베이스라인으로 복구
  const final = await get("/api/index");
  L(`final index has synthetic? ${!!final.items.find((i) => i.id === ID)}  (should be false)`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("LIVE ERROR:", e.message); cleanup(); process.exit(1); });
