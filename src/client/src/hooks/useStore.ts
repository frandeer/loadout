import { create } from "zustand";
import type { Item, IndexData, FilterState } from "../types";
import { loadFavorites, saveFavorites } from "../lib/utils";
import { api } from "../lib/api";

interface AppState {
  items: Item[];
  meta: IndexData | null;
  filters: FilterState;
  selected: string | null;
  favorites: Set<string>;
  picked: Set<string>;
  lang: "ko" | "en";
  loading: boolean;
  engines: string[];
  imageEngine: string; // 이미지 생성 엔진(codex|chatgpt|grok|image-farm|auto) — 서버 settings.json 영속

  setFilter: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
  setFilters: (partial: Partial<FilterState>) => void;
  setSelected: (id: string | null) => void;
  toggleFavorite: (id: string) => void;
  togglePick: (id: string) => void;
  clearPicks: () => void;
  setLang: (l: "ko" | "en") => void;
  setImageEngine: (e: string) => void;
  loadData: () => Promise<void>;
  reloadData: () => Promise<void>;

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
  loading: true,
  engines: ["heuristic"],
  imageEngine: "codex-api",

  setFilter: (key, value) =>
    set((s) => ({ filters: { ...s.filters, [key]: value } })),

  // 여러 필터 일괄 설정 — 대시보드 그룹 클릭 등에서 한 번에 전환(리렌더 1회).
  setFilters: (partial) =>
    set((s) => ({ filters: { ...s.filters, ...partial } })),

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
  // 엔진 변경 즉시 반영 + 서버 영속. 저장 실패해도 로컬 상태는 유지(다음 부팅에 서버값으로 복구).
  setImageEngine: (e) => {
    set({ imageEngine: e });
    api.saveSettings({ imageEngine: e }).catch(() => {});
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
    // 이미지 엔진 설정(서버 영속) 로드 — 실패 시 기본 codex 유지.
    try {
      const s = await api.getSettings();
      if (s?.settings?.imageEngine) set({ imageEngine: s.settings.imageEngine });
    } catch {}
  },

  reloadData: async () => {
    try {
      const data = await api.getIndex();
      set({ items: data.items, meta: data });
    } catch {}
  },

  filtered: () => {
    const { items, filters, favorites } = get();
    let xs = items;

    if (filters.kind !== "all") xs = xs.filter((i) => i.kind === filters.kind);
    if (filters.rarity !== "all") xs = xs.filter((i) => i.rarity === filters.rarity);
    if (filters.category !== "all") xs = xs.filter((i) => i.category === filters.category);
    if (filters.dupOnly) xs = xs.filter((i) => i.group);
    if (filters.group) xs = xs.filter((i) => i.group === filters.group);
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
