# 08 — 핸드오프 / 재시작 가이드 (Control Tower 재편)

> **이 문서부터 읽으세요.** 컨텍스트 압축 후 작업 재개용 단일 진입점.
> 작성 2026-06-20. 짝꿍 문서: [`07-redesign.md`](07-redesign.md)(결정·근거), 자동메모리 `loadout-run-build`(실행법).

## 0. 한 줄 요약

skill·agent·mcp·memory를 보고·이해·해제·삭제하는 **4탭 컨트롤 타워**로 전면 재편 완료(빌드·테스트·브라우저 검증 green). 게임보드 제거, 가짜 지표 정직화, 온톨로지 그래프·AI 분석 신규.

## 1. 현재 git 상태

- 브랜치: **main** (별도 브랜치 안 씀 — 사용자 지시).
- 커밋(신규 2개, 위가 최신):
  - `a263db6` — AI 엔진 호출 정확화(b) + 카드드랍 재배치(c) + 그래프 다듬기·간격(d)
  - `98ab98e` — 컨트롤 타워 재편(4탭 IA·그래프·AI분석·정직지표)
  - `362a217` — (재편 이전 베이스, 카드 이미지 작업)
- **문서 커밋**: 이 문서(`08-handoff.md`)·`07-redesign.md` 갱신·`CLAUDE.md`(IA 갱신)은 별도 문서 커밋으로 main에 올림(작업 코드와 분리).
- **미커밋(사용자 WIP — 건드리지 말 것, 사용자 것)**:
  - `src/client/src/components/EquippedBar.tsx` — 하단 "현재 장착" 바를 `/loadout`에서만 표시(useLocation 가드).
  - `src/vault.mjs` — `status()`에서 미관리 항목의 livePath 탐지 개선(소스가 ~/.claude 하위면 그 경로를 라이브로).
  - ⚠️ `vault.mjs`는 서버가 boot 때 `import * as vault`로 1회 로드 → **변경 반영하려면 서버 재시작 필수**.
- **미커밋(무관 — 카드아트)**: `data/card-images.json`, `media/generated/card-*.png` 다수. 재편과 무관.

## 2. 빌드·실행·검증 (요약 — 상세는 메모리 `loadout-run-build`)

```bash
cd src/client && bun install                 # 의존성(bun, npm 아님)
node src/scan.mjs                             # data/index.json 생성(gitignore). 현재 205항목
cd src/client && ./node_modules/.bin/tsc -b && ./node_modules/.bin/vite build   # 직접 호출(rtk가 tsc 에러 숨김)
PORT=4970 node src/server.mjs                 # 리포 루트에서. server.mjs 수정 시 재시작 필수
# QA: gstack /browse (mcp__claude-in-chrome 금지). HashRouter → http://localhost:4970/#/<route>. ?cb=$RANDOM로 캐시버스트
```
- 검증 상태: `tsc -b` 0 · `vite build` ok · `npx vitest run` **40 pass / 0 fail** · scan 멱등 **205**(skill142/agent52/mcp4/memory7) · 활성 **28**(equipped/resident, link 0 — 셋이 같은 28에 겹침) · installed **193**(카탈로그 대부분).

## 3. 무엇이 만들어졌나 (4탭 IA)

라우트: `/dashboard` `/assets` `/graph` `/loadout` (+ `/forge` `/help`는 ⚙ 보조). `App.tsx` 라우팅, `Header.tsx` 탭.

| 페이지 | 파일 | 핵심 |
|---|---|---|
| **대시보드(관제탑)** | `components/Dashboard.tsx` | 정직 카운트, 정리후보(중복 그룹·거대자산), 사용현황(가짜"미사용" 금지), 헬스 |
| **자산** | `Card.tsx`/`CardGrid.tsx`/`DetailPanel.tsx`/`FilterRail.tsx` | 정직 지표 + **AI 분석**(DetailPanel) |
| **그래프** | `GraphView.tsx`/`GraphNode.tsx`/`lib/graph.ts` | React Flow 온톨로지(엣지·드래그·올가미·호버강조·더블클릭 포커스·엣지라벨) |
| **장착·보관** | `Inventory.tsx` | 활성/상주/보관/분기, 상주→"해제 → 보관함", 이름확인 안전삭제, 일괄 |

**삭제됨**: OpsRoom·TeamEvalPanel·TeamAbPanel·iconAtlas·FilterBar(+해당 테스트). 게임보드/Elo/역할슬롯/시너지보너스/하단 팀저장/알림벨/아바타/무반응 다크토글 전부 제거.

## 4. 핵심 아키텍처 사실 (재유도 금지 — 검증된 것)

- **데이터 흐름**: `scan.mjs` → `data/index.json`(베이스, equipped=false). **서버 `/api/index` 오버레이**가 `installed/equipped/claudeState/managed/oversized/divergent/uses` 병합. **raw 파일엔 활성 필드 0** — 항상 서버 통해 확인.
- **"활성"의 정의**: `equipped || claudeState==="resident" || claudeState==="link"` = 28개. **`installed`(193)는 카탈로그 대부분(소스가 ~/.claude 하위)이라 "활성" 아님** — 절대 anchor/상주로 쓰지 말 것(전 페이지 이 규칙 통일됨). 카탈로그-only 읽기전용은 "고정 (설치됨)".
- **Vault 백엔드 완성**(`src/vault.mjs`, `server.mjs` — 라우트는 전부 `/api/` 접두사): `/api/equip`, `/api/vault/activate`(on=false면 상주→vault MOVE 이미 배선), `/api/vault/status`, `/api/vault/import`·`/api/vault/cutover`(UI 일부만), `/api/item/delete`(이름확인 안전 휴지통), `/api/vault/resolve`(pull/push).
- **AI 엔진**(`server.mjs`): `runEngine`→`buildEngineInvocation`(claude=stdin, agy/gemini/grok=`-p <prompt>`인자, codex=`exec`). `resolveEngineOrder`+`aiJsonWithFallback`(엔진별 model만 적용, 폴백 누수 수정)+`parseJsonObject`. `/api/analyze {id,engine,model}` → `{purpose,quality,redundancy,recommendation:keep|drop,confidence,reasons}`(점수 비변경). 기본 claude/sonnet.
- **그래프 관계**(`lib/graph.ts`): `buildGraph` 엣지 = SAME_NAME(`item.group`) + SHARES_TRAIT(tags 교집합≥2, 노드당 상위6). `egoFilter`. `GraphView`: d3-force(once-per-identity, charge -750/link 150/collide 92/forceX·Y corral), 기본 스코프 ego+`equipOnly=true`, `EGO_CAP=80`.
- **디자인**: Tailwind v4 `@theme`(단일 라이트, dark: 무효), `<Icon>`(lucide), `RARITY_CONFIG`(types/index.ts), card-beam, 숫자 font-mono.

## 5. 지표 정직성 (사용자 핵심 관심 — 검증됨)

- **진짜**: freshness(skill/agent, git), cost/mana(토큰추정). 유지.
- **수정/제거됨**: MCP 가짜 상수바 숨김, `repoPopularity` 시드 삭제, broken usage보너스 제거, power→"규모", popularity→"repo 활동성", Lv/XP는 `uses>0`일 때만, rarity 상대값 명시, `installed`→"상주" 오라벨 통일, Team Power/Elo 제거.

## 6. AI 분석 엔진 실측 (b)

| 엔진 | 상태 |
|---|---|
| claude(sonnet 기본) | ✅ 동작 |
| **agy** (사용자 우선순위) | ✅ 동작 |
| codex (`codex exec`) | ✅ 동작 |
| gemini | ❌ 계정 제한(IneligibleTier — 구글이 agy로 이전 안내) → claude 폴백 |
| grok | ❌ SuperGrok Heavy 구독 필요(403) → claude 폴백 |

폴백 시 UI가 **실제 사용 엔진 정직 표시**(+ heuristic이면 "휴리스틱 폴백" 핀). 코드 버그 아님.

## 7. 남은 작업 / 열린 항목 (재시작 시 후보)

1. **사용자 WIP 커밋**: EquippedBar.tsx(/loadout 전용 바) + vault.mjs(status 개선). 커밋 + **서버 재시작**으로 vault.mjs 반영.
2. **d 코드 별도 Opus 리뷰**: 호버/포커스/엣지라벨 최종 구현은 fix 에이전트가 작성, 브라우저로만 검증함(코드 레벨 별도 검수 미실시). author≠reviewer 엄격 적용하려면 d 디프 검수 패스.
3. **포지(Forge) 페이지**: 미변경·보조. 정리/검증 대상 후보.
4. **휴면 서버 엔드포인트**: `/api/teams`·`/team/*`·`/drop`은 클라이언트 미사용(가역성 위해 보존). 완전 제거 가능.
5. **MCP rarity**: UI는 가짜바 숨겼으나 scan 내부 score는 여전히 상수 기반(퍼센타일 랭킹용). 원하면 실신호 기반으로.
6. **그래프 "전체" 스코프**(205노드): >150 경고 표시. ego 기본은 EGO_CAP 80으로 안전.
7. **환경 변동 주의**: 세션 중 `~/.claude`에서 gsd-* 에이전트가 제거되어 카탈로그 303→205. 숫자는 환경 따라 변함(버그 아님).
8. **번들 크기**: React Flow로 >500kB 청크 경고(에러 아님). 필요시 코드 스플리팅.

## 8. 절대 규칙 (이 리포)

- `scan.mjs` 멱등 유지(Date.now는 freshness만). rarity는 percentile 후처리.
- ID는 path-namespaced. 직접쓰기 OK: `~/.claude/**`, `.omc/**`, `.claude/**`, CLAUDE.md.
- 브라우징은 gstack `/browse`. `mcp__claude-in-chrome__*` 금지. 커밋은 요청 시에만, land-action self-approve 금지(별도 검수자).
