export type Kind = "skill" | "agent" | "mcp" | "memory";
export type Rarity = "legendary" | "epic" | "rare" | "uncommon" | "common";

// kind 라벨 — 카드/디테일 뱃지 표기. memory는 한국어 "기억"(읽기 전용 카드).
export const KIND_LABELS: Record<Kind, string> = {
  skill: "스킬",
  agent: "요원",
  mcp: "장비",
  memory: "기억",
};

// memory kind는 장착 개념이 없는 읽기 전용 카드 — 장착/해제 UI를 숨긴다.
export function isEquippable(kind: Kind): boolean {
  return kind !== "memory";
}

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
  layer?: "index" | "note";  // memory kind 한정 — MEMORY.md=index, 개별 메모=note
  equipped?: boolean;
  installed?: boolean; // 이미 ~/.claude 에 상주 — 장착/해제 대상 아님
  tags?: string[];     // scan이 부여한 특성 태그 (신호 링크)
  image?: string;
  nameKo?: string;
  descKo?: string;
  cost?: number;        // 컨텍스트 토큰 비용 추정 (~20000 캡) — 마나 게이지
  risks?: string[];     // "network" | "shell" | "creds" — 위험 신호
  uses?: number;        // 세션 로그 집계 사용 횟수 — 경험치(LV/XP)
  translated?: boolean;
}

export interface IndexData {
  items: Item[];
  total: number;
  counts: Record<Kind, number>;
  dupGroups: number;
  scanned: string;
}

// ── 팀 단위 AI 평가 (POST /api/team/verify) ──
export interface TeamEvalScores {
  coverage: number; // 역할/영역 커버리지 (0-100)
  synergy: number;  // 신호 링크 시너지 (0-100)
  balance: number;  // 구성 균형 (0-100)
}
export interface TeamEvalResult {
  total: number;    // 종합 점수 (0-100)
  scores: TeamEvalScores;
  comment: string;  // 한국어 총평
  engine: string;   // 채점에 쓰인 엔진 (휴리스틱 폴백 가능)
}
export interface TeamVerifyResp {
  ok: boolean;
  result: TeamEvalResult;
  error?: string;
}

// ── 팀 A/B 대전 (POST /api/team/ab) ──
// 양 팀 모두 teams.json 저장 프리셋이어야 함(미저장 시 404). result는 team/verify와 동일 형태.
export interface TeamAbSide {
  teamId: string;
  name: string;
  result: TeamEvalResult;
}
export interface TeamAbResp {
  ok: boolean;
  a: TeamAbSide;
  b: TeamAbSide;
  winner: "a" | "b" | "draw";
  delta: number;              // total 점수 차(a-b 기준 절댓값)
  elo: { a: number; b: number }; // 갱신된 Elo(기본 1500, K=32)
  error?: string;
}

// ── 카드 드랍 (POST /api/drop) ──
export interface DropResp {
  ok: boolean;
  card: { id: string; name: string; kind: Kind };
  skillPath: string;
  note?: string;
  error?: string;
}

// ── OMC export (POST /api/team/export-omc) ──
export interface TeamExportOmcResp {
  ok: boolean;
  files: { "omc.jsonc": string; "team-command.md": string };
  dir: string;
  error?: string;
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

// White SaaS 등급 팔레트 — index.css 토큰과 톤 동기 유지.
export const RARITY_CONFIG: Record<Rarity, { ko: string; color: string; bg: string }> = {
  legendary: { ko: "S-Class", color: "#F59E0B", bg: "#FFF7ED" },
  epic:      { ko: "A-Class", color: "#8B5CF6", bg: "#F5F3FF" },
  rare:      { ko: "B-Class", color: "#3B82F6", bg: "#EFF6FF" },
  uncommon:  { ko: "C-Class", color: "#64748B", bg: "#F1F5F9" },
  common:    { ko: "D-Class", color: "#94A3B8", bg: "#F8FAFC" },
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
