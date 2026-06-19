import type { Item } from "../types";

/* ── 특성 태그(루터슈터 비주얼 스킨) ───────────────────────────
   아이템 콘텐츠에서 특성 태그를 휴리스틱으로 추출해 카드/디테일의 칩으로 노출한다.
   추후 scan.mjs가 태그를 직접 부여하면 이 추출부만 교체.
   (게임 보드 메커닉 — 신호 링크/역할 슬롯/시너지 — 은 D3 결정에 따라 제거됨) */

export interface Trait {
  key: string;
  label: string;       // 작전 코드명
  pattern: RegExp;     // name+description+category 매칭
}

export const TRAITS: Trait[] = [
  { key: "build", label: "구축", pattern: /code|coding|refactor|implement|typescript|python|frontend|component|빌드|구현|코드/i },
  { key: "recon", label: "정찰", pattern: /search|research|browse|crawl|scrape|fetch|explore|web|검색|조사|탐색/i },
  { key: "audit", label: "감찰", pattern: /review|audit|verify|qa\b|test|lint|security|검증|리뷰|감사|보안/i },
  { key: "archive", label: "기록", pattern: /doc|write|wiki|article|pdf|slide|note|memo|문서|기록|작성/i },
  { key: "memory", label: "기억", pattern: /memory|context|knowledge|recall|learn|기억|메모리|컨텍스트/i },
  { key: "deploy", label: "집행", pattern: /deploy|ship|release|ci\b|docker|publish|배포|출시|릴리스/i },
  { key: "plan", label: "전략", pattern: /plan|design|architect|spec|brainstorm|roadmap|기획|설계|계획|전략/i },
  { key: "auto", label: "자동", pattern: /loop|cron|schedule|workflow|hook|automat|orchestr|자동|루프|스케줄/i },
  { key: "git", label: "형상", pattern: /\bgit\b|commit|branch|merge|\bpr\b|github|worktree|커밋|브랜치/i },
  { key: "vision", label: "시각", pattern: /image|design|ui\b|ux\b|visual|screenshot|figma|디자인|이미지|시각/i },
];

export function traitsOf(item: Item): Trait[] {
  // scan.mjs가 부여한 태그가 있으면 그걸 신뢰(서버가 진실의 원천), 없으면 클라이언트 휴리스틱.
  if (item.tags && item.tags.length) return TRAITS.filter((tr) => item.tags!.includes(tr.key));
  const t = `${item.name} ${item.displayName} ${item.category ?? ""} ${item.description}`;
  return TRAITS.filter((tr) => tr.pattern.test(t));
}

/* ── 코스트 = 마나 게이지 ──
   하네스 원칙 "적게 장착할수록 강하다"의 게임화. 컨텍스트 토큰 예산. */
export const MANA_BUDGET = 24000;

/** 멤버 집합의 총 컨텍스트 코스트 — 인벤토리 마나 게이지용 */
export function teamCost(members: Item[]): number {
  return members.reduce((s, m) => s + (m.cost || 0), 0);
}
