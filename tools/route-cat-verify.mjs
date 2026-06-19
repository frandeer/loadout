// Verify P1(카테고리 필터) + P2(HashRouter URL 라우팅) against the running :4970 build via debug Chrome (9222).
import CDP from "chrome-remote-interface";
import { mkdirSync, writeFileSync } from "node:fs";
const PORT = 9222, URL = process.env.UIURL || "http://localhost:4970", OUT = "D:\\lab\\loadout\\tools\\shots";
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errs = [];
(async () => {
  const tgt = await CDP.New({ port: PORT, url: "about:blank" });
  const client = await CDP({ target: tgt.id, port: PORT });
  const { Page, Runtime, Emulation } = client;
  await Page.enable(); await Runtime.enable();
  await Emulation.setDeviceMetricsOverride({ width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });
  Runtime.consoleAPICalled(({ type, args }) => { if (type === "error") errs.push(args.map((a) => a.value ?? a.description ?? "").join(" ")); });
  Runtime.exceptionThrown((p) => errs.push("EXC: " + (p.exceptionDetails?.exception?.description || p.exceptionDetails?.text || "")));
  const ev = async (e) => (await Runtime.evaluate({ expression: e, returnByValue: true, awaitPromise: true })).result.value;
  const shot = async (n) => { const { data } = await Page.captureScreenshot({ format: "png" }); writeFileSync(`${OUT}\\${n}.png`, Buffer.from(data, "base64")); };

  await Page.navigate({ url: URL }); await Page.loadEventFired(); await ev(`!!document.querySelector('header')`); await sleep(1400);
  const hash = async () => ev(`location.hash`);
  const clickTab = async (label) => { await ev(`(()=>{const bs=[...document.querySelectorAll('button')]; const b=bs.find(x=>x.textContent.trim()===${JSON.stringify(label)})||bs.find(x=>x.textContent.trim().startsWith(${JSON.stringify(label)})); if(b){b.click();return 1;}return 0;})()`); await sleep(500); return hash(); };

  // ── P2 routing ──
  const h0 = await hash();
  const hHelp = await clickTab("도움말");
  const helpView = await ev(`/FAQ|시뮬레이터|스탯|도움말/.test(document.body.innerText.slice(0,600))`);
  const hInv = await clickTab("인벤토리");
  await ev(`history.back()`); await sleep(500); const hBack = await hash();
  await Page.navigate({ url: URL + "#/forge" }); await Page.loadEventFired(); await sleep(1200); const hForge = await hash();

  // ── P1 category filter (back on deck) ──
  await Page.navigate({ url: URL + "#/deck" }); await Page.loadEventFired(); await sleep(1300);
  const panel = JSON.parse(await ev(`JSON.stringify({hasCategory:(document.querySelector('aside')?.innerText||'').includes('카테고리'), hasSource:(document.querySelector('aside')?.innerText||'').includes('출처')})`));
  const shown = async () => ev(`(()=>{const t=document.querySelector('aside')?.innerText||'';const r=t.match(/표시\\s*(\\d+)\\s*개/);return r?+r[1]:-1;})()`);
  const base = await shown();
  const clickCat = async (cat) => { await ev(`(()=>{const b=[...document.querySelectorAll('aside button')].find(x=>x.textContent.trim().startsWith(${JSON.stringify(cat)})); if(b)b.click();})()`); await sleep(500); return shown(); };
  const cTest = await clickCat("테스트");
  await ev(`(()=>{const b=[...document.querySelectorAll('aside button')].find(x=>x.textContent.trim()==='초기화'); if(b)b.click();})()`); await sleep(400);
  const cMem = await clickCat("메모리");
  await shot("rc-01-category");

  const result = {
    p2_hashAfterLoad: h0, expect_deck: "#/deck",
    p2_clickHelp: hHelp, helpVisible: helpView,
    p2_clickInventory: hInv,
    p2_historyBack: hBack,
    p2_reloadForge: hForge,
    p1_panel: panel,
    p1_baseShown: base, p1_test: cTest, p1_memory: cMem,
    consoleErrors: errs.length ? errs.slice(0, 8) : [],
  };
  writeFileSync(`${OUT}\\route-cat-result.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  await Emulation.clearDeviceMetricsOverride();
  await CDP.Close({ id: tgt.id, port: PORT }); await client.close();
})().catch((e) => { console.error("RC-VERIFY ERROR:", e.message); process.exit(1); });
