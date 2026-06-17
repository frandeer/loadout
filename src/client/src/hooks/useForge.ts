import { create } from "zustand";
import { api } from "../lib/api";
import type {
  ForgeSession, ForgeSessionSummary, ForgeCapabilities, ForgeVariant, ForgeExportResult,
} from "../types/forge";

// Forge 내부 화면 단계: 세션 목록 → 생성중/갤러리 → A/B 비교 → 내보내기
export type ForgeView = "list" | "gallery" | "pairwise" | "export";

interface ForgeState {
  caps: ForgeCapabilities | null;
  sessions: ForgeSessionSummary[];
  current: ForgeSession | null;
  view: ForgeView;
  exportResult: ForgeExportResult | null;
  busy: boolean;
  error: string | null;
  _pollTimer: ReturnType<typeof setInterval> | null;

  init: () => Promise<void>;
  loadSessions: () => Promise<void>;
  newSession: (prompt: string, opts?: { style?: string }) => Promise<void>;
  openSession: (id: string) => Promise<void>;
  startGenerate: () => Promise<void>;
  refresh: () => Promise<void>;
  setView: (v: ForgeView) => void;
  recordMatch: (a: string, b: string, result: 0 | 0.5 | 1, timeMs?: number) => Promise<void>;
  refine: (variantId: string, instructions: string) => Promise<ForgeVariant | null>;
  doExport: (variantId?: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  stopPolling: () => void;
  back: () => void;
}

export const useForge = create<ForgeState>((set, get) => ({
  caps: null,
  sessions: [],
  current: null,
  view: "list",
  exportResult: null,
  busy: false,
  error: null,
  _pollTimer: null,

  init: async () => {
    try {
      const [caps, s] = await Promise.all([api.forge.capabilities(), api.forge.sessions()]);
      set({ caps, sessions: s.sessions });
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },

  loadSessions: async () => {
    try {
      const s = await api.forge.sessions();
      set({ sessions: s.sessions });
    } catch (e) { set({ error: (e as Error).message }); }
  },

  newSession: async (prompt, opts) => {
    set({ busy: true, error: null });
    try {
      const { session } = await api.forge.create(prompt, opts);
      set({ current: session, view: "gallery", exportResult: null });
      await get().loadSessions();
      await get().startGenerate();
    } catch (e) {
      set({ error: (e as Error).message });
    } finally {
      set({ busy: false });
    }
  },

  openSession: async (id) => {
    get().stopPolling();
    set({ busy: true, error: null });
    try {
      const { session } = await api.forge.session(id);
      set({ current: session, view: "gallery", exportResult: null });
      if (session.status === "generating") get().refresh();
    } catch (e) {
      set({ error: (e as Error).message });
    } finally {
      set({ busy: false });
    }
  },

  startGenerate: async () => {
    const cur = get().current;
    if (!cur) return;
    try {
      await api.forge.generate(cur.id);
      // 폴링 시작
      get().stopPolling();
      const timer = setInterval(() => get().refresh(), 2500);
      set({ _pollTimer: timer });
      get().refresh();
    } catch (e) { set({ error: (e as Error).message }); }
  },

  refresh: async () => {
    const cur = get().current;
    if (!cur) return;
    try {
      const st = await api.forge.status(cur.id);
      set((s) => ({ current: s.current ? { ...s.current, status: st.status, variants: st.variants } : s.current }));
      if (st.status !== "generating" && st.pending === 0) get().stopPolling();
    } catch { /* 일시적 오류는 무시(다음 폴링) */ }
  },

  setView: (v) => set({ view: v }),

  recordMatch: async (a, b, result, timeMs) => {
    const cur = get().current;
    if (!cur) return;
    try {
      const r = await api.forge.match(cur.id, a, b, result, timeMs);
      // 로컬 Elo/승패 즉시 반영(낙관적).
      set((s) => {
        if (!s.current) return s;
        const variants = s.current.variants.map((v) => {
          if (v.id === a) return { ...v, elo: r.variantA.elo, wins: v.wins + (result === 1 ? 1 : 0), losses: v.losses + (result === 0 ? 1 : 0) };
          if (v.id === b) return { ...v, elo: r.variantB.elo, wins: v.wins + (result === 0 ? 1 : 0), losses: v.losses + (result === 1 ? 1 : 0) };
          return v;
        });
        return { current: { ...s.current, variants } };
      });
    } catch (e) { set({ error: (e as Error).message }); }
  },

  refine: async (variantId, instructions) => {
    const cur = get().current;
    if (!cur) return null;
    set({ busy: true });
    try {
      const { variant } = await api.forge.refine(cur.id, variantId, instructions);
      set((s) => (s.current ? { current: { ...s.current, variants: [...s.current.variants, variant] } } : s));
      return variant;
    } catch (e) {
      set({ error: (e as Error).message });
      return null;
    } finally {
      set({ busy: false });
    }
  },

  doExport: async (variantId) => {
    const cur = get().current;
    if (!cur) return;
    set({ busy: true, error: null });
    try {
      const r = await api.forge.exportKit(cur.id, variantId);
      set({ exportResult: r, view: "export" });
    } catch (e) {
      set({ error: (e as Error).message });
    } finally {
      set({ busy: false });
    }
  },

  remove: async (id) => {
    try {
      await api.forge.remove(id);
      if (get().current?.id === id) { get().stopPolling(); set({ current: null, view: "list" }); }
      await get().loadSessions();
    } catch (e) { set({ error: (e as Error).message }); }
  },

  stopPolling: () => {
    const t = get()._pollTimer;
    if (t) clearInterval(t);
    set({ _pollTimer: null });
  },

  back: () => {
    get().stopPolling();
    set({ current: null, view: "list", exportResult: null });
  },
}));
