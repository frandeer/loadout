// web-image-forge · 백엔드 디스패처
// generate({ engine, prompt, count, outDir }) → [{filename, path}]
// engine: "chatgpt" | "grok"
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

// ChatGPT(CDP) 경로
import {
  connectChrome,
  newChat,
  sendPrompt as chatgptSendPrompt,
  waitForImages as chatgptWaitForImages,
  downloadImageBlob as chatgptDownloadImageBlob,
} from "./chrome.js";

// Grok(CDP) 경로
import { generateImages as grokGenerateImages } from "./grok.js";

/**
 * 이미지를 생성해 outDir에 저장한다.
 *
 * @param {object}  opts
 * @param {"chatgpt"|"grok"} opts.engine  - 백엔드 선택 (기본 "chatgpt")
 * @param {string}  opts.prompt           - 이미지 생성 프롬프트
 * @param {number}  [opts.count=1]        - 생성할 이미지 수
 * @param {string}  opts.outDir           - 저장 디렉토리 절대경로 (필수)
 * @param {string}  [opts.host]           - Chrome 디버그 호스트
 * @param {number}  [opts.port]           - Chrome 디버그 포트
 * @returns {Promise<Array<{filename: string, path: string}>>}
 */
export async function generate({
  engine = "chatgpt",
  prompt,
  count = 1,
  outDir,
  host,
  port,
} = {}) {
  // ── 공통 선행 검사 ──────────────────────────────────────────────────────────
  if (!outDir) {
    const err = new Error(
      "outDir이 지정되지 않았습니다. 이미지 저장 경로를 반드시 지정하세요."
    );
    err.code = "NO_OUT_DIR";
    throw err;
  }
  if (!prompt || !prompt.trim()) {
    const err = new Error("prompt가 비어 있습니다.");
    err.code = "NO_PROMPT";
    throw err;
  }
  if (!Number.isInteger(count) || count < 1) {
    throw new Error("count는 1 이상의 정수여야 합니다.");
  }

  const normalizedEngine = (engine || "chatgpt").toLowerCase();

  if (normalizedEngine === "grok") {
    // ── Grok 경로 ────────────────────────────────────────────────────────────
    return await grokGenerateImages({ prompt, count, outDir, host, port });
  }

  if (normalizedEngine === "chatgpt") {
    // ── ChatGPT(CDP) 경로 ────────────────────────────────────────────────────
    const ctx = await connectChrome({ host, port }).catch((e) => {
      if (e.code === "NO_CHATGPT_TAB") throw e;
      const err = new Error(
        `Chrome DevTools에 연결할 수 없습니다 (${e.message}). launch-chrome.ps1 실행 후 재시도하세요.`
      );
      err.code = "CHROME_UNREACHABLE";
      throw err;
    });

    try {
      await newChat(ctx);
      await chatgptSendPrompt(ctx, prompt);
      const images = await chatgptWaitForImages(ctx, { expectedCount: count });

      if (!images.length) {
        const err = new Error(
          "ChatGPT가 이미지를 생성하지 않았습니다. 타임아웃 또는 오류를 확인하세요."
        );
        err.code = "NO_IMAGES";
        throw err;
      }

      await mkdir(outDir, { recursive: true });

      const results = [];
      for (let i = 0; i < images.length; i++) {
        const blob = await chatgptDownloadImageBlob(ctx, images[i].src);
        const timestamp = Date.now();
        const filename = `chatgpt-${timestamp}-${i}.png`;
        const fullPath = join(outDir, filename);
        await writeFile(fullPath, Buffer.from(blob.base64, "base64"));
        results.push({ filename, path: fullPath });
      }
      return results;
    } finally {
      await ctx.dispose();
    }
  }

  // ── 알 수 없는 엔진 ────────────────────────────────────────────────────────
  const err = new Error(
    `알 수 없는 engine: "${engine}". "chatgpt" 또는 "grok" 중 하나를 지정하세요.`
  );
  err.code = "UNKNOWN_ENGINE";
  throw err;
}
