// Final verification against the running server (:4970) using the NEW vault-structural ids.
// Proves: managed catalog stable across rescan, off-item persists via vault scan, lossless+reversible
// toggle, and gstack lazy-OFF resolves to move-to-vault (dry-run only — no 1.5GB move).
import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const BASE = "http://localhost:4970";
const claudeSkills = join(homedir(), ".claude", "skills");
const vaultSkills = "D:\\lab\\loadout\\vault\\skills";
const CAVE = "caveman__caveman/caveman__caveman/SKILL.md"; // vault id now
const GSTACK = "gstack/gstack/SKILL.md";                    // unmanaged resident (~/.claude id)

const get = async (p) => (await fetch(BASE + p)).json();
const post = async (p, b) => (await fetch(BASE + p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) })).json();
const fss = (p) => existsSync(p) ? "exists" : "ABSENT";
const L = console.log;
let pass = 0, fail = 0;
const ck = (label, cond) => { (cond ? pass++ : fail++); L(`  ${cond ? "PASS" : "FAIL"} ${label}`); };
const find = (idx, id) => idx.items.find((i) => i.id === id);

(async () => {
  const cLive = join(claudeSkills, "caveman");
  const cVault = join(vaultSkills, "caveman__caveman");

  L("=== A) baseline ===");
  let idx = await get("/api/index");
  ck("caveman managed+link+equipped", (() => { const c = find(idx, CAVE); return c?.managed && c.claudeState === "link" && c.equipped; })());
  L(`   FS: live(${fss(cLive)}) vault(${fss(cVault)})`);

  L("=== B) caveman OFF (real) ===");
  const off = await post("/api/vault/activate", { id: CAVE, on: false });
  ck("OFF ok", off.ok);
  ck("live junction removed", !existsSync(cLive));
  ck("vault copy preserved (lossless)", existsSync(cVault));

  L("=== C) rescan — off item must persist (scanned from vault) ===");
  await post("/api/rescan", {});
  idx = await get("/api/index");
  let c = find(idx, CAVE);
  ck("caveman still in catalog after rescan", !!c);
  ck("shows managed + absent + not-equipped", c?.managed && c.claudeState === "absent" && c.equipped === false);

  L("=== D) caveman ON (real, restore) ===");
  const on = await post("/api/vault/activate", { id: CAVE, on: true });
  ck("ON ok + verify readThrough", on.ok && on.verify?.ok);
  ck("live link restored + vault intact", existsSync(cLive) && existsSync(cVault));
  await post("/api/rescan", {});
  idx = await get("/api/index");
  c = find(idx, CAVE);
  ck("after rescan: link + equipped", c?.claudeState === "link" && c.equipped);

  L("=== E) gstack lazy OFF (dry-run ONLY) ===");
  const g = await post("/api/vault/activate", { id: GSTACK, on: false, dryRun: true });
  ck("plan.action === move-to-vault", g.plan?.action === "move-to-vault");
  ck("gstack still resident (no real move)", existsSync(join(claudeSkills, "gstack")));

  L("=== F) managed integrity ===");
  idx = await get("/api/index");
  const m = idx.items.filter((i) => i.managed);
  const links = m.filter((i) => i.claudeState === "link").length;
  ck("95 managed, all link (caveman restored)", m.length === 95 && links === 95);

  L(`\nRESULT: ${pass} PASS / ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("VERIFY ERROR:", e.message); process.exit(1); });
