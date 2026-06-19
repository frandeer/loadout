// Low-level Chrome DevTools Protocol (CDP) layer for driving chatgpt.com.
//
// This is adapted from the proven slide-design / loadout web-image-forge code,
// with one key change: connectChrome() now takes an EXPLICIT target so we can
// drive many tabs at once (the basis for parallel generation). createTab() lets
// the pool open additional ChatGPT tabs in the same logged-in profile.
//
// If ChatGPT ever changes its UI, the only things that usually need updating are
// the four selector/host constants at the top of this file.
import CDP from "chrome-remote-interface";

const CHATGPT_HOSTS = ["chatgpt.com", "chat.openai.com"];
export const CHATGPT_URL = "https://chatgpt.com/?model=gpt-4o";

const COMPOSER_SELECTOR =
  '[contenteditable="true"][data-testid="prompt-textarea"], #prompt-textarea, textarea[data-testid="prompt-textarea"]';
const SEND_BUTTON_SELECTOR =
  'button[data-testid="send-button"], button[data-testid="fruitjuice-send-button"]';
const IMAGE_HOST_PATTERN =
  /(files\.oaiusercontent\.com|files\.openai\.com|sdmntpr\w*\.oaiusercontent\.com|chatgpt\.com\/backend-api\/estuary\/content)/;

const DEFAULT_HOST = process.env.CHROME_HOST || "127.0.0.1";
const DEFAULT_PORT = Number(process.env.CHROME_PORT) || 9222;

export async function listTargets({ host = DEFAULT_HOST, port = DEFAULT_PORT } = {}) {
  return await CDP.List({ host, port });
}

export async function listChatGPTTargets({ host = DEFAULT_HOST, port = DEFAULT_PORT } = {}) {
  const targets = await listTargets({ host, port });
  return targets.filter(
    (t) => t.type === "page" && CHATGPT_HOSTS.some((h) => t.url.includes(h)),
  );
}

// Open a brand-new tab in the running Chrome instance (shares the logged-in
// profile, so no extra sign-in is needed). Returns the new CDP target object.
export async function createTab({ host = DEFAULT_HOST, port = DEFAULT_PORT, url = CHATGPT_URL } = {}) {
  return await CDP.New({ host, port, url });
}

// Attach to a specific target (tab) and enable the domains we use.
export async function connectChrome({ host = DEFAULT_HOST, port = DEFAULT_PORT, target } = {}) {
  if (!target) {
    const err = new Error("connectChrome requires an explicit target");
    err.code = "NO_TARGET";
    throw err;
  }
  let client;
  try {
    client = await CDP({ host, port, target });
  } catch (err) {
    const wrapped = new Error(
      `Cannot reach Chrome DevTools at ${host}:${port} (${err.message}). Run launch-chrome.ps1 first.`,
    );
    wrapped.code = "CHROME_UNREACHABLE";
    throw wrapped;
  }
  const { Page, Runtime, DOM, Input, Target, Network } = client;
  await Promise.all([Page.enable(), Runtime.enable(), DOM.enable(), Network.enable()]);
  return {
    client,
    target,
    Page,
    Runtime,
    DOM,
    Input,
    Target,
    Network,
    async dispose() {
      try {
        await client.close();
      } catch {}
    },
  };
}

async function evalInPage(Runtime, expression, awaitPromise = true) {
  const result = await Runtime.evaluate({ expression, awaitPromise, returnByValue: true });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description ?? "page eval failed");
  }
  return result.result?.value;
}

export async function waitForComposer(ctx, { timeoutMs = 15000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ready = await evalInPage(
      ctx.Runtime,
      `(() => !!document.querySelector(${JSON.stringify(COMPOSER_SELECTOR)}))()`,
      false,
    );
    if (ready) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  const err = new Error(
    "ChatGPT composer not found (not signed in, or the UI changed). Sign in via launch-chrome.ps1.",
  );
  err.code = "NOT_SIGNED_IN";
  throw err;
}

export async function newChat(ctx) {
  await ctx.Page.navigate({ url: CHATGPT_URL });
  await ctx.Page.loadEventFired();
  await waitForComposer(ctx);
}

export async function sendPrompt(ctx, prompt) {
  const script = `
(async () => {
  const el = document.querySelector(${JSON.stringify(COMPOSER_SELECTOR)});
  if (!el) throw new Error("composer not found");
  el.focus();
  if (el.tagName === "TEXTAREA") {
    el.value = ${JSON.stringify(prompt)};
    el.dispatchEvent(new Event("input", { bubbles: true }));
  } else {
    el.innerHTML = "";
    const text = ${JSON.stringify(prompt)};
    for (const line of text.split("\\n")) {
      const t = document.createTextNode(line);
      el.appendChild(t);
      el.appendChild(document.createElement("br"));
    }
    el.dispatchEvent(new InputEvent("input", { bubbles: true }));
  }
  await new Promise((resolve) => setTimeout(resolve, 200));
  const btn = document.querySelector(${JSON.stringify(SEND_BUTTON_SELECTOR)});
  if (btn && !btn.disabled) {
    btn.click();
    return "click";
  }
  el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true }));
  return "enter";
})()
`;
  return await evalInPage(ctx.Runtime, script, true);
}

export async function waitForImages(
  ctx,
  { expectedCount, stabilityMs = 10000, timeoutMs = 240000, pollMs = 2000, onPoll } = {},
) {
  if (!Number.isInteger(expectedCount) || expectedCount < 1) {
    throw new Error("expectedCount must be a positive integer");
  }
  const start = Date.now();
  let seen = [];
  let lastChangeAt = Date.now();

  // We always run in a FRESH chat (newChat), so the only generated images on the
  // page belong to this turn. Identify them purely by the ChatGPT content host —
  // that pattern only matches finished, downloadable generated images. We do NOT
  // require img.naturalWidth: ChatGPT lazy-loads these <img>s, and an automated
  // (often backgrounded) tab never scrolls them into view, so they stay decoded
  // at 0x0 forever — but the src is still fetchable. Dedup by the file id so the
  // several <img> tags ChatGPT renders for one image collapse to one result.
  const collect = `
(() => {
  const seen = new Set();
  const out = [];
  for (const img of document.querySelectorAll('img')) {
    const src = img.currentSrc || img.src;
    if (!src) continue;
    if (!${IMAGE_HOST_PATTERN}.test(src)) continue;
    const idMatch = src.match(/(?:id=|\\/)(file[_-][\\w-]+)/);
    const key = idMatch ? idMatch[1] : src;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ src, alt: img.alt || "" });
  }
  return out;
})()
`;

  while (Date.now() - start < timeoutMs) {
    const current = await evalInPage(ctx.Runtime, collect, false);
    const srcSet = new Set(seen.map((item) => item.src));
    let changed = false;
    for (const item of current) {
      if (!srcSet.has(item.src)) {
        seen.push(item);
        srcSet.add(item.src);
        changed = true;
      }
    }
    if (changed) lastChangeAt = Date.now();
    if (typeof onPoll === "function") onPoll(seen.length);
    if (seen.length >= expectedCount && Date.now() - lastChangeAt >= stabilityMs) {
      return seen.slice(0, expectedCount);
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
  return seen;
}

export async function downloadImageBlob(ctx, src) {
  const script = `
(async () => {
  const r = await fetch(${JSON.stringify(src)}, { credentials: "include" });
  if (!r.ok) throw new Error("fetch " + r.status);
  const blob = await r.blob();
  const buf = await blob.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buf);
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return { mime: blob.type || "image/png", base64: btoa(binary) };
})()
`;
  return await evalInPage(ctx.Runtime, script, true);
}
