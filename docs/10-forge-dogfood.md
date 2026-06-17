# 10 · Forge 도그푸딩 — 덱 화면 리디자인 시안 생성·선정

> 마스터 플랜 Phase 2 "Forge로 도그푸딩": 이 제품의 **Design Forge** 기능으로 이 제품의 화면 시안을
> 생성·비교·선정한다. 태스크 #8 산출물. (Playwright는 태스크 #7에서 설치한 것을 재사용)

## 주제(brief)

**Loadout 덱 화면(카드 컬렉션) 리디자인** — BLACK-ORCHID 첩보 작전 콘솔 테마,
TFT(전략적 팀 전투) 특성(trait) 트래커 감성. 한국어 UI. 카드 그리드 + 시너지/특성 트래커.

---

## 1차 시도: CLI 변형 생성 (전멸) — 원인 기록

- **세션 ID**: `mqbl7pf12lx6` (status: `error`)
- **매트릭스**: HTML 변형 4개 (CDP 이미지 변형은 계획대로 스킵)
- `availableClis()` = `["claude","codex","gemini","grok"]` — CLI는 모두 PATH에 존재.
- **결과**: 4개 변형 **전부 실패** (`엔진 출력에서 HTML을 추출하지 못함(타임아웃/형식)`)

| 변형 | 엔진 | 전략/스타일 | 소요 | 실패 원인(추정) |
|---|---|---|---|---|
| 1 | claude | detailed / frontend | **120,011ms** | runCli 120s 타임아웃 — 헤드리스 `claude -p`가 시간 내 완성 HTML 미출력(중첩 claude 프로세스 경합) |
| 2 | codex | detailed / taste | 98ms | 즉시 종료 — `-p` 헤드리스 모드 미지원/형식 불일치(HTML 아님) |
| 3 | gemini | reference / reference | 806ms | 빠른 실패 — stdout에 `<!DOCTYPE html>` 미포함(인증/형식) |
| 4 | claude | system / soft | **120,000ms** | 1번과 동일 타임아웃 |

> **부수 발견(리드에 보고 완료):** `concurrency:4`로 동시 생성 시 `forge.mjs`의
> `patchVariant()`가 공유 `meta.json`에 비원자적 read-modify-write를 하여 **파일 손상**(truncated JSON,
> 이후 `getStatus` null)이 발생. 워크어라운드로 본 도그푸딩은 `concurrency:1`(순차)로 진행 — `forge.mjs` 무수정.
> 권장 수정: 세션별 쓰기 직렬화 또는 tmp+rename 원자적 쓰기.

→ 태스크 #8의 명시된 폴백 발동: **직접 작성한 HTML 시안 3개로 Forge Elo 파이프라인 검증.**

---

## 폴백: 직접 작성 시안 3개 + 실제 Forge Elo 파이프라인

- **세션 ID**: `mqblg2nukghk` (status: `ready`, `fallback` 필드 기록)
- 시안 3개를 실제 `forge.mjs` 세션의 변형으로 등록(`createSession` + 변형 메타) → Playwright 1280×800
  스크린샷 → 시각 판정 → `recordMatch()`(실제 Elo, K=32)로 전 쌍 기록. **forge.mjs 무수정.**

### 변형 목록

| ID | 전략/스타일 | 레이아웃 컨셉 | 크기 | 스크린샷 |
|---|---|---|---|---|
| `fb1xjmwajk` | detailed / frontend | **A · 좌측 특성 레일** + 4열 카드 그리드 | 9,908B | `data/forge/sessions/mqblg2nukghk/shots/fb1xjmwajk.png` |
| `fb2xk3xwxr` | reference / taste | **B · 상단 시너지 HUD 바** + 5열 대형 그리드 | 8,869B | `data/forge/sessions/mqblg2nukghk/shots/fb2xk3xwxr.png` |
| `fb3xkkzjby` | system / reference | **C · 분할 콘솔** — 그리드 + 인텔 디테일 패널 | 9,136B | `data/forge/sessions/mqblg2nukghk/shots/fb3xkkzjby.png` |

### 쌍별 판정 (기준: 레이아웃 위계 · 테마 적합성 · 정보 밀도)

| 매치 | 승자 | 근거 |
|---|---|---|
| A vs B | **B** | B의 상단 시너지 HUD가 특성 *레벨*(3/4·2/3)을 한눈에 스캔 가능하게 표현 — TFT 트래커 적합성·밀도 우위 |
| A vs C | **C** | C의 그리드+인텔 패널 마스터-디테일 구조가 정보 위계·"작전 콘솔" 적합성에서 앞섬 |
| B vs C | **C** | C의 동시 그리드+디테일 위계와 실행 가능한 장착 CTA가 B의 밀도 우위를 근소하게 능가 |

### Elo 순위표 (3경기, 전 쌍 1회)

| 순위 | 변형 | Elo | 전적 | 컨셉 |
|---|---|---|---|---|
| 🥇 **1** | `fb3xkkzjby` | **1531** | 2승 0패 | **C · 분할 콘솔 — 그리드 + 인텔 디테일 패널** |
| 2 | `fb2xk3xwxr` | 1500 | 1승 1패 | B · 상단 시너지 HUD 바 + 대형 그리드 |
| 3 | `fb1xjmwajk` | 1469 | 0승 2패 | A · 좌측 특성 레일 + 카드 그리드 |

**우승 시안 스크린샷**: `data/forge/sessions/mqblg2nukghk/shots/fb3xkkzjby.png`

---

## 우승 시안(C)에서 실제 UI에 반영할 만한 요소 3가지

1. **영속 인텔 디테일 패널(우측 고정).** 현재 `DetailPanel.tsx`는 모달/오버레이지만, 우승 시안처럼
   그리드와 **동시에** 보이는 우측 사이드 패널로 두면 선택 카드의 전체 스탯(파워/인기/신선도/명확도/무게)·
   설명·연결 시너지·`~/.claude 장착` CTA를 컨텍스트 전환 없이 노출할 수 있다. 작전 콘솔 위계가 크게 강화됨.

2. **카드 상단 레어도 컬러 스트립 + 우하단 코스트 보석.** 카드 `::before` 3px 등급색 바(legendary 골드 /
   epic 퍼플 / rare 시안 …)와 우하단 코스트 보석을 도입하면, 그리드를 훑을 때 레어도·코스트를
   텍스트를 읽지 않고도 즉시 스캔 가능. `Card.tsx`의 `RARITY_CONFIG` 색을 그대로 활용.

3. **"연결된 시너지 +N" 인라인 표기.** 선택 카드가 어떤 특성(trait)에 +몇 기여하는지(예: `⚒ 빌드 +3`)를
   디테일 패널에 표시. 덱 탭과 작전 준비 탭(`lib/traits.ts` 시너지)을 시각적으로 연결해, 카드 한 장이
   팀 시너지에 주는 영향을 컬렉션 화면에서 미리 가늠하게 한다 — TFT 특성 트래커 감성의 핵심.

---

## 재현 방법 (산출물 스크립트, 모두 `data/forge/` 내)

```bash
# 1) CLI 변형 생성(현 환경에서는 전멸 — 원인 확인용)
node data/forge/dogfood-run.mjs            # concurrency=1 순차

# 2) 폴백: 직접 작성 시안 3개를 Forge 세션에 등록
node data/forge/dogfood-inject.mjs         # → FALLBACK_SESSION=<id>

# 3) Playwright 1280x800 스크린샷
node data/forge/dogfood-shots.mjs <sessionId>

# 4) 쌍별 판정 → Elo 기록 + 순위 출력
node data/forge/dogfood-judge.mjs <sessionId>
```

시안 원본: `data/forge/staging/variant-{a,b,c}.html` (자체완결 HTML, 외부 네트워크 0).
