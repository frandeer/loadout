// One-time migration: re-key data/vault.json from ~/.claude-derived ids (<liveName>/<liveName>/SKILL.md)
// to vault-structural ids (<leaf>/<leaf>/SKILL.md, leaf=basename(vaultPath)) so they match what scan
// now produces from the vault source root. Backs up first; atomic write. Skills only (agents=0).
import { readFileSync, writeFileSync, copyFileSync, existsSync } from "node:fs";
import { basename } from "node:path";

const p = "D:\\lab\\loadout\\data\\vault.json";
const bak = p + ".bak-rekey";
const st = JSON.parse(readFileSync(p, "utf8"));
if (!existsSync(bak)) copyFileSync(p, bak);

const next = { version: st.version || 1, items: {} };
let rekeyed = 0, kept = 0, sample = [];
for (const [oldId, val] of Object.entries(st.items)) {
  if ((val.kind === "skill" || !val.kind) && val.vaultPath) {
    const leaf = basename(val.vaultPath);
    const newId = `${leaf}/${leaf}/SKILL.md`;
    next.items[newId] = { ...val, prevId: oldId };
    if (newId !== oldId) { rekeyed++; if (sample.length < 4) sample.push(`${oldId}  ->  ${newId}`); }
    else kept++;
  } else {
    next.items[oldId] = val; // agents/기타는 그대로
    kept++;
  }
}

// 충돌 검사: 재키 후 항목 수가 줄면 같은 newId로 합쳐진 것 — 중단.
const before = Object.keys(st.items).length;
const after = Object.keys(next.items).length;
if (after < before) { console.error(`ABORT: 항목 수 감소 ${before}->${after} (newId 충돌). 쓰지 않음.`); process.exit(1); }

writeFileSync(p, JSON.stringify(next, null, 2));

console.log(`backup: ${bak}`);
console.log(`items: ${before} -> ${after} | rekeyed: ${rekeyed} | kept: ${kept}`);
console.log("sample:\n  " + sample.join("\n  "));
