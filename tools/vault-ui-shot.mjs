// Local CDP UI walkthrough of the Loadout vault on/off flow, against the already-running
// debug Chrome (port 9222) + this PC's server (localhost:4970). No extension, no network exposure.
// Captures screenshots to tools/shots/ and verifies: inventory renders the managed skills,
// a non-oversized skill toggles OFF -> 꺼짐·보관됨 -> ON, and the console has no errors.
import CDP from "chrome-remote-interface";
import { mkdirSync, writeFileSync } from "node:fs";

const PORT = 9222;
const URL = process.env.UIURL || "http://localhost:4970";
const OUT = "D:\\lab\\loadout\\tools\\shots";
const SAFE = "caveman"; // inert, non-oversized managed skill
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
  const shot = async (name) => { const { data } = await Page.captureScreenshot({ format: "png" }); writeFileSync(`${OUT}\\${name}.png`, Buffer.from(data, "base64")); return `${name}.png`; };
  const poll = async (expr, ms = 6000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await ev(expr)) return true; await sleep(250); } return false; };

  // 1) load app
  await Page.navigate({ url: URL });
  await Page.loadEventFired();
  await poll(`!!document.querySelector('button') && document.body.innerText.includes('덱')`, 8000);
  await sleep(800);
  // 거대 자산 confirm()이 자동화를 막지 않도록 무력화 (이번엔 caveman만 토글하지만 안전망).
  await ev(`window.__origConfirm = window.confirm; window.confirm = () => true; true`);
  await shot("01-deck");

  // 2) go to 인벤토리
  await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('인벤토리')); if(b){b.click();return 1;} return 0;})()`);
  await sleep(900);
  await shot("02-inventory");

  // 3) read inventory state
  const state1 = await ev(`(()=>{
    const txt = document.body.innerText;
    const equippedBtns = [...document.querySelectorAll('button')].filter(b=>b.textContent.trim()==='해제').length;
    const onBtns = [...document.querySelectorAll('button')].filter(b=>b.textContent.trim()==='켜기').length;
    const hasStored = txt.includes('꺼짐') ;
    const bigChips = (txt.match(/거대·지연|거대/g)||[]).length;
    const cavemanPresent = txt.includes('${SAFE}');
    return JSON.stringify({equippedBtns, onBtns, hasStoredSection:hasStored, bigChips, cavemanPresent});
  })()`);

  // 4) toggle caveman OFF (해제) — find the 해제 button in caveman's row
  const offClick = await ev(`(()=>{
    const btns=[...document.querySelectorAll('button')].filter(b=>b.textContent.trim()==='해제');
    for(const b of btns){ const row=b.parentElement; if(row && row.textContent.includes('${SAFE}') && !row.textContent.includes('거대')){ b.click(); return 'clicked'; } }
    return 'not-found';
  })()`);
  await sleep(1800);
  await shot("03-after-off");
  const afterOff = await ev(`(()=>{
    const txt=document.body.innerText;
    // caveman should now be under 꺼짐·보관됨 with a 켜기 button in its row
    const storedHasCaveman = [...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='켜기' && b.parentElement && b.parentElement.textContent.includes('${SAFE}'));
    const stillEquipped = [...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='해제' && b.parentElement && b.parentElement.textContent.includes('${SAFE}'));
    return JSON.stringify({storedHasCaveman, stillEquipped});
  })()`);

  // 5) toggle caveman ON (켜기) — restore
  const onClick = await ev(`(()=>{
    const btns=[...document.querySelectorAll('button')].filter(b=>b.textContent.trim()==='켜기');
    for(const b of btns){ const row=b.parentElement; if(row && row.textContent.includes('${SAFE}')){ b.click(); return 'clicked'; } }
    return 'not-found';
  })()`);
  await sleep(1800);
  await shot("04-after-on");
  const afterOn = await ev(`(()=>{
    const backEquipped = [...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='해제' && b.parentElement && b.parentElement.textContent.includes('${SAFE}'));
    return JSON.stringify({backEquipped});
  })()`);

  console.log("STATE inventory:", state1);
  console.log("OFF click:", offClick, "| afterOff:", afterOff);
  console.log("ON  click:", onClick, "| afterOn:", afterOn);
  console.log("console errors:", consoleErrors.length ? consoleErrors.slice(0, 10) : "none");
  console.log("screenshots saved to tools/shots/ : 01-deck 02-inventory 03-after-off 04-after-on");

  await CDP.Close({ id: tgt.id, port: PORT });
  await client.close();
})().catch((e) => { console.error("UI-SHOT ERROR:", e.message); process.exit(1); });
