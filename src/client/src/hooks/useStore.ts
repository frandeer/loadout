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
  theme: "light" | "dark";
  loading: boolean;
  engines: string[];

  setFilter: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
  setSelected: (id: string | null) => void;
  toggleFavorite: (id: string) => void;
  togglePick: (id: string) => void;
  clearPicks: () => void;
  setLang: (l: "ko" | "en") => void;
  setTheme: (t: "light" | "dark") => void;
  loadData: () => Promise<void>;
  reloadData: () => Promise<void>;

  filtered: () => Item[];
}

export const useStore = create<AppState>((set, get) => ({
  items: [],
  meta: null,
  filters: {
    kind: "all",
    rarity: "all",
    q: "",
    sort: "score",
    dupOnly: false,
    equipOnly: false,
    favOnly: false,
  },
  selected: null,
  favorites: loadFavorites(),
  picked: new Set<string>(),
  lang: "en",
  theme: (localStorage.getItem("loadout-theme") as "light" | "dark") || "light",
  loading: true,
  engines: ["heuristic"],

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

  loadData: async () => {
    set({ loading: true });
    try {
      const data = await api.getIndex();
      const engData = await api.getEngines();
      set({ items: data.items, meta: data, engines: engData.engines, loading: false });
    } catch {
      set({ loading: false });
    }
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
