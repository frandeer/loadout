// web-image-forge · Grok CDP 자동화
// 로그인된 Grok 탭을 Chrome DevTools Protocol로 조종해 이미지 생성 → 다운로드.
// 셀렉터를 바꿔야 할 때: 이 파일 상단의 상수(GROK_HOSTS ~ IMAGE_HOST_PATTERN)만 수정.
import CDP from "chrome-remote-interface";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

// ── 조정 가능 상수 ─────────────────────────────────────────────────────────
const GROK_HOSTS = ["grok.com", "x.com/i/grok", "x.ai"];

// 프롬프트 입력창 셀렉터 (grok.com 기준 추정 — 바뀌면 여기만 수정)
const COMPOSER_SELECTOR = [
  'textarea[placeholder]',
  '[contenteditable="true"][aria-label]',
  'textarea',
].join(", ");

// 전송 버튼 셀렉터
const SEND_BUTTON_SELECTOR = [
  'button[aria-label="Send message"]',
  'button[aria-label="Generate"]',
  'button[type="submit"]',
  '[data-testid="send-button"]',
].join(", ");

// 생성된 이미지의 호스트 패턴 (grok/x.com CDN)
const IMAGE_HOST_PATTERN =
  /(pbs\.twimg\.com\/media|assets\.grok\.com\/(?!users\/)|abs\.twimg\.com\/media|grok\.com\/images\/media|x\.com\/.*\/media)/;

// 기본 Chrome 디버그 접속 주소
const DEFAULT_HOST = process.env.CHROME_HOST || "127.0.0.1";

// 기본 타임아웃
const COMPOSER_TIMEOUT_MS = 20000;
const WAIT_IMAGES_TIMEOUT_MS = 300000;
const STABILITY_MS = 8000;
const POLL_MS = 2000;
// ─────────────────────────────────────────────────────────────────────────────

// ── CDP 유틸 ─────────────────────────────────────────────────────────────────
async function evalInPage(Runtime, expression, awaitPromise = true) {
  const result = await Runtime.evaluate({ expression, awaitPromise, returnByValue: true });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description ?? "page eval failed");
  }
  return result.result?.value;
}

export async function listTargets({ host = DEFAULT_HOST, port = 9222 } = {}) {
  return await CDP.List({ host, port });
}

export async function findGrokTarget({ host = DEFAULT_HOST, port = 9222 } = {}) {
  const targets = await listTargets({ host, port });
  return targets.find(
    (t) => t.type === "page" && GROK_HOSTS.some((h) => t.url.includes(h))
  );
}

export async function connectGrok({ host = DEFAULT_HOST, port = 9222, target } = {}) {
  let t = target;
  if (!t) {
    try {
      t = await findGrokTarget({ host, port });
    } catch (e) {
      const err = new Error(
        `Chrome DevTools에 연결할 수 없습니다 (${e.message}). launch-chrome.ps1 실행 후 재시도하세요.`
      );
      err.code = "CHROME_UNREACHABLE";
      throw err;
    }
  }
  if (!t) {
    const err = new Error(
      "Grok 탭을 찾을 수 없습니다. Chrome에서 grok.com을 열고 로그인한 뒤 다시 시도하세요."
    );
    err.code = "NO_GROK_TAB";
    throw err;
  }
  const client = await CDP({ host, target: t, port });
  const { Page, Runtime, DOM, Input, Target, Network } = client;
  await Promise.all([Page.enable(), Runtime.enable(), DOM.enable(), Network.enable()]);
  return {
    client,
    target: t,
    Page,
    Runtime,
    DOM,
    Input,
    Target,
    Network,
    async dispose() {
      try { await client.close(); } catch {}
    },
  };
}

export async function waitForComposer(ctx, { timeoutMs = COMPOSER_TIMEOUT_MS } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ready = await evalInPage(
      ctx.Runtime,
      `(() => !!document.querySelector(${JSON.stringify(COMPOSER_SELECTOR)}))()`,
      false
    );
    if (ready) return;
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(
    "Grok 입력창을 찾을 수 없습니다 (로그인 필요 또는 셀렉터 변경). COMPOSER_SELECTOR 상수를 확인하세요."
  );
}

export async function navigateToGrok(ctx) {
  await ctx.Page.navigate({ url: "https://grok.com" });
  await ctx.Page.loadEventFired();
  await waitForComposer(ctx);
}

export async function sendPrompt(ctx, prompt) {
  const script = `
(async () => {
  const el = document.querySelector(${JSON.stringify(COMPOSER_SELECTOR)});
  if (!el) throw new Error("Grok 입력창을 찾을 수 없음 (composer not found)");
  el.focus();
  if (el.tagName === "TEXTAREA") {
    el.value = ${JSON.stringify(prompt)};
    el.dispatchEvent(new Event("input", { bubbles: true }));
  } else {
    el.innerHTML = "";
    for (const line of ${JSON.stringify(prompt)}.split("\\n")) {
      el.appendChild(document.createTextNode(line));
      el.appendChild(document.createElement("br"));
    }
    el.dispatchEvent(new InputEvent("input", { bubbles: true }));
  }
  await new Promise(r => setTimeout(r, 300));
  const btn = document.querySelector(${JSON.stringify(SEND_BUTTON_SELECTOR)});
  if (btn && !btn.disabled) { btn.click(); return "click"; }
  el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true }));
  return "enter";
})()`;
  return await evalInPage(ctx.Runtime, script, true);
}

export async function waitForImages(
  ctx,
  { expectedCount = 1, stabilityMs = STABILITY_MS, timeoutMs = WAIT_IMAGES_TIMEOUT_MS, pollMs = POLL_MS } = {}
) {
  if (!Number.isInteger(expectedCount) || expectedCount < 1) {
    throw new Error("expectedCount는 양의 정수여야 합니다");
  }
  const start = Date.now();
  let seen = [];
  let lastChangeAt = Date.now();

  // IMAGE_HOST_PATTERN을 문자열로 직렬화해 페이지 내 eval에 삽입
  const patternSrc = IMAGE_HOST_PATTERN.source;
  const patternFlags = IMAGE_HOST_PATTERN.flags;

  const collect = `
(() => {
  const pat = new RegExp(${JSON.stringify(patternSrc)}, ${JSON.stringify(patternFlags)});
  const out = [];
  for (const img of document.querySelectorAll('img')) {
    if (!img.complete || !img.naturalWidth) continue;
    const src = img.currentSrc || img.src;
    if (!src || !pat.test(src)) continue;
    out.push({ src, alt: img.alt || "" });
  }
  return out;
})()`;

  while (Date.now() - start < timeoutMs) {
    const current = await evalInPage(ctx.Runtime, collect, false);
    const set = new Set(seen.map((i) => i.src));
    let changed = false;
    for (const it of (current || [])) {
      if (!set.has(it.src)) { seen.push(it); set.add(it.src); changed = true; }
    }
    if (changed) lastChangeAt = Date.now();
    if (seen.length >= expectedCount && Date.now() - lastChangeAt >= stabilityMs) {
      return seen.slice(0, expectedCount);
    }
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
  for (let i = 0; i < bytes.length; i += C)
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + C));
  return { mime: "image/png", base64: btoa(bin) };
})()`;
  return await evalInPage(ctx.Runtime, script, true);
}

// ── 고수준 API: outDir에 이미지 저장하고 [{filename, path}] 반환 ──────────────
/**
 * Grok CDP로 이미지를 생성해 outDir에 저장한다.
 * @param {object} opts
 * @param {string} opts.prompt   - 이미지 생성 프롬프트
 * @param {number} [opts.count]  - 요청 이미지 수 (기본 1)
 * @param {string} opts.outDir   - 저장 디렉토리 (절대경로, 필수)
 * @param {string} [opts.host]   - Chrome 디버그 호스트
 * @param {number} [opts.port]   - Chrome 디버그 포트
 * @returns {Promise<Array<{filename: string, path: string}>>}
 */
export async function generateImages({ prompt, count = 1, outDir, host, port } = {}) {
  if (!outDir) {
    const err = new Error("outDir이 지정되지 않았습니다. 저장 경로를 반드시 명시하세요.");
    err.code = "NO_OUT_DIR";
    throw err;
  }

  const ctx = await connectGrok({ host, port });
  try {
    await navigateToGrok(ctx);
    await sendPrompt(ctx, prompt);
    const images = await waitForImages(ctx, { expectedCount: count });

    if (!images.length) {
      const err = new Error("Grok이 이미지를 생성하지 않았습니다. 타임아웃 또는 오류를 확인하세요.");
      err.code = "NO_IMAGES";
      throw err;
    }

    await mkdir(outDir, { recursive: true });

    const results = [];
    for (let i = 0; i < images.length; i++) {
      const blob = await downloadImageBlob(ctx, images[i].src);
      const timestamp = Date.now();
      const filename = `grok-${timestamp}-${i}.png`;
      const fullPath = join(outDir, filename);
      await writeFile(fullPath, Buffer.from(blob.base64, "base64"));
      results.push({ filename, path: fullPath });
    }
    return results;
  } finally {
    await ctx.dispose();
  }
}
