export type Kind = "skill" | "agent" | "mcp";
export type Rarity = "legendary" | "epic" | "rare" | "uncommon" | "common";

export interface ItemStats {
  popularity: number;
  freshness: number;
  power: number;
  clarity: number;
  weight: number;
}

export interface ItemSource {
  repo: string;
  owner: string;
  root: string;
  path: string;
}

export interface Item {
  id: string;
  name: string;
  displayName: string;
  description: string;
  kind: Kind;
  rarity: Rarity;
  score: number;
  stats: ItemStats;
  source: ItemSource;
  category?: string;
  group?: string;
  equipped?: boolean;
  image?: string;
  nameKo?: string;
  descKo?: string;
}

export interface IndexData {
  items: Item[];
  total: number;
  counts: Record<Kind, number>;
  dupGroups: number;
  scanned: string;
}

export type SortKey = "score" | "name" | "power" | "freshness" | "popularity" | "clarity" | "weight";

export interface FilterState {
  kind: Kind | "all";
  rarity: Rarity | "all";
  q: string;
  sort: SortKey;
  dupOnly: boolean;
  equipOnly: boolean;
  favOnly: boolean;
}

export const RARITY_CONFIG: Record<Rarity, { ko: string; color: string }> = {
  legendary: { ko: "S-CLASS", color: "#ffd700" },
  epic: { ko: "A-CLASS", color: "#a855f7" },
  rare: { ko: "B-CLASS", color: "#3b82f6" },
  uncommon: { ko: "C-CLASS", color: "#22c55e" },
  common: { ko: "D-CLASS", color: "#94a3b8" },
};

export const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "score", label: "종합 점수" },
  { key: "name", label: "이름" },
  { key: "power", label: "파워" },
  { key: "freshness", label: "신선도" },
  { key: "popularity", label: "인기" },
  { key: "clarity", label: "명확도" },
  { key: "weight", label: "무게" },
];
