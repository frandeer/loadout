// web-image-forge · CDP 자동화 (slide-design 포팅 → Loadout 카드/아이콘/BG/레이아웃용)
// 로그인된 ChatGPT 탭을 Chrome DevTools Protocol로 조종해 이미지 생성 → 다운로드.
import CDP from "chrome-remote-interface";

const CHATGPT_HOSTS = ["chatgpt.com", "chat.openai.com"];
const COMPOSER_SELECTOR =
  '[contenteditable="true"][data-testid="prompt-textarea"], #prompt-textarea, textarea[data-testid="prompt-textarea"]';
const SEND_BUTTON_SELECTOR =
  'button[data-testid="send-button"], button[data-testid="fruitjuice-send-button"]';
const IMAGE_HOST_PATTERN =
  /(files\.oaiusercontent\.com|files\.openai\.com|sdmntpr\w*\.oaiusercontent\.com|chatgpt\.com\/backend-api\/estuary\/content)/;
const DEFAULT_HOST = process.env.CHROME_HOST || "127.0.0.1";

export async function listTargets({ host = DEFAULT_HOST, port = 9222 } = {}) {
  return await CDP.List({ host, port });
}
export async function findChatGPTTarget({ host = DEFAULT_HOST, port = 9222 } = {}) {
  const targets = await listTargets({ host, port });
  return targets.find((t) => t.type === "page" && CHATGPT_HOSTS.some((h) => t.url.includes(h)));
}
export async function connectChrome({ host = DEFAULT_HOST, port = 9222, target } = {}) {
  const t = target ?? (await findChatGPTTarget({ host, port }));
  if (!t) { const err = new Error("No ChatGPT tab found. Run launch-chrome and sign in."); err.code = "NO_CHATGPT_TAB"; throw err; }
  const client = await CDP({ host, target: t, port });
  const { Page, Runtime, DOM, Input, Target, Network } = client;
  await Promise.all([Page.enable(), Runtime.enable(), DOM.enable(), Network.enable()]);
  return { client, target: t, Page, Runtime, DOM, Input, Target, Network,
    async dispose() { try { await client.close(); } catch {} } };
}
async function evalInPage(Runtime, expression, awaitPromise = true) {
  const result = await Runtime.evaluate({ expression, awaitPromise, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? "page eval failed");
  return result.result?.value;
}
export async function waitForComposer(ctx, { timeoutMs = 15000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ready = await evalInPage(ctx.Runtime, `(() => !!document.querySelector(${JSON.stringify(COMPOSER_SELECTOR)}))()`, false);
    if (ready) return;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("Composer not found (login wall or selector change?)");
}
export async function newChat(ctx) {
  await ctx.Page.navigate({ url: "https://chatgpt.com/?model=gpt-4o" });
  await ctx.Page.loadEventFired();
  await waitForComposer(ctx);
}
export async function sendPrompt(ctx, prompt) {
  const script = `
(async () => {
  const el = document.querySelector(${JSON.stringify(COMPOSER_SELECTOR)});
  if (!el) throw new Error("composer not found");
  el.focus();
  if (el.tagName === "TEXTAREA") { el.value = ${JSON.stringify(prompt)}; el.dispatchEvent(new Event("input",{bubbles:true})); }
  else { el.innerHTML = ""; for (const line of ${JSON.stringify(prompt)}.split("\\n")) { el.appendChild(document.createTextNode(line)); el.appendChild(document.createElement("br")); } el.dispatchEvent(new InputEvent("input",{bubbles:true})); }
  await new Promise(r=>setTimeout(r,200));
  const btn = document.querySelector(${JSON.stringify(SEND_BUTTON_SELECTOR)});
  if (btn && !btn.disabled) { btn.click(); return "click"; }
  el.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",code:"Enter",bubbles:true}));
  return "enter";
})()`;
  return await evalInPage(ctx.Runtime, script, true);
}
export async function waitForImages(ctx, { expectedCount, stabilityMs = 10000, timeoutMs = 240000, pollMs = 2000 } = {}) {
  if (!Number.isInteger(expectedCount) || expectedCount < 1) throw new Error("expectedCount must be a positive integer");
  const start = Date.now(); let seen = []; let lastChangeAt = Date.now();
  const collect = `
(() => {
  const turns = document.querySelectorAll('[data-message-author-role="assistant"]');
  const last = turns[turns.length-1] || document.querySelector('main') || document.body;
  if (!last) return [];
  const out = [];
  for (const img of last.querySelectorAll('img')) {
    if (!img.complete || !img.naturalWidth) continue;
    const src = img.currentSrc || img.src; if (!src) continue;
    if (!${IMAGE_HOST_PATTERN}.test(src)) continue;
    out.push({ src, alt: img.alt || "" });
  }
  return out;
})()`;
  while (Date.now() - start < timeoutMs) {
    const current = await evalInPage(ctx.Runtime, collect, false);
    const set = new Set(seen.map((i) => i.src)); let changed = false;
    for (const it of current) if (!set.has(it.src)) { seen.push(it); set.add(it.src); changed = true; }
    if (changed) lastChangeAt = Date.now();
    if (seen.length >= expectedCount && Date.now() - lastChangeAt >= stabilityMs) return seen.slice(0, expectedCount);
    await new Promise((r) => setTimeout(r, pollMs));
  }
  return seen;
}
export async function downloadImageBlob(ctx, src) {
  const script = `
(async () => {
  const r = await fetch(${JSON.stringify(src)}, { credentials: "include" });
  if (!r.ok) throw new Error("fetch " + r.status);
  const buf = await (await r.blob()).arrayBuffer();
  let bin = ""; const bytes = new Uint8Array(buf); const C = 0x8000;
  for (let i=0;i<bytes.length;i+=C) bin += String.fromCharCode.apply(null, bytes.subarray(i,i+C));
  return { mime: "image/png", base64: btoa(bin) };
})()`;
  return await evalInPage(ctx.Runtime, script, true);
}
