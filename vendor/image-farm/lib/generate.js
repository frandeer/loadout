// High-level generation: prompt in -> image file(s) out.
// Runs the full ChatGPT-web flow on one pool slot, then releases it.
import { newChat, sendPrompt, waitForImages, downloadImageBlob } from "./chrome.js";
import { saveImage } from "./save.js";

const DEFAULT_OUT_DIR = "./generated";

let seq = 0;
function basenameFor(jobId, index) {
  // Time + monotonic counter + index keeps filenames unique even when several
  // jobs save in the same millisecond across parallel tabs.
  return `chatgpt-${Date.now()}-${jobId}-${index}`;
}

// One generation job on one slot. `pool` must be a TabPool.
export async function generate(pool, { prompt, count = 1, outDir = DEFAULT_OUT_DIR } = {}) {
  if (typeof prompt !== "string" || !prompt.trim()) {
    const err = new Error("prompt is required");
    err.code = "BAD_REQUEST";
    throw err;
  }
  const expectedCount = Math.min(Math.max(1, Number(count) || 1), 8);
  const jobId = (seq = (seq + 1) % 100000);
  const log = [];
  const t0 = Date.now();
  const note = (m) => log.push(`[+${((Date.now() - t0) / 1000).toFixed(1)}s] ${m}`);

  const slot = await pool.acquire();
  note(`acquired tab #${slot.id}`);
  try {
    await newChat(slot.ctx);
    note("new chat ready");
    const mode = await sendPrompt(slot.ctx, prompt);
    note(`prompt sent (${mode})`);

    const images = await waitForImages(slot.ctx, {
      expectedCount,
      onPoll: (n) => {
        if (n) note(`seen ${n}/${expectedCount} image(s)`);
      },
    });
    if (!images.length) {
      const err = new Error("ChatGPT produced no images (timeout, refusal, or selector change).");
      err.code = "NO_IMAGES";
      err.log = log;
      throw err;
    }
    note(`downloading ${images.length} image(s)`);

    const saved = [];
    for (let i = 0; i < images.length; i++) {
      const blob = await downloadImageBlob(slot.ctx, images[i].src);
      const r = await saveImage({
        base64: blob.base64,
        mime: blob.mime,
        dir: outDir,
        basename: basenameFor(jobId, i),
      });
      saved.push({ ...r, alt: images[i].alt });
    }
    note(`saved ${saved.length} file(s) to ${outDir}`);

    return {
      ok: true,
      tab: slot.id,
      count: saved.length,
      partial: saved.length < expectedCount,
      images: saved,
      log,
    };
  } finally {
    pool.release(slot);
  }
}

// Run many jobs in parallel. The pool caps real concurrency at its size; extra
// jobs queue automatically. Each job's failure is captured, not thrown, so one
// bad prompt doesn't sink the whole batch.
export async function generateBatch(pool, jobs) {
  if (!Array.isArray(jobs) || jobs.length === 0) {
    const err = new Error("jobs must be a non-empty array");
    err.code = "BAD_REQUEST";
    throw err;
  }
  return Promise.all(
    jobs.map(async (job, index) => {
      try {
        const result = await generate(pool, job);
        return { index, ...result };
      } catch (err) {
        return {
          index,
          ok: false,
          error: err.message,
          code: err.code || "ERROR",
          log: err.log || [],
        };
      }
    }),
  );
}
