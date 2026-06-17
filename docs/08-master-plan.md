# 08 · 마스터 플랜 — 팀 시너지 + 하네스 엔지니어링 (2026-06-13)

> **최종 목표**: 내 skill / agent / mcp를 카드처럼 한눈에 파악하고, on/off로 쉽게 장착하고,
> "강력한 코딩팀" "문서팀" 같은 **팀 조합**을 게임처럼 구성·전환한다.
> 그 위에 하네스 엔지니어링(컨텍스트 비용, 메모리, 검증 루프)을 게임 메커닉으로 얹는다.

관련: [05-roadmap.md](05-roadmap.md)(기존 Phase 3 포메이션 · Phase 4 OMC export의 구체화) · [02-data-model.md](02-data-model.md)

---

## 1. 왜 이 방향인가 — 조사 결과 요약

### 하네스 엔지니어링 (OpenAI 2026-02 "Harness engineering", Anthropic context-engineering 시리즈)

- 핵심 명제: **병목은 모델이 아니라 환경 품질**. "잘 하네싱된 환경의 평범한 모델 > 엉망인 repo의 SOTA 모델".
- 원칙: ① 컨텍스트에 도달하는 정보는 최소 고신호 토큰으로 통제 ② 점진적 공개(skills가 그 메커니즘) ③ 검증 루프(back-pressure) ④ 기계가 읽는 아티팩트.
- **Loadout에 주는 의미**: "많이 장착할수록 좋다"가 아니라 **"장착 항목 수 = 컨텍스트 비용"**.
  → 이걸 게임 메커닉(덱 슬롯 제한 + 코스트 게이지)으로 표현하면, 발견·설치 중심의 기존
  마켓플레이스류(claudemarketplaces.com, mcpmarket 등)와 확실히 차별화된다. **절제를 게임화한 관리자**가 빈 자리다.

### Hermes (Nous Research의 오픈소스 에이전트 하네스, 2026-02)

빌려올 아이디어:
1. **등록과 노출의 분리** — 전부 레지스트리에 등록하되, toolset 레이어가 실행마다 노출을 결정.
   → Loadout의 `index.json`(카탈로그) vs `loadout.json`(장착)과 같은 철학. **"덱 = 노출 정책"**으로 개념 승격.
2. **스킬 자동 생성** — 어려운 문제를 풀면 해결 패턴을 스킬 문서로 추출 → "전투에서 카드 드랍" 메타포.
3. 계보 보존 압축 / 계층화 시스템 프롬프트(stable/context/volatile) — 메모리 카드화 시 참고.

### 게임 레퍼런스 — 결론: **TFT 특성 시스템(주) + 포켓몬 커버리지(보조)**

- **TFT/오토체스 특성 시너지**가 유일하게 검증된 "조합이 성능을 만든다" UI. 장착 규모(5~10개)도 TFT 보드와 일치.
  - 태그(예: `git`, `frontend`, `research`, `browser`)를 특성처럼 부여 → 임계치(2/4/6) 도달 시 시너지 발동.
  - 좌측 **특성 트래커 패널**: 태그별 `2/3` 카운터 상시 표시, 발동 시 브론즈→실버→골드 글로우.
- **포켓몬 커버리지 매트릭스**(보조): 역할 축 × 슬롯, 빈 역할 빨강 경고 — "이 팀엔 테스트 도구가 없다" 결핍 시각화.
- 하스스톤 30장 덱은 규모·시너지 비표시 때문에 부적합. Backpack Hero류 공간 배치도 매핑이 억지.
- **스킨은 기존 캡처의 BLACK-ORCHID 첩보 작전 테마 유지**: 5개 역할 슬롯(분석관/정찰관/구축관/감정관/집행관),
  "신호 링크 0/3" = TFT 특성 임계치의 작전 테마 번역. 메커닉은 TFT, 외피는 첩보물.

차용 UI 패턴 5가지: ① 특성 트래커 패널(TFT) ② 시너지 단계 글로우(TFT) ③ "1개만 더" 회색 표시 + 미장착 카드 시너지 뱃지(오토체스 상점) ④ 커버리지 매트릭스(포켓몬 팀빌더) ⑤ 이름 붙인 프리셋 파티 행 + 원클릭 전환(포켓몬/겐신).

---

## 2. Phase 플랜

### Phase 0 — 수선: 지금 깨진 것부터 (반나절)

React 클라이언트가 실제 서버 API와 어긋나 핵심 기능이 동작 불가. 전부 코드로 확인된 사실.

- [ ] `api.ts` ↔ `server.mjs` 계약 정렬 (클라이언트를 서버에 맞춤)
  - `unequip` → `POST /api/equip {id, equip:false}` (서버에 `/api/unequip` 없음)
  - `add-source`/`remove-source` → `/api/sources/add`·`/api/sources/remove`
  - `verify`: `{ids:[...]}` → `{id}` 단건 (서버 `server.mjs:436`)
  - `generate`: `{ids}` → `{prompt, imageEngine, itemId}` (서버 `server.mjs:463`)
  - `translate` 응답 타입: `{nameKo,descKo}` → `{ok, translations}` 형식으로 수정
- [ ] `vite.config.ts` 프록시 7777 → **4970** (서버 기본 포트)
- [ ] dev/빌드 흐름 정리: `npm run dev` = 서버 + vite dev 동시 실행, 배포는 `client:build` 후 dist 서빙
- [ ] `useForge.ts` 폴링 에러 처리 (네트워크 실패 시 침묵 중단 방지)
- [ ] `docs/Context-commend.md` 제거(이 레포와 무관) · CLAUDE.md를 React+Vite 구조로 갱신

### Phase 1 — 장착 시스템 완성: "현재 상태 파악 + on/off" (1~2일)

- [ ] **현재 장착 파악 강화**: `~/.claude/skills`·`agents`·`~/.claude.json` MCP를 스캔해
      카드에 `installed`/`equipped` 상태를 명확히 구분 표시 (인벤토리 = 진실의 단일 출처)
- [x] **MCP on/off 실화** (2026-06-13): `claude mcp add-json <name> '<json>' -s user` / `claude mcp remove` 셸아웃.
      execFile 인자 배열(인젝션 차단), 15초 타임아웃, CLI 부재 시 기록-만 폴백 + 응답 `note`.
      (`~/.claude.json` 직접 수정 금지 결정 유지, CLI가 공식 경로)
- [ ] 외부 스킬 보관 흐름 점검: `POST /api/clone` → `sources/` → 카드화 → 장착 (이미 있음, 동작 검증만)
- [ ] 장착/해제 토글을 카드 자체에서 1클릭으로 (현재 DetailPanel 진입 필요)

### Phase 2 — UI/UX 대개편 + 팀 & 시너지: 게임 코어 (1~2주)

**UI/UX 대개편** — 단순 기능 추가가 아니라 화면 전체를 게임 워크스페이스로 재설계:

- [ ] **정보 구조(IA) 재설계** — 상단 탭 5개로 고정:
      `덱`(카드 컬렉션·검색·필터) / `작전 준비`(팀 편성 — 메인 화면으로 승격) /
      `인벤토리`(현재 장착·설치 현황 = 진실의 단일 출처) / `포지`(디자인 생성) / `소스`(레포 관리)
      — 현재 헤더의 세로 글자 깨지는 버튼(작전자산/관제편성…) 제거
- [ ] **디자인 시스템 수립**: `loadout-theme-dark-final`(NASA 임무 덱, 기능적) 뼈대에
      `ref-purple-warroom`(워룸 아레나, 게임성)의 요소를 이식 —
      레이아웃: 좌 인벤토리(레어도 그룹) · 중앙 작전 보드(팀+시너지) · 우 상세/기어 랙.
      토큰: 다크 베이스 + 등급색(S골드/A퍼플/B틸…), 카드 프레임·글로우·게이지를 단일 컴포넌트로 통일
- [ ] **카드 컴포넌트 단일화**: 앞면(아트·등급·LV/게이지·태그 뱃지) / 뒷면(스탯·설명) 플립,
      모든 화면(덱/팀/인벤토리)에서 같은 카드 재사용 — 지금은 화면마다 제각각
- [ ] **팀 전투력 숫자** (워룸의 "Team Power 8,742"): 장착 카드 스코어 합산 + 시너지 보너스 — 조합 변화가 숫자로 즉시 피드백
- [ ] **연출**: 장착 파티클, 팩 오프닝(clone 시), 시너지 발동 글로우 (기존 로드맵 Phase 3 항목 흡수)
- [x] **Forge로 도그푸딩** (2026-06-13): 덱 화면 리디자인 시안 3종을 Forge 세션으로 생성·Elo 선정(우승: 분할 콘솔+인텔 패널).
      CLI 변형 생성은 중첩 헤드리스 환경에서 전멸(원인 기록) → 직접 시안 폴백으로 Elo 파이프라인 실검증.
      보고서 `docs/10-forge-dogfood.md`. 부산물: forge.mjs meta.json 동시 쓰기 손상 버그 발견 → 원자적 쓰기(tmp+rename)+세션 뮤텍스로 수정.

**팀 & 시너지 메커닉**:

**데이터 모델** (`02-data-model.md` 갱신 필요):
- [ ] `scan.mjs`: 아이템에 **특성 태그** 부여 — `kind`(skill/agent/mcp) + 도메인 태그
      (코딩/문서/리서치/브라우저/git/디자인/QA/메모리…). 콘텐츠 키워드 휴리스틱 + AI judge 보강. 멱등 유지.
- [ ] `data/teams.json`: `{ teams: { id: { name, slots: [itemId...], theme, at } } }`
- [ ] 시너지 규칙 선언적 정의: `src/synergy.json` — `{ tag, thresholds: [2,4,6], label, bonusText }`

**UI** (캡처 목업 = 디자인 스펙):
- [ ] **작전 준비(팀 편성) 화면**: 5+α 역할 슬롯(분석관/정찰관/구축관/감정관/집행관), 카드 드래그/클릭 배치
- [ ] **신호 링크 패널** = TFT 특성 트래커: 태그별 `n/임계치` 카운터, 발동 시 글로우 단계
- [ ] **커버리지 매트릭스**: 역할 축에 빈 곳 빨강 경고
- [ ] 미장착 카드 중 현재 팀과 시너지 나는 카드에 **추천 뱃지**
- [ ] **팀 프리셋**: "강력한 코딩팀" "문서팀" 저장 → **원클릭 전환** = 현재 장착 일괄 해제 + 팀 일괄 장착
      (스킬=정션, 에이전트=복사라 전환이 빠르고 안전 — 이미 검증된 메커니즘 재사용)

### Phase 3 — 하네스 엔지니어링 통합 (2주~, 점진)

- [x] **컨텍스트 코스트 = 마나** (2026-06-13): scan이 `cost` 필드 산출(콘텐츠 바이트/4, MCP는 베이스 800+α, 캡 20000)
      → 작전 준비·인벤토리에 마나 게이지(예산 24k tk), 80% 골드·100% 초과 시 "덱 비대화" 경고.
- [x] **사용량 = 경험치** (2026-06-13): `src/usage.mjs`가 `~/.claude/projects/*.jsonl`에서 skill/subagent 호출 집계
      → `data/usage.json` → `/api/index`가 `uses` 병합. LV = 1+√uses, 카드 XP 게이지·`n회` 표기.
      인벤토리에 「사용량 동기화」(POST /api/usage/refresh).
- [x] **팀 → OMC export** (2026-06-13, 1단계): 작전 준비 「OMC EXPORT」 — 편성+발동 시너지를 마크다운으로
      클립보드 복사. 실제 `/team` 파이프라인 설정 파일 변환은 후속.
- [x] **팀 → OMC export 2단계** (2026-06-13): `POST /api/team/export-omc` — 편성을 OMC canonical roleRouting
      (분석관→analyst, 정찰관→explore, 구축관/집행관→executor 병합, 감정관→code-reviewer + model 티어)
      `omc.jsonc` + `/team` 실행 명령 `team-command.md`로 변환, `data/exports/<teamId>/` 기록.
      UI는 마크다운 복사/설정 내보내기 2모드(탭 모달, 자동 저장 중복 방지). `~/.claude` 자동 수정은 하지 않음.
- [x] **카드 드랍**(Hermes 스킬 자동 생성) (2026-06-13): `src/drop.mjs` + `POST /api/drop` —
      `~/.claude/projects` 최근 세션에서 해결 패턴 발췌(전문 미전송, 캡 적용) → AI 엔진(verify 인프라 재사용,
      실패 시 휴리스틱 템플릿+note)으로 SKILL.md 생성 → `sources/_drops/<slug>/`(전용 스캔 루트, -2/-3 dedup)
      → 인-프로세스 rescan → 인벤토리 「카드 드랍」 버튼 + 풀스크린 획득 연출(플립/글로우, reduced-motion 대응).
- [x] **메모리 카드화** (2026-06-13): scan이 프로젝트 `.memory/` + auto-memory(`~/.claude/projects/*/memory/*.md`)를
      `kind:"memory"` 카드로 산출(`layer:"index"|"note"`, "기억" 특성 → 시너지 연동, ID `_memory/<scope>/<file>`).
      덱에 「메모리」 필터, 읽기 전용(장착 없음), 편성 피커 제외. 23장 카드화 확인.

### Phase 4 — 검증/평가 루프 (선택)

- [x] 팀 단위 AI judge (2026-06-13): `POST /api/team/verify` — 시나리오 기반 채점(total 0~100 +
      coverage/synergy/balance + 한국어 총평). 엔진 셸아웃은 verify와 공용 헬퍼(`aiJsonWithFallback`)로 통합,
      전부 실패 시 순수 JS 휴리스틱(역할 커버리지·링크 단계·마나 예산). teamId 지정 시 teams.json에 `eval` 영속.
      작전 준비 「팀 AI 평가」 패널(엔진 셀렉터+3게이지).
- [x] A/B (2026-06-13): `POST /api/team/ab` — 같은 시나리오로 두 팀 평가 → winner/Δ + **팀 Elo**(K=32, teams.json 영속).
      작전 준비 「A/B 대전」 패널(좌우 팀 카드+게이지+Elo 변동, 프리셋 행 누적 Elo 뱃지). Forge Elo 수식 차용.

### 추가 완료 (2026-06-13, 플랜 외)

- [x] **우승 시안 C UI 반영 3종**(docs/10 제안): ① 덱 탭 영속 인텔 디테일 패널(xl≥1280 우측 고정 마스터-디테일,
      미만은 기존 오버레이) ② 카드 상단 3px 레어도 컬러 스트립 + 우하단 코스트 보석(cardart 비주얼 일치)
      ③ 「연결 시너지 +N」 인라인(편성 기준 발동 임박 특성 골드 강조 — 오토체스 상점 패턴).

- [x] **HTML→Playwright 카드아트 파이프라인**: `src/cardart.mjs` — 카드 앞면 HTML 템플릿(BLACK-ORCHID 토큰,
      외부 요청 0) → Playwright 스크린샷(512×768@2x) → `media/generated/cards/` + `data/card-images.json` 병합.
      API 키/로그인 불필요·결정적(동일 입력=동일 PNG). playwright는 optionalDependency(서버 zero-dep 유지).
- [x] **forge.mjs 동시성 수정**: meta.json 동시 RMW 손상 → tmp+rename 원자적 쓰기 + 세션별 promise 뮤텍스.
      96변형×4동시 스트레스에서 lost update 0 확인.

---

## 3. 결정 사항 (06-decisions.md로 옮길 후보)

| 결정 | 근거 |
|---|---|
| 시너지 메커닉 = TFT 특성 임계치, 스킨 = BLACK-ORCHID 첩보 테마 | 검증된 조합 UI + 이미 만든 목업 자산 재사용 |
| 덱 코스트 = 컨텍스트 토큰 비용 | 하네스 엔지니어링 원칙의 게임화 — 제품 차별점 |
| MCP 토글은 `claude mcp` CLI 셸아웃 | `~/.claude.json` 직접 수정 금지 결정 유지하면서 on/off 실현 |
| API 계약은 서버 기준, 클라이언트가 맞춤 | 서버가 단순하고 이미 동작 검증됨 |
