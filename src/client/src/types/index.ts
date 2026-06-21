export type Kind = "skill" | "agent" | "mcp" | "memory";
export type Rarity = "legendary" | "epic" | "rare" | "uncommon" | "common";

// kind 라벨 — 앱 전역 단일 출처. 카드/디테일 뱃지·필터 칩·그래프 노드 모두 이 맵을 참조한다.
//   네 종류 이름을 영문으로 통일: Skill / Agent / MCP / Memory.
//   (이전엔 스킬/요원/장비/기억, CardDrop은 에이전트/메모리, Card·DetailPanel은 raw kind로 제각각이었음.)
export const KIND_LABELS: Record<Kind, string> = {
  skill: "Skill",
  agent: "Agent",
  mcp: "MCP",
  memory: "Memory",
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
  // ── vault (장착/해제 토글) — 서버가 /api/index 에 병합해 내려준다 ──
  managed?: boolean;                            // vault 관리 대상 — on/off 토글로 장착/해제
  claudeState?: "link" | "resident" | "absent"; // ~/.claude 상태: 링크 / 상주 / 꺼짐(보관)
  ambient?: boolean;                            // 앰비언트(설치 베이스) — 플러그인·직접 설치로 ~/.claude에 물리적 존재(미관리). 의도적 장착 아님 → 활성 KPI 제외
  oversized?: boolean;                          // 거대 자산 — 끄면 vault로 이동 보관(지연)
  divergent?: boolean;                          // vault와 라이브 사본이 분기 — pull/push 해소 필요
  tags?: string[];     // scan이 부여한 특성 태그 (신호 링크)
  image?: string;
  nameKo?: string;
  descKo?: string;
  cost?: number;        // 호출 시(on-demand) 본문 토큰 비용 추정 (~20000 캡)
  descCost?: number;    // 상시(always-on) 비용 — skill/agent는 설명만, mcp는 스키마(상한), scan 산출
  risks?: string[];     // "network" | "shell" | "creds" — 위험 신호
  uses?: number;        // 세션 로그 집계 사용 횟수 — 경험치(LV/XP)
  translated?: boolean;
  meta?: any;
  // ── 중복/그룹 메타 (scan이 부여, data/index.json에 존재) ──
  contentHash?: string;   // 동일 사본 판별 해시
  nameKey?: string;       // 정규화된 이름 키(그룹 묶기용)
  copies?: number;        // 동일 사본 개수
  copySources?: string[]; // 동일 사본 출처(repo) 목록
  copyPaths?: string[];   // 동일 사본 경로 목록
}

export interface IndexData {
  items: Item[];
  total: number;
  counts: Record<Kind, number>;
  dupGroups: number;
  scanned: string;
}

// ── 카드 드랍 (POST /api/drop) ──
export interface DropResp {
  ok: boolean;
  card: { id: string; name: string; kind: Kind };
  skillPath: string;
  note?: string;
  error?: string;
}

export type SortKey = "score" | "name" | "power" | "freshness" | "popularity" | "clarity" | "weight";

export interface FilterState {
  kind: Kind | "all";
  rarity: Rarity | "all";
  category: string;
  q: string;
  sort: SortKey;
  dupOnly: boolean;
  equipOnly: boolean;
  favOnly: boolean;
  group?: string;        // 동일 계열(중복) 묶음 필터 — 대시보드에서 그룹 클릭 시 set
  tag?: string | null;   // 구조적 태그 필터(item.tags 일치) — 자유 텍스트 q 와 분리(칩 선택용, M#1)
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
