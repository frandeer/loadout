import type { Item } from "../types";

/* ── 신호 링크(시너지) 시스템 ───────────────────────────────
   TFT 특성 임계치 메커닉의 작전 테마 번역.
   아이템 콘텐츠에서 특성 태그를 휴리스틱으로 추출하고,
   같은 특성이 임계치(2/4/6)에 도달하면 링크가 단계별로 발동한다.
   추후 scan.mjs가 태그를 직접 부여하면 이 추출부만 교체. */

export interface Trait {
  key: string;
  label: string;       // 작전 코드명
  pattern: RegExp;     // name+description+category 매칭
  bonus: [string, string, string]; // 단계별 발동 효과 설명
}

export const TRAITS: Trait[] = [
  {
    key: "build", label: "구축",
    pattern: /code|coding|refactor|implement|typescript|python|frontend|component|빌드|구현|코드/i,
    bonus: ["구현 정확도 소폭 상승", "멀티파일 작전 안정화", "대규모 리팩토링 해금"],
  },
  {
    key: "recon", label: "정찰",
    pattern: /search|research|browse|crawl|scrape|fetch|explore|web|검색|조사|탐색/i,
    bonus: ["탐색 범위 확장", "교차 검증 정찰", "전장 전체 가시화"],
  },
  {
    key: "audit", label: "감찰",
    pattern: /review|audit|verify|qa\b|test|lint|security|검증|리뷰|감사|보안/i,
    bonus: ["기본 검문소 가동", "이중 검증 체계", "무결성 전선 구축"],
  },
  {
    key: "archive", label: "기록",
    pattern: /doc|write|wiki|article|pdf|slide|note|memo|문서|기록|작성/i,
    bonus: ["작전 기록 자동화", "지식 베이스 연결", "완전 문서화 체계"],
  },
  {
    key: "memory", label: "기억",
    pattern: /memory|context|knowledge|recall|learn|기억|메모리|컨텍스트/i,
    bonus: ["세션 간 기억 유지", "장기 기억 결속", "조직 기억 공유망"],
  },
  {
    key: "deploy", label: "집행",
    pattern: /deploy|ship|release|ci\b|docker|publish|배포|출시|릴리스/i,
    bonus: ["출격 절차 단축", "무중단 집행", "완전 자동 출격"],
  },
  {
    key: "plan", label: "전략",
    pattern: /plan|design|architect|spec|brainstorm|roadmap|기획|설계|계획|전략/i,
    bonus: ["작전 입안 보조", "다각 전술 비교", "전역 전략 수립"],
  },
  {
    key: "auto", label: "자동",
    pattern: /loop|cron|schedule|workflow|hook|automat|orchestr|자동|루프|스케줄/i,
    bonus: ["반복 임무 위임", "무인 작전 가동", "완전 자율 편대"],
  },
  {
    key: "git", label: "형상",
    pattern: /\bgit\b|commit|branch|merge|\bpr\b|github|worktree|커밋|브랜치/i,
    bonus: ["이력 추적 강화", "원자적 커밋 규율", "히스토리 완전 통제"],
  },
  {
    key: "vision", label: "시각",
    pattern: /image|design|ui\b|ux\b|visual|screenshot|figma|디자인|이미지|시각/i,
    bonus: ["시각 정찰 확보", "디자인 화력 지원", "비주얼 제공권 장악"],
  },
];

export const LINK_THRESHOLDS = [2, 4, 6] as const;
export const LINK_GRADES = ["브론즈", "실버", "골드"] as const;

export function traitsOf(item: Item): Trait[] {
  // scan.mjs가 부여한 태그가 있으면 그걸 신뢰(서버가 진실의 원천), 없으면 클라이언트 휴리스틱.
  if (item.tags && item.tags.length) return TRAITS.filter((tr) => item.tags!.includes(tr.key));
  const t = `${item.name} ${item.displayName} ${item.category ?? ""} ${item.description}`;
  return TRAITS.filter((tr) => tr.pattern.test(t));
}

export interface LinkState {
  trait: Trait;
  count: number;
  tier: number;        // 0 = 미발동, 1~3 = 발동 단계
  next: number | null; // 다음 임계치(만렙이면 null)
}

/** 멤버 집합의 신호 링크 상태 — 작전 보드의 핵심 계산 */
export function computeLinks(members: Item[]): LinkState[] {
  const counts = new Map<string, number>();
  for (const m of members)
    for (const tr of traitsOf(m)) counts.set(tr.key, (counts.get(tr.key) ?? 0) + 1);

  return TRAITS
    .map((trait) => {
      const count = counts.get(trait.key) ?? 0;
      let tier = 0;
      for (const th of LINK_THRESHOLDS) if (count >= th) tier++;
      const next = LINK_THRESHOLDS.find((th) => count < th) ?? null;
      return { trait, count, tier, next };
    })
    .filter((l) => l.count > 0)
    .sort((a, b) => b.tier - a.tier || b.count - a.count);
}

/** 1개만 더 배치하면 다음 임계치에 닿는 특성 키 — 덱의 "링크+" 추천 뱃지용 */
export function neededTraitKeys(members: Item[]): Set<string> {
  return new Set(
    computeLinks(members)
      .filter((l) => l.next !== null && l.next - l.count === 1)
      .map((l) => l.trait.key),
  );
}

/** 팀 전투력 = 멤버 점수 합 + 링크 단계 보너스(단계당 +50) */
export function teamPower(members: Item[]): { base: number; bonus: number; total: number } {
  const base = members.reduce((s, m) => s + (m.score || 0), 0);
  const bonus = computeLinks(members).reduce((s, l) => s + l.tier * 50, 0);
  return { base, bonus, total: base + bonus };
}

/* ── 코스트 = 마나 게이지 ──
   하네스 원칙 "적게 장착할수록 강하다"의 게임화. 컨텍스트 토큰 예산. */
export const MANA_BUDGET = 24000;

/** 멤버 집합의 총 컨텍스트 코스트 */
export function teamCost(members: Item[]): number {
  return members.reduce((s, m) => s + (m.cost || 0), 0);
}

/* ── 작전 역할 슬롯 (목업 BLACK-ORCHID 5직제) ── */
export interface Role {
  key: string;
  label: string;
  desc: string;
  affinity: string[]; // 적성 특성 — 추천 배지에 사용
}

export const ROLES: Role[] = [
  { key: "analyst", label: "분석관", desc: "코드·데이터 해부", affinity: ["audit", "memory"] },
  { key: "scout", label: "정찰관", desc: "탐색·조사·수집", affinity: ["recon", "vision"] },
  { key: "builder", label: "구축관", desc: "구현·제작 주력", affinity: ["build", "plan"] },
  { key: "appraiser", label: "감정관", desc: "검증·품질 판정", affinity: ["audit", "archive"] },
  { key: "enforcer", label: "집행관", desc: "배포·자동 실행", affinity: ["deploy", "auto", "git"] },
];

/** 아이템의 역할 적성 점수 — 슬롯 추천에 사용 */
export function roleFit(item: Item, role: Role): number {
  const keys = traitsOf(item).map((t) => t.key);
  return role.affinity.filter((a) => keys.includes(a)).length;
}
