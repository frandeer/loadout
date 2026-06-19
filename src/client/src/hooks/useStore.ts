import { create } from "zustand";
import type { Item, IndexData, FilterState } from "../types";
import { loadFavorites, saveFavorites } from "../lib/utils";
import { ROLES } from "../lib/traits";
import { api } from "../lib/api";

/* ── 작전 편성 상태 ──
   slots(작업 중 편성)는 localStorage, presets(저장된 팀)는 서버 data/teams.json 영속. */
export type OpsSlots = Record<string, string | null>; // roleKey → itemId
export interface OpsPreset {
  name: string;
  slots: OpsSlots;
  at: number;
  elo?: number; // 서버(teams.json) 영속 Elo — A/B 대전 결과로 갱신
}

const OPS_KEY = "loadout-ops";

function loadOps(): { slots: OpsSlots; presets: Record<string, OpsPreset> } {
  try {
    const raw = JSON.parse(localStorage.getItem(OPS_KEY) || "{}");
    return { slots: raw.slots || {}, presets: raw.presets || {} };
  } catch {
    return { slots: {}, presets: {} };
  }
}

function saveOps(slots: OpsSlots) {
  // presets는 서버가 진실의 원천 — localStorage에는 slots만 남긴다.
  localStorage.setItem(OPS_KEY, JSON.stringify({ slots }));
}

interface AppState {
  items: Item[];
  meta: IndexData | null;
  filters: FilterState;
  selected: string | null;
  favorites: Set<string>;
  picked: Set<string>;
  lang: "ko" | "en";
  theme: "light" | "dark";
  loading: boolean;
  engines: string[];

  slots: OpsSlots;
  presets: Record<string, OpsPreset>;

  setFilter: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
  setSelected: (id: string | null) => void;
  toggleFavorite: (id: string) => void;
  togglePick: (id: string) => void;
  clearPicks: () => void;
  setLang: (l: "ko" | "en") => void;
  setTheme: (t: "light" | "dark") => void;
  loadData: () => Promise<void>;
  reloadData: () => Promise<void>;

  assignSlot: (role: string, id: string | null) => void;
  savePreset: (name: string) => Promise<string>;
  loadPreset: (id: string) => void;
  removePreset: (id: string) => void;

  filtered: () => Item[];
  panelWidth: number;
  setPanelWidth: (w: number) => void;
}

export const useStore = create<AppState>((set, get) => ({
  items: [],
  meta: null,
  filters: {
    kind: "all",
    rarity: "all",
    category: "all",
    q: "",
    sort: "score",
    dupOnly: false,
    equipOnly: false,
    favOnly: false,
  },
  selected: null,
  favorites: loadFavorites(),
  picked: new Set<string>(),
  lang: "ko",
  theme: "dark",
  loading: true,
  engines: ["heuristic"],

  ...loadOps(),

  setFilter: (key, value) =>
    set((s) => ({ filters: { ...s.filters, [key]: value } })),

  setSelected: (id) => set({ selected: id }),

  toggleFavorite: (id) =>
    set((s) => {
      const next = new Set(s.favorites);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveFavorites(next);
      return { favorites: next };
    }),

  togglePick: (id) =>
    set((s) => {
      const next = new Set(s.picked);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { picked: next };
    }),

  clearPicks: () => set({ picked: new Set<string>() }),

  setLang: (l) => set({ lang: l }),
  setTheme: (t) => {
    localStorage.setItem("loadout-theme", t);
    document.documentElement.dataset.theme = t;
    set({ theme: t });
  },

  panelWidth: (() => {
    try {
      const saved = localStorage.getItem("loadout-panel-width");
      return saved ? parseInt(saved, 10) : 400;
    } catch {
      return 400;
    }
  })(),
  setPanelWidth: (w) => {
    try {
      localStorage.setItem("loadout-panel-width", w.toString());
    } catch {}
    set({ panelWidth: w });
  },

  loadData: async () => {
    set({ loading: true });
    try {
      const data = await api.getIndex();
      const engData = await api.getEngines();
      set({ items: data.items, meta: data, engines: engData.engines, loading: false });
    } catch {
      set({ loading: false });
    }
    // 팀 프리셋: 서버에서 로드. 서버가 비어 있고 예전 localStorage 프리셋이 있으면 1회 이관.
    try {
      const t = await api.getTeams();
      let presets = t.teams || {};
      const local = get().presets;
      if (!Object.keys(presets).length && Object.keys(local).length) {
        presets = local;
        api.saveTeams(presets).catch(() => {});
      }
      set({ presets });
    } catch {}
  },

  reloadData: async () => {
    try {
      const data = await api.getIndex();
      set({ items: data.items, meta: data });
    } catch {}
  },

  assignSlot: (role, id) =>
    set((s) => {
      const slots = { ...s.slots };
      // 같은 요원이 다른 슬롯에 있으면 그 슬롯을 비운다(1인 1직책).
      if (id) for (const k of Object.keys(slots)) if (slots[k] === id) slots[k] = null;
      slots[role] = id;
      saveOps(slots);
      return { slots };
    }),

  // 서버(data/teams.json) 저장 완료를 await한 뒤 id를 resolve한다.
  // (export 등 후속 요청이 저장 완료 전에 도착해 404가 나는 레이스 방지)
  savePreset: async (name) => {
    const id = `team-${Date.now().toString(36)}`;
    const presets = { ...get().presets, [id]: { name, slots: { ...get().slots }, at: Date.now() } };
    set({ presets });
    try { await api.saveTeams(presets); } catch {}
    return id;
  },

  loadPreset: (id) =>
    set((s) => {
      const p = s.presets[id];
      if (!p) return {};
      // 키 위생: ROLES의 알려진 role.key만 남기고 레거시/외부 비정상 키는 버린다.
      const slots: OpsSlots = {};
      for (const r of ROLES) slots[r.key] = p.slots[r.key] ?? null;
      saveOps(slots);
      return { slots };
    }),

  removePreset: (id) =>
    set((s) => {
      const presets = { ...s.presets };
      delete presets[id];
      api.saveTeams(presets).catch(() => {});
      return { presets };
    }),

  filtered: () => {
    const { items, filters, favorites } = get();
    let xs = items;

    if (filters.kind !== "all") xs = xs.filter((i) => i.kind === filters.kind);
    if (filters.rarity !== "all") xs = xs.filter((i) => i.rarity === filters.rarity);
    if (filters.category !== "all") xs = xs.filter((i) => i.category === filters.category);
    if (filters.dupOnly) xs = xs.filter((i) => i.group);
    if (filters.equipOnly) xs = xs.filter((i) => i.equipped);
    if (filters.favOnly) xs = xs.filter((i) => favorites.has(i.id));
    if (filters.q) {
      const q = filters.q.toLowerCase();
      xs = xs.filter(
        (i) =>
          `${i.name} ${i.description} ${i.nameKo ?? ""} ${i.descKo ?? ""} ${i.source.repo}`
            .toLowerCase()
            .includes(q),
      );
    }

    const s = filters.sort;
    xs = [...xs].sort((a, b) => {
      if (s === "name") return a.name.localeCompare(b.name, "ko");
      const aVal = s === "score" ? a.score : (a.stats?.[s as keyof typeof a.stats] ?? a.score);
      const bVal = s === "score" ? b.score : (b.stats?.[s as keyof typeof b.stats] ?? b.score);
      return bVal - aVal || b.score - a.score;
    });

    return xs;
  },
}));
