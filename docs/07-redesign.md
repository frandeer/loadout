# 07 — 컨트롤 타워 재편 (Control Tower Redesign)

> 2026-06-20 착수. 목표: skill·agent·mcp·memory를 "손바닥 안에서" 보고·이해·해제·삭제하는 컨트롤 타워.
> 게임 메타포는 **시각 스킨**으로만 남기고, IA·기능을 관리 중심으로 전면 개편.
>
> **✅ 상태: 완료** (P1·P2·P3 + 후속 b/c/d). 커밋 `98ab98e`(재편) + `a263db6`(엔진/카드드랍/그래프).
> 현재 상태·남은 작업·재시작은 → **[`08-handoff.md`](08-handoff.md)** 부터 읽을 것. 아래는 결정·근거 기록.

## 확정 결정 (Decisions)

| ID | 결정 | 이유 | 비용 | 탈출구 |
|----|------|------|------|--------|
| D1 | **관리중심 4탭 IA**: 대시보드 / 자산 / 그래프 / 장착·보관. 포지·도움말 → ⚙ 보조 | "컨트롤 타워" 정체성 | OpsRoom 게임보드 라우트 제거 | 라우트 객체만 복원하면 부활 |
| D2 | **React Flow(@xyflow/react)** + d3-force 레이아웃 | 데이터→노드/엣지 + 드래그/줌/올가미 표준 | 신규 의존성 2개 | 커스텀 SVG로 교체 가능 |
| D3 | **적극 정리**: Elo·A/B·역할슬롯·시너지보너스·Team Power 제거 | 관리 가치 0의 게임픽션 | OpsRoom/Team* 컴포넌트 미사용화 | 서버 teams.* 엔드포인트는 보존(휴면) |
| D4 | **가짜 지표 근본 수정** (scan.mjs) — 아래 M1~M7 | 사용자 비판 검토 지시 | scan 출력 변경(멱등 유지 필수) | git revert |
| D5 | **AI 분석 신규**: `/api/analyze` + `claude -p sonnet` / `agy` | 사용자 핵심 요구 | server/api 추가 | advisory라 안전 |
| D6 | **상주→해제·보관 라벨/흐름 명시화** | 사용자 지적 (해제 MOVE는 이미 배선됨) | UI 라벨/섹션만 | — |
| D7 | **죽은 컨트롤 제거**: 알림벨·아바타·무반응 다크토글·중복 재스캔(3개)·FilterBar·iconAtlas | 혼란 유발 | 삭제 | — |
| D8 | **작성자≠검수자, 검수자 Opus**, 페이지마다 브라우저 검증 | 사용자 지시 | 워크플로 비용 | — |

## 지표 정직성 (M)

- **M1** popularity: git 활동성 기반은 유지하되 UI 라벨 "repo 활동성"으로. `config.json repoPopularity` 시드표 제거(git 레포엔 죽은 코드).
- **M2** usage→popularity 보너스 제거(`fm.nameKey` 항상 undefined = no-op). `uses`는 별도 정직 지표로만.
- **M3** MCP 가짜 상수 지표(popularity=60, clarity=75/40, freshness=0/70) → UI에서 stat 바 숨김. command/args/env/risks/cost만 표시. 랭킹용 score는 실신호(size/args/url)로.
- **M4** power → "규모/분량"으로 재라벨(파일 크기 프록시).
- **M5** Lv/XP/uses: `uses>0`일 때만 렌더. 0이면 `power/12` 위장 게이지 숨김.
- **M6** rarity: 퍼센타일 유지 + 툴팁 "이번 스캔 상위 N%"(상대값 명시).
- **M7** Team Power/Elo/synergy-bonus UI 제거.
- **보존**: freshness(skill/agent), cost/mana = 정직 → 유지.

## AI 분석 (A)

- `agy`를 정식 엔진으로 등록(현재 `agy→gemini` alias 제거; 바이너리 `~/.local/bin/agy` 존재).
- `MODEL_FLAG` 레지스트리 추가, `runEngine(engine, prompt, timeoutMs, model)`로 model 전달. `claude --model sonnet -p`(stdin). CLI별 플래그는 `--help`로 검증 후 배선.
- `POST /api/analyze {id, engine, model}` → `{purpose, quality, redundancy, recommendation: keep|drop, confidence, reasons}`. 점수 비변경(advisory). group 동명 peer를 redundancy 프롬프트에 주입. 기존 `/verify` 패턴 복제.
- DetailPanel에 engine+model 셀렉트 + 분석 버튼. 기본 claude/sonnet.

## 재사용 자산 (이미 존재)

- Vault 백엔드 완성: `/equip`, `/vault/activate`(해제 시 resident→vault MOVE 이미 배선), `/vault/status`, `/vault/import`(UI無), `/vault/cutover`(UI無), `/item/delete`(안전 휴지통, UI無), `/vault/resolve`.
- 관계 데이터: contentHash(동일사본)·nameKey/group(동명)·tags(특성)·category·repo/owner — 클라이언트 `lib/graph.ts`에서 엣지로 변환(scan 출력 불변).
- AI 엔진: `runEngine`/`resolveEngineOrder`/`aiJsonWithFallback`/`parseJsonObject`.
- 디자인: Tailwind v4 @theme 토큰(단일 라이트), `<Icon>`(lucide), `RARITY_CONFIG`, card-beam, font-mono 숫자.

## 실행 단계 (Phases)

- **P1 — 골격(Foundation)**: backend(M1~M5 scan 수정, /api/analyze, MODEL_FLAG, agy 엔진, usage 수정) ‖ client spine(types에 contentHash/nameKey/copies 추가, api.analyze/vaultImport/deleteItem, useStore, App 4탭 라우트, Header 4탭 nav, EquippedBar→읽기전용 상태바, 죽은 파일/컨트롤 제거, 플레이스홀더 페이지). → Opus 리뷰 → 빌드+브라우저 검증(4탭 이동).
- **P2 — 페이지(각 1워크플로: author Opus → 리뷰 Opus → 수정)**: 대시보드 → 자산(+AI분석/지표정직) → 그래프(React Flow) → 장착·보관(해제/vault/삭제/분기). 각 페이지 후 빌드+브라우저+스크린샷.
- **P3 — 마감**: OpsRoom 게임보드 완전 제거, 포지/도움말 보조 이동, 죽은 컨트롤 스윕, 최종 Opus 리뷰 + 브라우저 패스.

## 검증 기준 (완료 증거)

- 각 단계: `tsc -b` 0 에러 + `vite build` 성공 + `/browse` 스크린샷 + 콘솔 에러 0.
- scan 멱등: `node src/scan.mjs` 2회 실행 후 freshness 외 필드 diff 없음.
- 해제→vault, 삭제→휴지통 실제 동작 확인(dryRun 우선).
