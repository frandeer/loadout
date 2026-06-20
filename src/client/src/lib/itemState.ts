import type { Item } from "../types";
import { isEquippable } from "../types";

/* ── 자산의 ~/.claude 상태 술어(단일 출처) ─────────────────────────────
   "활성 / 설치 베이스 / 라이브"는 대시보드 KPI·인벤토리 섹션·그래프 앵커가 모두
   같은 정의를 써야 일관된다. 과거엔 컴포넌트마다 미묘하게 다른 인라인 조건을 써
   같은 자산이 화면마다 다르게 분류되는 결함(H#1·M#2 부류)이 났다 → 여기로 단일화.

   서버(server.mjs) 불변식 전제:
   - 앰비언트(ambient=true)는 항상 equipped=false · claudeState="resident".
   - 관리 항목의 라이브 자리가 실폴더면 divergent=true(⟹ claudeState="resident").
   - 우리 링크는 claudeState="link", 보관(vault off)은 "absent".
   - memory/mcp 는 장착 개념이 없다(isEquippable=false). */

export { isEquippable };

/** 활성(로드아웃 장착) — 사용자가 Loadout 으로 의도적으로 장착한 것.
 *  우리 링크(claudeState==="link") 또는 레거시 장착(미관리·equipped·상태 미확정).
 *  분기(divergent)·설치 베이스(ambient)는 제외 — 정직한 2지표의 "활성". */
export function isActive(i: Item): boolean {
  return (
    isEquippable(i.kind) &&
    !i.divergent &&
    !i.ambient &&
    (i.claudeState === "link" || (!i.managed && !!i.equipped && i.claudeState == null))
  );
}

/** 설치 베이스(앰비언트) — 플러그인/직접 설치로 ~/.claude 에 물리적으로 있으나
 *  Loadout 으로 의도적으로 장착한 게 아닌 항목(서버가 ambient=true 로 표시). */
export function isAmbient(i: Item): boolean {
  return isEquippable(i.kind) && !!i.ambient && !i.divergent;
}

/** 라이브(실제 로드) — 활성 + 설치 베이스. ~/.claude 에 상시 존재해
 *  설명/스키마가 항상 로드되는 자산(상시 컨텍스트 부하의 모집단). */
export function isLive(i: Item): boolean {
  return isActive(i) || isAmbient(i);
}

/** ~/.claude 에 물리적으로 존재(분기 포함) — 그래프 앵커처럼 "지금 디렉터리에
 *  있나"만 묻는 곳용. isLive 와 달리 divergent 도 포함(여전히 로드됨).
 *  installed(소스가 ~/.claude 하위)는 카탈로그 대부분이 해당돼 의미 없으므로 제외. */
export function isInClaudeDir(i: Item): boolean {
  return Boolean(i.equipped || i.claudeState === "resident" || i.claudeState === "link");
}
