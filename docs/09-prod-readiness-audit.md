# 09 · 프로덕션 준비도 전수조사 (2026-06-20)

> 방법: CCG(Codex gpt-5.5, 풀 파일접근) + ultracode 워크플로(8차원 × 결함별 적대적 검증, 60 에이전트) + `/browse` 화면 QA(4탭+포지+도움말, 데스크톱/모바일) 3-스트림 교차검증.
> 결과: **확정 47건 (P0 1 · P1 8 · P2 38), 기각 4건.** 두 독립 모델 스트림이 동일 P0에 수렴 + 라이브 `curl` 실측 일치.

---

## 0. 최종 판정 — **NO-GO (배포 차단)**

`/data/` 정적 라우트가 API 키가 담긴 `secrets.json`을 임의 HTTP 클라이언트에 평문 반환하고(`server.mjs:1699-1711`), 서버가 `0.0.0.0`에 무인증 바인딩(`server.mjs:1718`)되어 같은 네트워크의 누구나 키 탈취 + 피해자 `~/.claude` 원격 조작이 가능. **단일 P0 하나로 배포 차단.**

라이브 실측 (현재 실행 중인 :4970):
```
GET http://localhost:4970/data/secrets.json  →  200
{ "codexImageApiKey": "nxi_952d4247…e7174e56" }
```
→ **이 키는 이미 유출된 것으로 간주하고 즉시 폐기·재발급.**

품질 기반은 견고: tsc 0 에러 · vitest 40/40 · 4탭 콘솔 클린 · 삭제는 이름-타이핑 확인창+휴지통(복구 가능). 보안/배포 게이트만 통과하면 출시 가능 수준.

---

## 1. P0 블로커 (배포 전 반드시)

| # | 파일 | 문제 | 수정 |
|---|------|------|------|
| P0-1 | `server.mjs:1699-1711` | `/data/` 트리 통째 정적 서빙 → `secrets.json`(API 키)·`vault.json`·`index.json` 전부 공개. `startsWith(root)` 가드는 root 탈출만 막고 내부 민감파일은 못 막음 | `/data/` 통째 서빙 금지. SPA 필요 파일만 화이트리스트(`card-images.json` 등) 또는 secrets를 root 밖으로. `secrets.json`·자격증명 `*.json`은 명시적 403 |

---

## 2. P1 심각 (즉시) — 보안 4건은 P0와 한 PR로 묶어 처리

### 보안 (동일 공격 표면 — P0 증폭기)
- **P1-S1 `server.mjs:1718`** — `listen(port,…)` host 인자 없음 → `0.0.0.0` 바인딩. 모든 변이 엔드포인트(`/api/equip|item/delete|vault/cutover|activate|clone|generate|rescan`) 무인증. → `listen(port,'127.0.0.1',…)`, loopback 너머는 토큰 미들웨어.
- **P1-S2 `server.mjs:30`** — 모든 POST가 CSRF 가능. `body()`가 Content-Type 무시 JSON.parse, Origin/Referer/CSRF 검사 전무 → 악성 사이트가 `text/plain` 드라이브-바이로 `/api/item/delete`·`/api/clone` 호출. → POST에 Origin 허용목록 + 프리플라이트 강제 헤더.
- **P1-S3 `server.mjs:1411-1421`** — `/api/clone`가 `ssh://`/`git@…:` 형식 수락, raw `b.url`을 `git clone`에 전달 → 피해자 ssh 키로 강제 클론. → owner/repo만 파싱해 canonical https 재구성, raw/ssh/scp 거부.

### 견고성
- **P1-R1 `server.mjs:39,42,47,66,76`** — `loadout/teams/settings/translations.json`을 라이브 파일에 직접 `writeFile`(비원자적) → 크래시/디스크풀 시 반쪽 파일 → 다음 시작 `JSON.parse` throw. `loadout.json`은 equip 단일 진실원이라 = 전체 loadout 소실. (같은 코드의 `vault.mjs:1012`·`forge.mjs:20`은 이미 tmp→rename 사용.) → 공용 원자쓰기 헬퍼로 통일.

### 스캐너 (멱등성/카탈로그 무결성)
- **P1-SC1 `scan.mjs:20,177,534`** — 멀티값 `name:`(YAML 리스트) → `fm.name`이 배열 → `norm().toLowerCase()` TypeError. walk 콜백 try/catch 없어 SKILL.md 한 개가 전체 `index.json` 생성 중단. → frontmatter 스칼라 String 강제 + 핸들러 try/catch.

### 클라이언트 상태
- **P1-C1 `useStore.ts:105-119`** — `loadData` catch가 모든 fetch 에러 삼킴, `error` 상태 없음 → 백엔드 다운/500/index 누락이 "0 자산·정상 빈 설치"로 보임. 사용자가 하드 장애를 정상으로 오인. → `error` 상태 추가 + 재시도 배너.

### 접근성
- **P1-A1 `index.css`(전역)** — `:focus-visible` 링 없음 → 거의 모든 버튼에서 키보드 포커스 안 보임(WCAG 2.4.7 실패, 마우스 없이 사용 불가). → `:where(button,[role=button],a,input,[tabindex]):focus-visible{outline:2px solid var(--color-primary);outline-offset:2px}`.

### 빌드/배포
- **P1-B1 `src/client/package.json:13-18`** — `*-win32-x64-msvc` 3개가 일반 `dependencies` → macOS/Linux `npm install` EBADPLATFORM 실패(현재 `bun.lock`만 있어 bun이 묵인). 비-Windows 기여자/CI 빌드 불가. → `dependencies`에서 제거(부모가 플랫폼 자동해석) 또는 `optionalDependencies`로 이동.

---

## 3. P2 개선 (38건 요약 — 테마별)

**견고성/수명**: 동시 RMW 업데이트 유실(`server.mjs:889`), 손상 `index.json`이 영구 500(`:33`), `runScan` 무타임아웃 hang(`:610`), `uncaught/unhandledRejection`·graceful shutdown 부재(`:1715`), `requestTimeout` 미설정.
**보안(P2)**: Windows 엔진 셸아웃 `shell:true` 메타문자 탈출(`server.mjs:514`, `forge-engines.mjs:15`).
**스캐너**: `freshness`가 `Date.now()` 기반 → **멱등성 깨짐**(CLAUDE.md 불변식 위배), score/rarity 일마다 드리프트(`scan.mjs:330`); 심링크 dir 스킵 → equip된 스킬 false-negative(`:262`); `contentHash` 4000자 절단 → false-dedup 데이터 손실(`:533`); 소N percentile rarity 0/동점 인덱스 배정(`:899`); semver prerelease dedup 오처리(`:251`); `maxScanFiles`가 순회는 무제한(`:299`).
**클라이언트**: DetailPanel content/analyze stale-response 가드 없음(`:108,236`), 카드 전환 시 처리중 플래그 미리셋(`:95`), `reloadData` 실패 silent desync→더블 equip(`:201`), 빈 카탈로그 온보딩 없음(`Dashboard.tsx:140`), `SourceManager` 에러 삼킴(`:36`), `BatchBar` per-item reloadData N회 thrash(`:67`).
**API 컨트랙트**: `request()`가 비-2xx 시 서버 `{error}` 한국어 바디 버림 → 모든 에러 UX 근본원인(`api.ts:9`); `translate`가 200`{ok:false}` 무시(`:110`); forge/vault/delete 불투명 에러; `/api/verify` 클라 래퍼 부재(문서 드리프트).
**포지 회귀(미커밋)**: `vault.mjs:657-670` `liveState()` kind-게이트 누락 → `~/.claude/settings.json`의 MCP 서버가 resident로 오표시(MCP "recorded only" 불변식 위배). **working tree 미커밋 회귀 — 커밋 전 차단.**
**접근성/반응형**: Card/EquippedBar `div role=button`(Space 스크롤·중첩 인터랙티브), Modal focus-trap/`aria-modal` 없음·CardDrop Esc 없음, 미정의 `surface-hover` 토큰 hover no-op(`DetailPanel.tsx:818`), `text-muted-soft` #94A3B8 흰배경 WCAG AA 실패(~2.6:1), FilterRail/도킹 패널이 <1024px서 진입점 없이 숨음, 아이콘버튼 `aria-label` 없음, 로딩 스켈레톤 없음.
**빌드(P2)**: 루트 `client:build`가 `bun` 하드코딩(문서는 npm), **`dist`가 소스보다 ~11h 스테일**(수정 6개 .tsx 미반영 → 재빌드 필요), Vite 프록시 포트 4970 하드코딩(`PORT` override 무시), `config.json` Windows 전용 `profileDir` 하드코딩(외부 사용자명 유출), node floor(>=18.18) 실제(v20.19.1/Vite8) 불일치.

---

## 4. 화면 QA 추가 (`/browse` 실측)
- **포지만 다크 테마** — 나머지 전체 라이트인데 포지 화면만 검정 배경 → "단일 라이트 테마" 불변식 위반. 세션 1건 `오류` 상태인데 원인/재시도 안내 없음.
- **모바일(375px) 상단 네비 미접힘** — 탭 라벨 세로 클리핑("대/시/보/드"), 햄버거 메뉴 부재.
- **`장착·보관` 190개 평면 리스트** — 가상화/페이지네이션 없음. 컨텍스트 게이지 `382k/24k`가 상시 빨강(`MANA_BUDGET=24000`) → 190 상주 실환경선 항상 과적재라 신호가치 상실 + "뭘 내려야 하나" 액션 없음.

---

## 5. Top 5 Quick Wins (고임팩트/저노력) — 단일 PR 권고
1. `server.mjs:1718` → `listen(port,'127.0.0.1',…)` — 한 줄로 P1-S1 차단 + P0 노출반경 LAN→loopback.
2. `api.ts:9-16` → `const data=await res.json().catch(()=>null); if(!res.ok) throw new Error(data?.error||\`API ${path}: ${res.status}\`)` — 컨트랙트 P2 4건 동시 해소.
3. `index.css` 전역 `:focus-visible` 1블록 — P1-A1 해결.
4. `src/client/package.json` win32 바이너리 3개 제거 — P1-B1 해제(코드변경 0).
5. `scan.mjs` frontmatter 스칼라 강제 + walk try/catch — P1-SC1 + 향후 malformed 파일 fatal→skip.

> **랜딩 규칙(CLAUDE.md):** 보안 묶음은 self-approve 금지 — `code-reviewer`/`verifier` 별도 패스 필수.
