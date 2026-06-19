// TabPool: the heart of parallel generation.
//
// ChatGPT's web UI only processes one prompt per conversation/tab at a time, so
// "parallel" means "several tabs, each running one prompt independently". This
// pool keeps N attached ChatGPT tabs and hands them out one at a time. A request
// that arrives when every tab is busy waits in a FIFO queue until one frees up,
// so the pool also acts as a natural concurrency limiter.
//
// The pool is the single owner of the Chrome connection. The HTTP server owns one
// pool; the MCP server is a thin client that forwards to the HTTP server, so there
// is never more than one process fighting over the same tabs.
import { connectChrome, createTab, listChatGPTTargets, CHATGPT_URL } from "./chrome.js";

export class TabPool {
  constructor({ host = "127.0.0.1", port = 9222, size = 3 } = {}) {
    this.host = host;
    this.port = port;
    this.size = Math.max(1, size);
    this.slots = []; // { id, ctx, busy }
    this.waiters = []; // resolve fns waiting for a free slot
    this.ready = false;
    this._initPromise = null;
  }

  // Idempotent. Safe to call before every generate; only does real work once.
  async ensureReady() {
    if (this.ready) return;
    if (this._initPromise) return this._initPromise;
    this._initPromise = this._init().finally(() => {
      this._initPromise = null;
    });
    return this._initPromise;
  }

  async _init() {
    // Reuse any ChatGPT tabs the user already has open, then top up to `size`.
    const existing = await listChatGPTTargets({ host: this.host, port: this.port });
    const targets = existing.slice(0, this.size);
    while (targets.length < this.size) {
      targets.push(await createTab({ host: this.host, port: this.port, url: CHATGPT_URL }));
    }

    this.slots = [];
    for (let i = 0; i < targets.length; i++) {
      const ctx = await connectChrome({ host: this.host, port: this.port, target: targets[i] });
      this.slots.push({ id: i, ctx, busy: false });
    }
    this.ready = true;
  }

  status() {
    return {
      ready: this.ready,
      size: this.size,
      slots: this.slots.length,
      busy: this.slots.filter((s) => s.busy).length,
      free: this.slots.filter((s) => !s.busy).length,
      queued: this.waiters.length,
    };
  }

  // Acquire a free slot, waiting (FIFO) if all are busy.
  async acquire() {
    await this.ensureReady();
    const free = this.slots.find((s) => !s.busy);
    if (free) {
      free.busy = true;
      return free;
    }
    return new Promise((resolve) => this.waiters.push(resolve));
  }

  release(slot) {
    if (!slot) return;
    const next = this.waiters.shift();
    if (next) {
      // Hand the still-busy slot straight to the next waiter (no busy=false gap).
      next(slot);
    } else {
      slot.busy = false;
    }
  }

  async dispose() {
    for (const s of this.slots) {
      await s.ctx.dispose();
    }
    this.slots = [];
    this.ready = false;
  }
}
