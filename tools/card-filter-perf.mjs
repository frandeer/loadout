// Measure the cost of clicking a left-rail KIND filter (skill / memory) on the deck view,
// against the running :4970 build via local debug Chrome (port 9222). Reports the longest
// blocking task (the "freeze" the user feels) + card count + console errors, with and
// without a card selected (to isolate grid render vs DetailPanel markdown re-render).
import CDP from "chrome-remote-interface";
import { mkdirSync, writeFileSync } from "node:fs";

const PORT = 9222;
const URL = process.env.UIURL || "http://localhost:4970";
const OUT = "D:\\lab\\loadout\\tools\\shots";
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const consoleErrors = [];

(async () => {
  const tgt = await CDP.New({ port: PORT, url: "about:blank" });
  const client = await CDP({ target: tgt.id, port: PORT });
  const { Page, Runtime } = client;
  await Page.enable();
  await Runtime.enable();
  Runtime.consoleAPICalled(({ type, args }) => {
    if (type === "error") consoleErrors.push(args.map((a) => a.value ?? a.description ?? "").join(" "));
  });
  Runtime.exceptionThrown((p) => consoleErrors.push("EXC: " + (p.exceptionDetails?.exception?.description || p.exceptionDetails?.text || "")));

  const ev = async (expression) => (await Runtime.evaluate({ expression, returnByValue: true, awaitPromise: true })).result.value;
  const shot = async (name) => { const { data } = await Page.captureScreenshot({ format: "png" }); writeFileSync(`${OUT}\\${name}.png`, Buffer.from(data, "base64")); };

  await Page.navigate({ url: URL });
  await Page.loadEventFired();
  await ev(`!!document.querySelector('button')`);
  await sleep(1200);

  // longtask observer — captures blocking tasks >50ms (the jank source)
  await ev(`(()=>{
    window.__lt = [];
    try { new PerformanceObserver((l)=>{ for(const e of l.getEntries()) window.__lt.push(Math.round(e.duration)); }).observe({entryTypes:['longtask']}); } catch(e){}
    return true;
  })()`);

  // click a left-rail kind filter by label, measure click->settled (2x rAF after commit) + max longtask
  const clickKind = async (label) => {
    await ev(`(window.__lt = [])`);
    const t0 = await ev(`performance.now()`);
    const clicked = await ev(`(()=>{
      const b=[...document.querySelectorAll('aside button')].find(x=>x.textContent.trim().startsWith('${label}'));
      if(!b) return 'no-btn';
      b.click(); return 'ok';
    })()`);
    // wait for render to settle, then read paint time via double rAF
    const settled = await ev(`new Promise(res=>{ requestAnimationFrame(()=>requestAnimationFrame(()=>res(performance.now()))); })`);
    await sleep(700);
    const stat = await ev(`(()=>{
      const cards = document.querySelectorAll('main .grid > div').length;
      const imgs = document.querySelectorAll('main img').length;
      const maxLt = window.__lt.length ? Math.max(...window.__lt) : 0;
      const sumLt = window.__lt.reduce((a,b)=>a+b,0);
      return JSON.stringify({cards, imgs, maxLt, sumLt, ltCount: window.__lt.length});
    })()`);
    return { label, clicked, settleMs: Math.round(settled - t0), ...JSON.parse(stat) };
  };

  const reset = async () => {
    await ev(`(()=>{const b=[...document.querySelectorAll('aside button')].find(x=>x.textContent.trim()==='초기화'); if(b)b.click(); return !!b;})()`);
    await sleep(500);
  };

  // ── Scenario 1: nothing selected (pure grid render cost) ──
  await reset();
  const skillA = await clickKind("스킬");
  await shot("perf-skill");
  await reset();
  const memA = await clickKind("메모리");
  await shot("perf-memory");

  // ── Scenario 2: a card IS selected (does DetailPanel markdown re-render add cost?) ──
  await reset();
  await ev(`(()=>{const c=document.querySelector('main .grid > div'); if(c){c.click(); return 1;} return 0;})()`);
  await sleep(900); // let DetailPanel (markdown) mount
  const selInfo = await ev(`JSON.stringify({ panelOpen: !!document.querySelector('aside')?.textContent?.length, hasPre: !!document.querySelector('pre') })`);
  const skillB = await clickKind("스킬");

  console.log("URL:", URL);
  console.log("[no selection]  skill:", JSON.stringify(skillA));
  console.log("[no selection]  memory:", JSON.stringify(memA));
  console.log("[card selected] info:", selInfo);
  console.log("[card selected] skill:", JSON.stringify(skillB));
  console.log("console errors:", consoleErrors.length ? consoleErrors.slice(0, 8) : "none");

  await CDP.Close({ id: tgt.id, port: PORT });
  await client.close();
})().catch((e) => { console.error("PERF ERROR:", e.message); process.exit(1); });
