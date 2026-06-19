// Verify the left-panel fixes against the running :4970 build via local debug Chrome (9222).
//  (1) 출처 "unknown" click now yields items (was empty) — read the "표시 N개" counter (= filtered().length).
//  (2) 출처 "local" click yields its items too (general source-filter sanity).
//  (3) UX additions present: 유형 "전체" button, 출처/태그 "더보기" expander, "표시 N개" indicator.
//  (4) "로드아웃 저장" renamed to "팀 편성 저장" in the equipped bar.
//  (5) No console errors throughout.
import CDP from "chrome-remote-interface";
import { mkdirSync, writeFileSync } from "node:fs";

const PORT = 9222;
const URL = process.env.UIURL || "http://localhost:4970";
const OUT = "D:\\lab\\loadout\\tools\\shots";
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errs = [];

(async () => {
  const tgt = await CDP.New({ port: PORT, url: "about:blank" });
  const client = await CDP({ target: tgt.id, port: PORT });
  const { Page, Runtime, Emulation } = client;
  await Page.enable();
  await Runtime.enable();
  await Emulation.setDeviceMetricsOverride({ width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });
  Runtime.consoleAPICalled(({ type, args }) => { if (type === "error") errs.push(args.map((a) => a.value ?? a.description ?? "").join(" ")); });
  Runtime.exceptionThrown((p) => errs.push("EXC: " + (p.exceptionDetails?.exception?.description || p.exceptionDetails?.text || "")));

  const ev = async (e) => (await Runtime.evaluate({ expression: e, returnByValue: true, awaitPromise: true })).result.value;
  const shot = async (n) => { const { data } = await Page.captureScreenshot({ format: "png" }); writeFileSync(`${OUT}\\${n}.png`, Buffer.from(data, "base64")); };

  await Page.navigate({ url: URL });
  await Page.loadEventFired();
  await ev(`!!document.querySelector('aside')`);
  await sleep(1400);

  // read "표시 N개" indicator (authoritative filtered().length)
  const shown = async () => {
    const m = await ev(`(()=>{const t=document.querySelector('aside')?.innerText||''; const r=t.match(/표시\\s*(\\d+)\\s*개/); return r?+r[1]:-1;})()`);
    return m;
  };
  // count visible card-like nodes in main as a cross-check
  const cards = async () => ev(`document.querySelectorAll('main .grid > div').length`);
  const reset = async () => { await ev(`(()=>{const b=[...document.querySelectorAll('aside button')].find(x=>x.textContent.trim()==='초기화'); if(b)b.click();})()`); await sleep(450); };
  // click a 출처 button by owner prefix (text = owner + count)
  const clickSource = async (owner) => ev(`(()=>{
    const bs=[...document.querySelectorAll('aside button')];
    const b=bs.find(x=>{const t=x.textContent.trim(); return t.startsWith(${JSON.stringify(owner)}) && /\\d$/.test(t);});
    if(!b) return 'no-btn:'+${JSON.stringify(owner)};
    b.click(); return 'ok';
  })()`);

  await reset();
  const baseShown = await shown();

  // (1) unknown
  const ckU = await clickSource("unknown");
  await sleep(600);
  const unkShown = await shown(), unkCards = await cards();
  await shot("lp-01-unknown");

  // (2) local
  await reset();
  const ckL = await clickSource("local");
  await sleep(600);
  const locShown = await shown(), locCards = await cards();
  await shot("lp-02-local");
  await reset();

  // (3) UX additions present
  const ux = JSON.parse(await ev(`JSON.stringify({
    allBtn: [...document.querySelectorAll('aside button')].some(b=>b.textContent.trim().startsWith('전체')),
    moreBtn: [...document.querySelectorAll('aside button')].some(b=>/더보기|개 더|접기/.test(b.textContent)),
    shownIndicator: /표시\\s*\\d+\\s*개/.test(document.querySelector('aside')?.innerText||''),
  })`));

  // (4) equipped-bar rename (equipped items present => bar visible)
  const bar = JSON.parse(await ev(`JSON.stringify({
    hasTeamSave: document.body.innerText.includes('팀 편성 저장'),
    hasOldLoadoutSave: document.body.innerText.includes('로드아웃 저장'),
  })`));

  console.log("URL:", URL);
  console.log("baseline 표시:", baseShown, "(전체 카탈로그)");
  console.log("(1) unknown  click:", ckU, "→ 표시:", unkShown, "cards:", unkCards, "(expect 3, was 0 pre-fix)");
  console.log("(2) local    click:", ckL, "→ 표시:", locShown, "cards:", locCards, "(expect 15)");
  console.log("(3) UX additions  :", JSON.stringify(ux));
  console.log("(4) equip-bar     :", JSON.stringify(bar), "(want hasTeamSave=true, hasOldLoadoutSave=false)");
  console.log("console errors    :", errs.length ? errs.slice(0, 8) : "none");

  await Emulation.clearDeviceMetricsOverride();
  await CDP.Close({ id: tgt.id, port: PORT });
  await client.close();
})().catch((e) => { console.error("LP-VERIFY ERROR:", e.message); process.exit(1); });
