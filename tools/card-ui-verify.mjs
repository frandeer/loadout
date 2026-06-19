// Verify the two UX fixes + Card refactor regression against the running :4970 build,
// via local debug Chrome (9222). Forces a 1600px (xl) viewport so the docked panel applies.
//  (1) Right panel closes -> <main> (flex-1) reclaims the space (cards fill).
//  (2) Filter click while a card is selected no longer janks (MarkdownView memoized).
//  (3) Regression: selecting a card still works after Card's fine-grained-selector refactor.
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
  const J = (s) => JSON.parse(s);

  await Page.navigate({ url: URL });
  await Page.loadEventFired();
  await ev(`!!document.querySelector('main')`);
  await sleep(1200);
  await ev(`(()=>{ window.__lt=[]; try{ new PerformanceObserver(l=>{for(const e of l.getEntries())window.__lt.push(Math.round(e.duration));}).observe({entryTypes:['longtask']}); }catch(e){} return 1; })()`);
  const reset = async () => { await ev(`(()=>{const b=[...document.querySelectorAll('aside button')].find(x=>x.textContent.trim()==='초기화'); if(b)b.click();})()`); await sleep(400); };
  const dockState = async () => J(await ev(`JSON.stringify({ mainW: Math.round(document.querySelector('main').clientWidth), dock: !!document.querySelector('aside[style]'), asideN: document.querySelectorAll('aside').length })`));

  // ── (1) Panel reflow ──────────────────────────────────────────
  await reset();
  // filter to 스킬 so main holds the library grid of selectable Cards
  await ev(`(()=>{const b=[...document.querySelectorAll('aside button')].find(x=>x.textContent.trim().startsWith('스킬')); if(b)b.click();})()`);
  await sleep(500);
  const s0 = await dockState();                       // nothing selected: no dock, wide main
  await ev(`(()=>{const c=document.querySelector('main .grid > div'); if(c)c.click();})()`);
  await sleep(700);
  const s1 = await dockState();                       // selected: dock present, main narrower
  await shot("ui-01-selected");
  await ev(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))`); // DetailPanel closes on Escape
  await sleep(700);
  const s2 = await dockState();                       // closed: dock gone, main back to wide
  await shot("ui-02-closed");

  // ── (2) Filter click while a card is selected (markdown memo) ──
  await reset();
  await ev(`(()=>{const b=[...document.querySelectorAll('aside button')].find(x=>x.textContent.trim().startsWith('스킬')); if(b)b.click();})()`);
  await sleep(500);
  await ev(`(()=>{const c=document.querySelector('main .grid > div'); if(c)c.click();})()`);
  await sleep(900);
  // try to surface full doc (a tab with the most text) so markdown is heavy
  await ev(`(()=>{const tabs=[...document.querySelectorAll('aside[style] button')].filter(b=>/문서|내용|가이드|원문|코드|doc|readme/i.test(b.textContent||'')); if(tabs[0])tabs[0].click();})()`);
  await sleep(800);
  const selPanel = J(await ev(`JSON.stringify({ dockTextLen: (document.querySelector('aside[style]')?.innerText||'').length, hasPre: !!document.querySelector('aside[style] pre') })`));
  // now click 메모리 then 스킬, measuring blocking time each
  const filterWhileOpen = async (label) => {
    await ev(`(window.__lt=[])`);
    const t0 = await ev(`performance.now()`);
    await ev(`(()=>{const b=[...document.querySelectorAll('aside button')].find(x=>x.textContent.trim().startsWith('${label}')); if(b)b.click();})()`);
    const done = await ev(`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r(performance.now()))))`);
    await sleep(500);
    const lt = await ev(`window.__lt.length?Math.max(...window.__lt):0`);
    return { label, settleMs: Math.round(done - t0), maxLt: lt };
  };
  const f1 = await filterWhileOpen("메모리");
  const f2 = await filterWhileOpen("스킬");
  await shot("ui-03-filter-with-panel");

  console.log("URL:", URL);
  console.log("(1) reflow  nothing-sel:", JSON.stringify(s0));
  console.log("(1) reflow  selected   :", JSON.stringify(s1), "<- dock=true, mainW smaller");
  console.log("(1) reflow  closed     :", JSON.stringify(s2), "<- dock=false, mainW back to wide");
  console.log("(2) panel-open content :", JSON.stringify(selPanel));
  console.log("(2) filter w/ panel open:", JSON.stringify(f1), JSON.stringify(f2), "(maxLt=0 => no jank)");
  console.log("(3) select worked       :", s1.dock === true ? "YES (card select -> panel opened)" : "NO");
  console.log("console errors:", errs.length ? errs.slice(0, 8) : "none");

  await Emulation.clearDeviceMetricsOverride();
  await CDP.Close({ id: tgt.id, port: PORT });
  await client.close();
})().catch((e) => { console.error("UI-VERIFY ERROR:", e.message); process.exit(1); });
