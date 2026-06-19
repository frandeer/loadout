// Live e2e for the vault on/off system against a running server (:4970).
// Read-only-ish: toggles ONE inert skill (caveman) off→on and dry-runs gstack off.
// Never moves the big bundles for real. Verifies lossless + reversible + catalog overlay.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const BASE = process.env.BASE || "http://localhost:4970";
const claudeSkills = join(homedir(), ".claude", "skills");
const vaultSkills = "D:\\lab\\loadout\\vault\\skills";
const TARGET = "caveman/caveman/SKILL.md";       // inert skill, safe to toggle in this session
const BIG = "gstack/gstack/SKILL.md";            // oversized resident — dry-run only

const get = async (p) => (await fetch(BASE + p)).json();
const post = async (p, b) => (await fetch(BASE + p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) })).json();
const fsState = (p) => existsSync(p) ? "exists" : "ABSENT";
const line = (s) => console.log(s);

function findItem(idx, id) { return idx.items.find((i) => i.id === id); }

(async () => {
  line("=== 1) GET /api/index — overlay sanity ===");
  let idx = await get("/api/index");
  line(`total items: ${idx.items.length}`);
  const autoplan = findItem(idx, "autoplan/autoplan/SKILL.md");
  const gstack = findItem(idx, BIG);
  const caveman = findItem(idx, TARGET);
  line(`autoplan: managed=${autoplan?.managed} claudeState=${autoplan?.claudeState} equipped=${autoplan?.equipped}`);
  line(`gstack  : managed=${gstack?.managed} claudeState=${gstack?.claudeState} oversized=${gstack?.oversized} equipped=${gstack?.equipped}`);
  line(`caveman : managed=${caveman?.managed} claudeState=${caveman?.claudeState} equipped=${caveman?.equipped}`);

  line("\n=== 2) GET /api/vault/status — summary ===");
  const st = await get("/api/vault/status");
  line(`summary: ${JSON.stringify(st.summary)}`);

  line("\n=== 3) caveman OFF (dryRun) ===");
  const d = await post("/api/vault/activate", { id: TARGET, on: false, dryRun: true });
  line(`ok=${d.ok} plan=${JSON.stringify(d.plan)}`);

  const cavLive = join(claudeSkills, "caveman");
  const cavVault = join(vaultSkills, "caveman__caveman");
  line(`\n   pre-toggle FS: live(${fsState(cavLive)}) vault(${fsState(cavVault)})`);

  line("\n=== 4) caveman OFF (real) ===");
  const off = await post("/api/vault/activate", { id: TARGET, on: false });
  line(`ok=${off.ok} actions=${JSON.stringify(off.actions)} error=${off.error || "none"}`);
  line(`   post-OFF FS: live(${fsState(cavLive)}) vault(${fsState(cavVault)})  <-- live should be ABSENT, vault exists`);

  line("\n=== 5) GET /api/index after OFF (stale index + overlay) ===");
  idx = await get("/api/index");
  let cav = findItem(idx, TARGET);
  line(`caveman: present=${!!cav} managed=${cav?.managed} claudeState=${cav?.claudeState} equipped=${cav?.equipped}`);

  line("\n=== 6) caveman ON (real, restore) ===");
  const on = await post("/api/vault/activate", { id: TARGET, on: true });
  line(`ok=${on.ok} verify=${JSON.stringify(on.verify)} error=${on.error || "none"}`);
  line(`   post-ON FS: live(${fsState(cavLive)}) vault(${fsState(cavVault)})  <-- both should exist (live=link)`);
  idx = await get("/api/index");
  cav = findItem(idx, TARGET);
  line(`   /api/index caveman: claudeState=${cav?.claudeState} equipped=${cav?.equipped}`);

  line("\n=== 7) gstack OFF (dryRun ONLY — must NOT move 1.5GB) ===");
  const gd = await post("/api/vault/activate", { id: BIG, on: false, dryRun: true });
  line(`ok=${gd.ok} plan.action=${gd.plan?.action} moveTo=${gd.plan?.moveTo || gd.plan?.backupTo || "n/a"}`);
  line(`   gstack live still resident? ${fsState(join(claudeSkills, "gstack"))}  <-- must still exist (no real move)`);

  line("\nRESULT: e2e sequence complete.");
})().catch((e) => { console.error("E2E ERROR:", e.message); process.exit(1); });
