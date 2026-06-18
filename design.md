# LOADOUT Design System

## Overview

LOADOUT의 화이트 버전은 **게임형 자산 관리 시스템을 SaaS 대시보드처럼 쉽게 읽히게 만든 인터페이스**다. 어두운 사이버 게임 HUD가 아니라, 밝은 화이트 캔버스 위에서 `Skill · Agent · MCP · Memory`를 카드, 리스트, 슬롯, 그래프, 메모리 칩으로 정리한다.

핵심 목표는 “멋진 카드 수집 화면”이 아니라 **수천 개의 Claude Code 자산을 빠르게 찾고, 비교하고, 장착하고, 저장하는 것**이다. 그래서 이 시스템은 게임 메타포를 쓰되 과하게 장식하지 않는다. `S-Class`, `Lv.7`, `79pt`, `장착 가능`, `총 파워 412pt` 같은 게임적 신호를 사용하지만, 전체 구조는 업무용 SaaS처럼 명확하다.

디자인 방향은 **Light SaaS × Deck Builder × Asset Control Panel**이다.

* 좌측은 필터와 탐색.
* 중앙은 추천 카드, 최근 추가, 라이브러리, MCP 장비, 팀 로스터, 메모리 보관함.
* 우측은 선택한 자산의 상세 정보, 스탯, 의존성 그래프, 샘플 명령어, 메모리 노트.
* 하단은 현재 장착 중인 로드아웃 요약 바.

이 UI의 장점은 사용자가 `Skill`, `Agent`, `MCP`, `Memory`의 차이를 모르는 상태에서도 **“카드 고르기 → 장착하기 → 저장하기”** 흐름으로 이해할 수 있다는 점이다.

**Key Characteristics:**

* 화이트 캔버스 기반의 밝은 SaaS UI.
* 인디고 계열을 주 브랜드 컬러로 사용하고, 오렌지는 S-Class와 핵심 액션에만 사용한다.
* 게임 메타포는 카드, 등급, 레벨, 파워, 장착 슬롯으로 제한한다.
* 카드형 정보와 표형 정보가 함께 존재한다.
* 우측 상세 패널은 항상 선택된 자산의 맥락을 보여준다.
* Memory는 긴 문서가 아니라 **태그형 노트, 의존성 그래프, 요약 칩**으로 보여준다.
* 하단 로드아웃 바는 “현재 장착 상태”를 계속 노출한다.
* 장착/해제/비교/저장 행동은 항상 한 번에 찾을 수 있어야 한다.

---

## Colors

### Brand & Accent

* **Primary Indigo** (`{colors.primary}` — #4F46E5): 메인 브랜드 컬러. 상단 활성 탭, 주요 버튼, 링크, 선택 상태에 사용한다.
* **Primary Active** (`{colors.primary-active}` — #4338CA): primary 버튼의 active/pressed 상태.
* **Primary Soft** (`{colors.primary-soft}` — #EEF2FF): 선택된 탭, 부드러운 강조 배경, 정보 카드 배경.
* **Orange Accent** (`{colors.accent-orange}` — #F59E0B): S-Class, 추천 카드 강조, 파워/점수, 핵심 스탯 바에 사용한다.
* **Orange Soft** (`{colors.accent-orange-soft}` — #FFF7ED): S-Class 카드의 약한 배경, 추천 카드 hover/selected 배경.
* **Emerald Accent** (`{colors.accent-emerald}` — #10B981): 장착 중, 온라인, 성공 상태, 호환성 OK.
* **Violet Accent** (`{colors.accent-violet}` — #8B5CF6): A-Class, Skill 계열 보조 강조.
* **Blue Accent** (`{colors.accent-blue}` — #3B82F6): MCP, 의존성 그래프, 시스템 연결선.
* **Rose Accent** (`{colors.accent-rose}` — #F43F5E): 오류, 삭제, 충돌, 위험 상태.

### Rarity Colors

* **S-Class** (`{colors.rarity-s}` — #F59E0B): 최상위 추천 자산. 오렌지 배지와 얇은 테두리.
* **A-Class** (`{colors.rarity-a}` — #8B5CF6): 높은 품질의 자산. 보라색 배지.
* **B-Class** (`{colors.rarity-b}` — #3B82F6): 안정적인 일반 추천 자산. 파란색 배지.
* **C-Class** (`{colors.rarity-c}` — #64748B): 보통 또는 보류 자산. 슬레이트 배지.
* **Legendary** (`{colors.rarity-legendary}` — #F97316): 매우 희귀하거나 강력한 자산. MVP에서는 S-Class보다 더 강한 시각 효과를 남용하지 않는다.

### Surface

* **Canvas** (`{colors.canvas}` — #FFFFFF): 전체 페이지 기본 배경.
* **Surface App** (`{colors.surface-app}` — #F8FAFC): 앱 전체의 아주 연한 회색 바닥.
* **Surface Card** (`{colors.surface-card}` — #FFFFFF): 카드, 리스트, 상세 패널의 기본 표면.
* **Surface Soft** (`{colors.surface-soft}` — #F1F5F9): 필터 영역, 비활성 탭, 메모리 칩 배경.
* **Surface Warm** (`{colors.surface-warm}` — #FFFBEB): 추천 카드, S-Class 연한 강조.
* **Surface Success** (`{colors.surface-success}` — #ECFDF5): 장착 완료, 온라인 상태 배경.
* **Surface Violet** (`{colors.surface-violet}` — #F5F3FF): A-Class 또는 Skill 계열 부드러운 배경.
* **Surface Blue** (`{colors.surface-blue}` — #EFF6FF): MCP, 의존성 노드 배경.
* **Hairline** (`{colors.hairline}` — #E5E7EB): 카드, 패널, 입력창의 기본 1px border.
* **Hairline Strong** (`{colors.hairline-strong}` — #CBD5E1): 선택/포커스 직전 단계의 border.
* **Divider Soft** (`{colors.divider-soft}` — #F1F5F9): 섹션 내부 구분선.

### Text

* **Ink** (`{colors.ink}` — #0F172A): 제목, 주요 텍스트.
* **Body** (`{colors.body}` — #334155): 일반 본문.
* **Muted** (`{colors.muted}` — #64748B): 보조 설명, 카운트, 메타 정보.
* **Muted Soft** (`{colors.muted-soft}` — #94A3B8): 시간, 파일 경로, 비활성 텍스트.
* **On Primary** (`{colors.on-primary}` — #FFFFFF): Primary 버튼 위 텍스트.
* **On Accent** (`{colors.on-accent}` — #111827): 오렌지 계열 버튼 위 텍스트. 오렌지 버튼은 흰색보다 진한 잉크가 더 선명하다.

### Semantic

* **Success** (`{colors.success}` — #10B981): 장착됨, 온라인, 검증 성공.
* **Warning** (`{colors.warning}` — #F59E0B): 주의, 버전 확인 필요, 의존성 경고.
* **Error** (`{colors.error}` — #EF4444): 삭제, 충돌, 실행 실패.
* **Info** (`{colors.info}` — #3B82F6): 안내, 문서, MCP 연결.

---

## Typography

### Font Family

LOADOUT은 한국어와 영어가 섞이는 개발자 도구이므로 **Pretendard**를 기본 UI 폰트로 사용한다. 숫자, 점수, 버전, 명령어는 **JetBrains Mono** 또는 **IBM Plex Mono**를 사용한다.

* Display / UI: `Pretendard`
* Code / Version / Score: `JetBrains Mono`
* Fallback: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`

브랜드 로고 `LOADOUT`은 일반 UI 폰트보다 더 단단한 지오메트릭 산스를 사용한다. 실제 구현에서는 `Sora`, `Space Grotesk`, `Inter Tight` 중 하나를 사용할 수 있다.

### Hierarchy

| Token                         | Size | Weight | Line Height | Letter Spacing | Use            |
| ----------------------------- | ---: | -----: | ----------: | -------------: | -------------- |
| `{typography.display-lg}`     | 40px |    700 |        1.15 |         -0.8px | 랜딩/빈 상태 대형 메시지 |
| `{typography.display-md}`     | 32px |    700 |         1.2 |         -0.6px | 주요 페이지 제목      |
| `{typography.title-xl}`       | 24px |    700 |         1.3 |         -0.3px | 상세 패널 자산명      |
| `{typography.title-lg}`       | 20px |    700 |        1.35 |         -0.2px | 섹션 제목          |
| `{typography.title-md}`       | 17px |    600 |         1.4 |              0 | 카드 제목          |
| `{typography.title-sm}`       | 15px |    600 |         1.4 |              0 | 리스트 항목 제목      |
| `{typography.body-md}`        | 15px |    400 |        1.55 |              0 | 기본 본문          |
| `{typography.body-sm}`        | 14px |    400 |         1.5 |              0 | 카드 설명, 패널 설명   |
| `{typography.caption}`        | 12px |    500 |         1.4 |              0 | 배지, 상태, 메타 정보  |
| `{typography.caption-strong}` | 12px |    700 |         1.4 |              0 | 등급 배지, 점수 라벨   |
| `{typography.code}`           | 13px |    400 |        1.55 |              0 | 명령어, 경로, 버전    |
| `{typography.score}`          | 14px |    700 |         1.2 |         -0.2px | pt, Lv, 점수     |
| `{typography.button}`         | 14px |    700 |         1.0 |              0 | 버튼 라벨          |
| `{typography.nav-link}`       | 14px |    600 |         1.4 |              0 | 상단 탭, 주요 네비게이션 |

### Principles

* 한 화면에 정보가 많으므로, 제목은 굵게 하지만 크기를 과하게 키우지 않는다.
* 카드 제목은 15~17px 안에서 유지한다.
* 설명문은 최대 2줄로 자른다.
* 점수, 레벨, 버전은 mono 폰트로 고정폭 처리한다.
* 한글 UI는 Pretendard 기준으로 자간을 거의 주지 않는다.
* 영어 로고와 점수만 살짝 타이트하게 조정한다.

---

## Layout

### Spacing System

* **Base unit:** 4px.
* **Tokens:**
  `{spacing.xxs}` 4px · `{spacing.xs}` 8px · `{spacing.sm}` 12px · `{spacing.md}` 16px · `{spacing.lg}` 24px · `{spacing.xl}` 32px · `{spacing.xxl}` 48px.

### App Shell

LOADOUT은 일반 웹사이트가 아니라 **상시 사용하는 앱형 인터페이스**다. 따라서 marketing page처럼 큰 section spacing을 쓰지 않는다.

* Top nav height: 56px.
* Left filter rail width: 220px.
* Right inspector width: 360~420px.
* Main content max width: 유동형.
* Bottom loadout bar height: 76~96px.
* Card grid gap: 12~16px.
* Panel padding: 16~24px.

### Desktop Grid

권장 데스크톱 구조:

```txt
┌──────────────────────────────────────────────────────────────┐
│ top-nav                                                      │
├──────────────┬──────────────────────────────┬────────────────┤
│ filter-rail  │ main-dashboard                │ inspector      │
│              │ 추천 카드 / 최근 추가 / 목록 │ 상세 / 그래프  │
├──────────────┴──────────────────────────────┴────────────────┤
│ equipped-loadout-bar                                         │
└──────────────────────────────────────────────────────────────┘
```

### Main Dashboard Rhythm

중앙 영역은 다음 순서로 구성한다.

1. **추천 카드** — 바로 장착할 만한 자산.
2. **최근 추가** — 새로 들어온 자산.
3. **라이브러리 요약** — Skill, MCP, Agent를 빠르게 비교.
4. **메모리 보관함** — 프로젝트 규칙, 성능 노트, QA 패턴 등.
5. **하단 로드아웃 바** — 현재 장착 상태와 저장 버튼.

### Whitespace Philosophy

화이트 버전의 핵심은 “게임처럼 재미있지만, 업무 중에도 피곤하지 않은 화면”이다. 그래서 여백은 넉넉하지만 낭비하지 않는다.

* 카드 안쪽 padding은 16~20px.
* 패널 사이 간격은 16px.
* 세로 섹션 간격은 24~32px.
* 우측 상세 패널은 텍스트 밀도를 높여도 줄 간격을 충분히 준다.
* 메모리 노트는 문단이 아니라 칩과 짧은 요약으로 보여준다.

---

## Elevation & Depth

| Level           | Treatment                        | Use                          |
| --------------- | -------------------------------- | ---------------------------- |
| Flat            | 배경만 사용                           | 앱 바닥, 기본 섹션                  |
| Hairline        | 1px `{colors.hairline}` border   | 카드, 입력창, 필터 패널               |
| Soft Card       | white surface + subtle shadow    | 추천 카드, 최근 추가 카드              |
| Selected Card   | accent border + soft glow        | 선택된 카드, 추천 S-Class           |
| Floating Panel  | border + shadow + fixed position | 우측 inspector, 하단 loadout bar |
| Action Emphasis | filled primary/accent button     | 장착, 저장, 가져오기                 |

### Shadow Tokens

* `{shadow.xs}`: `0 1px 2px rgba(15, 23, 42, 0.04)`
* `{shadow.sm}`: `0 4px 12px rgba(15, 23, 42, 0.06)`
* `{shadow.md}`: `0 12px 28px rgba(15, 23, 42, 0.10)`
* `{shadow.focus}`: `0 0 0 4px rgba(79, 70, 229, 0.12)`
* `{shadow.rarity-s}`: `0 0 0 1px rgba(245, 158, 11, 0.55), 0 8px 24px rgba(245, 158, 11, 0.16)`

### Depth Principles

* 그림자는 매우 약하게 쓴다.
* S-Class 카드는 테두리와 약한 오렌지 배경으로 강조한다.
* 선택 상태는 색상, border, 우측 inspector 연동으로 표현한다.
* 과한 glow, 3D, 금속 질감은 화이트 버전에서는 쓰지 않는다.
* 카드 내부 artwork보다 정보 구조가 우선이다.

---

## Shapes

### Border Radius Scale

| Token            |        Value | Use                    |
| ---------------- | -----------: | ---------------------- |
| `{rounded.xs}`   |          4px | 작은 배지 내부               |
| `{rounded.sm}`   |          6px | 미니 칩, 코드 토큰            |
| `{rounded.md}`   |          8px | 버튼, 입력창, 탭             |
| `{rounded.lg}`   |         12px | 일반 카드, 리스트 패널          |
| `{rounded.xl}`   |         16px | 추천 카드, inspector 주요 박스 |
| `{rounded.xxl}`  |         20px | 하단 로드아웃 바, 큰 대시보드 패널   |
| `{rounded.pill}` |       9999px | 상태 배지, 태그, 필터 칩        |
| `{rounded.full}` | 9999px / 50% | 아바타, 원형 아이콘            |

### Shape Principles

* 화이트 SaaS 느낌을 유지하기 위해 기본 radius는 12px로 둔다.
* 카드 수집 감성은 radius보다 배지, 등급, 점수, 아이콘으로 만든다.
* 지나치게 둥근 24px+ 카드는 피한다.
* 하단 로드아웃 바와 큰 패널만 20px까지 허용한다.

---

## Components

### 1. App Shell

**`app-shell`**
전체 앱 컨테이너. `{colors.surface-app}` 배경을 사용한다. 상단 nav, 좌측 filter rail, 중앙 main, 우측 inspector, 하단 loadout bar로 구성된다.

**`top-nav`**
56px 높이의 상단 고정 바. 좌측에는 `LOADOUT` 로고, 중앙에는 search input과 주요 탭, 우측에는 `새로 추가`, `가져오기`, 알림, 설정, 사용자 메뉴가 있다.

**`global-search`**
자산명, 태그, 설명, 명령어를 검색한다. Placeholder는 `에셋, 스킬, MCP 검색...` 형식. 단축키 힌트 `⌘K` 또는 `Ctrl K`를 우측에 표시한다.

**`primary-tabs`**
`홈 · 스킬 · 에이전트 · MCP · 팀` 형태의 상단 탭. Active 상태는 `{colors.primary}` 하단 라인과 굵은 텍스트로 표시한다.

---

### 2. Filter Rail

**`filter-rail`**
좌측 고정 필터 패널. 유형, 등급, 출처, 설치 상태, 장착 상태, 태그를 보여준다. 배경은 `{colors.surface-card}`. 우측 border는 `{colors.hairline}`.

**`filter-section`**
`유형`, `등급`, `출처`처럼 그룹화된 필터 묶음. 섹션 제목은 `{typography.caption-strong}`. 그룹 사이에는 24px 간격.

**`filter-row`**
아이콘 + 라벨 + count 구조. Active 또는 checked 상태는 primary soft 배경과 primary 텍스트로 표현한다.

**`tag-chip-filter`**
작은 태그 필터. 예: `performance 18`, `browser 24`, `qa 16`. 기본 배경은 `{colors.surface-soft}`.

---

### 3. Asset Cards

**`recommend-card`**
상단 추천 카드. 4개 정도만 노출한다. 자산명, 타입, 짧은 설명, 평점/점수, 장착 가능 상태를 보여준다.
S-Class 추천 카드는 `{colors.accent-orange}` border를 사용한다.

**`asset-card-compact`**
최근 추가 카드. 작은 카드 형태로 `이름 · 타입 · 설명 · Lv · 점수`를 보여준다. 설명은 최대 2줄.

**`asset-list-card`**
스킬 라이브러리나 MCP 장비에 쓰이는 리스트형 카드. 많은 자산을 빠르게 훑기 위한 구조다.

**`rarity-badge`**
`S`, `A`, `B`, `C` 등급을 표시한다.

* S: orange
* A: violet
* B: blue
* C: slate

**`asset-type-badge`**
`SKILL`, `AGENT`, `MCP`, `MEMORY` 타입 표시. 타입과 등급은 분리한다. 등급은 품질, 타입은 역할이다.

**`equip-status-pill`**
`장착 중`, `장착 가능`, `미장착`, `충돌 있음` 상태를 표시한다.

---

### 4. Inspector Panel

**`inspector-panel`**
우측 고정 상세 패널. 사용자가 선택한 자산의 상세 정보가 항상 여기 표시된다. 폭은 360~420px.

구성:

1. Header: 등급 배지, 이름, 타입, 레벨, 즐겨찾기.
2. Action Segmented Control: `장착 · 해제 · 비교`.
3. Description: 2~4줄 설명.
4. Performance Stats: 스탯 바.
5. Source Metadata: 출처, 경로, 파일, 버전.
6. Dependency Graph.
7. Sample Commands.
8. Memory Notes.
9. Activity Log.

**`inspector-action-tabs`**
`장착 / 해제 / 비교`를 한 줄로 보여준다. 현재 가능한 액션을 primary로 강조한다.

**`stat-bar`**
성능 수치 표시. 라벨 + bar + 숫자 구조.
예: `신뢰도 97`, `정확도 89`, `영향도 91`.

**`dependency-graph-mini`**
선택 자산을 중심으로 MCP, Skill, Agent 연결을 보여주는 작은 그래프. 필수 의존성은 실선, 선택 의존성은 점선.

**`sample-command-box`**
명령어 예시를 보여준다. 배경은 `{colors.surface-soft}`. 폰트는 `{typography.code}`. 우측에 copy 버튼을 둔다.

---

### 5. Library Panels

**`library-summary-panel`**
`스킬 라이브러리`, `MCP 장비`, `팀 로스터`처럼 중앙 하단에 놓이는 요약 패널. 많은 정보를 표처럼 보여주되 카드 형태로 감싼다.

**`skill-library-list`**
스킬 목록. 이름, 레벨, 점수, 등급 배지를 한 줄로 표시한다.

**`mcp-gear-list`**
MCP 목록. 이름, 버전, 장착 상태를 표시한다. `장착 중`은 emerald dot으로 표시한다.

**`team-roster-list`**
Agent 목록. 아바타, 이름, 역할, 온라인 상태를 표시한다.

---

### 6. Memory System

**`memory-vault-panel`**
메모리를 주제별 칩 묶음으로 보여주는 패널. 메모리는 긴 본문이 아니라, 빠르게 확인 가능한 요약 정보여야 한다.

예시 그룹:

* `Performance`

  * `#benchmark-baseline`
  * `#web-vitals`
  * `#lighthouse-config`
  * `#bundle-size`
* `QA & Testing`

  * `#qa-checklist`
  * `#test-strategy`
  * `#bug-patterns`
* `Dev & Ops`

  * `#deploy-process`
  * `#infra-architecture`
  * `#monitoring`
* `Product`

  * `#prd-notes`
  * `#ux-principles`
  * `#roadmap`

**`memory-note-chip`**
짧은 메모리 토큰. 배경은 주제별 pastel surface를 사용한다. 클릭하면 우측 inspector에서 상세 메모리를 보여준다.

**`memory-note-card`**
상세 메모리 카드. 제목, 요약, 태그, 업데이트 시간, 연결된 자산을 포함한다.

**`memory-graph`**
선택한 자산과 연결된 Memory, MCP, Agent 관계를 보여준다. 복잡한 네트워크보다는 4~8개 노드만 보여주는 축약형 그래프가 기본이다.

---

### 7. Equipped Loadout Bar

**`equipped-loadout-bar`**
화면 하단에 고정되는 현재 로드아웃 요약 바. 사용자가 현재 무엇을 장착했는지 계속 알 수 있게 한다.

구성:

* 로드아웃 이름: `Performance Hunter`
* 장착 자산 칩: `benchmark`, `canary`, `qa-only`, `filesystem`, `chromium`
* 더보기 칩: `+3개 더`
* 총 파워: `총 파워 412pt`
* 주요 액션: `로드아웃 저장`
* overflow menu

**`equipped-item-chip`**
장착된 자산을 작은 칩으로 보여준다. 타입 아이콘, 이름, 타입 라벨을 포함한다.

**`loadout-power-score`**
로드아웃의 전체 점수. 숫자는 mono font를 사용한다.

---

### 8. Buttons

**`button-primary`**
주요 액션. `{colors.primary}` 배경, 흰색 텍스트. 예: `로드아웃 저장`, `가져오기`.

**`button-accent`**
장착, 추천 카드의 핵심 액션. `{colors.accent-orange}` 배경. 예: `장착`, `장착하기`.

**`button-secondary`**
흰색 배경 + hairline border. 예: `해제`, `비교`, `모두 보기`.

**`button-ghost`**
배경 없는 텍스트 버튼. 예: `초기화`, `메모리 보관함 전체 보기`.

**`icon-button`**
36px 정사각형 또는 원형 버튼. 알림, 설정, 즐겨찾기, 복사 등에 사용한다.

---

### 9. Inputs

**`text-input`**
검색, 필터 입력에 사용. 높이 40px, radius 10px, hairline border.

**`select-dropdown`**
정렬, 등급, 필터 옵션. 높이 40px. 선택값과 chevron을 표시한다.

**`checkbox-filter`**
좌측 필터용 체크박스. 선택 상태는 primary fill.

---

### 10. Badges & Tags

**`badge-rarity`**
등급 표시. 작고 명확해야 한다. 카드 왼쪽 상단 또는 제목 옆에 배치.

**`badge-type`**
`SKILL`, `MCP`, `AGENT`, `MEMORY` 표시. 회색 또는 타입별 soft color 사용.

**`badge-status`**
`장착 중`, `온라인`, `미장착`, `업데이트 가능`, `충돌 있음`.

**`tag-pill`**
검색과 분류에 쓰이는 태그. 작은 radius pill, 12px caption.

---

## Interaction Model

### Core Flow

```txt
검색 / 필터
→ 카드 선택
→ 우측 상세 확인
→ 의존성 / 메모리 확인
→ 장착
→ 하단 로드아웃 바 업데이트
→ 로드아웃 저장
```

### Equip / Unequip

* `장착` 버튼을 누르면 하단 로드아웃 바에 즉시 추가된다.
* 이미 장착된 자산은 `장착 중` pill과 `해제` 액션을 보여준다.
* 의존성 충돌이 있으면 장착 전 inspector에서 warning을 보여준다.
* MCP가 필요한 Skill은 의존성 그래프에서 필수 MCP를 함께 보여준다.

### Compare

* 카드 또는 inspector에서 `비교`를 누르면 비교 대상에 추가된다.
* 비교는 2~4개까지만 권장한다.
* 비교 정보는 점수, 신뢰도, 정확도, 범용성, 업데이트 상태, 의존성, 메모리 연결 수를 기준으로 한다.

### Memory

* Memory는 별도 메뉴로만 숨기지 않는다.
* 선택한 자산과 연결된 메모리를 inspector에 보여준다.
* 전체 메모리는 중앙의 `메모리 보관함`에서 주제별로 탐색한다.
* 메모리는 긴 글보다 `요약 + 태그 + 연결 자산` 중심으로 표현한다.

---

## Do's and Don'ts

### Do

* 게임 메타포는 `등급`, `레벨`, `점수`, `장착`, `로드아웃`에 집중한다.
* 화이트 캔버스를 유지하고, 색상은 상태 전달에만 쓴다.
* S-Class는 오렌지로 강조하되 과한 glow를 쓰지 않는다.
* 우측 inspector를 항상 유지해 선택 맥락을 잃지 않게 한다.
* 하단 로드아웃 바를 고정해 현재 장착 상태를 계속 보여준다.
* Memory는 태그형, 카드형, 그래프형으로 짧게 보여준다.
* 자산 설명은 최대 2줄로 제한한다.
* 점수, 레벨, 버전은 mono font로 정렬한다.
* `장착`, `저장`, `비교` 버튼은 항상 명확히 보이게 한다.

### Don't

* 게임 UI처럼 너무 어둡고 복잡하게 만들지 않는다.
* 카드 artwork가 텍스트보다 강해지면 안 된다.
* 모든 카드에 강한 색상과 그림자를 넣지 않는다.
* `Skill`, `Agent`, `MCP`, `Memory`를 같은 의미처럼 섞지 않는다.
* Memory를 긴 마크다운 문서처럼 노출하지 않는다.
* 우측 상세 패널에 원문 문서를 그대로 붙여 넣지 않는다.
* 필터가 너무 많아 첫 화면을 압도하지 않게 한다.
* primary indigo와 orange accent를 같은 우선순위로 남용하지 않는다.
* 카드 한 장에 5개 이상의 핵심 지표를 넣지 않는다.

---

## Responsive Behavior

### Breakpoints

| Name    |       Width | Key Changes                                                              |
| ------- | ----------: | ------------------------------------------------------------------------ |
| Mobile  |     < 768px | 좌측 필터는 sheet로 접힘. 우측 inspector는 bottom sheet. 카드 1열. 하단 로드아웃 바는 compact. |
| Tablet  |  768–1024px | 좌측 rail 유지 또는 접힘. inspector는 drawer. 카드 2열.                              |
| Desktop | 1024–1440px | 기본 3-panel layout. 카드 3~4열.                                              |
| Wide    |    > 1440px | 좌측 rail + 중앙 dashboard + 우측 inspector + 하단 bar 모두 표시. 카드 4열 이상 가능.       |

### Mobile Strategy

모바일에서는 모든 것을 한 화면에 넣지 않는다.

1. 홈: 추천 카드와 현재 로드아웃.
2. 검색: 필터 sheet.
3. 상세: bottom sheet inspector.
4. 장착: 하단 sticky action.
5. Memory: 별도 탭.

### Touch Targets

* Primary button: 최소 44px height.
* Icon button: 최소 36px, 모바일에서는 44px.
* Filter row: 최소 40px.
* Equipped chip: 최소 36px height.
* Card action 영역: 최소 40px.

---

## Accessibility

* 모든 등급 색상은 텍스트 라벨과 함께 사용한다. 색만으로 등급을 구분하지 않는다.
* `장착 중`, `미장착`, `충돌 있음`은 색상 + 텍스트 + 아이콘을 함께 사용한다.
* stat bar에는 숫자를 반드시 함께 표시한다.
* 키보드 탐색 순서: search → tabs → filters → cards → inspector actions → loadout bar.
* focus ring은 `{shadow.focus}`를 사용한다.
* 명령어 박스의 copy 버튼에는 `aria-label="명령어 복사"`를 제공한다.

---

## Content Rules

### Asset Name

* 영어 원문을 유지한다.
* 예: `benchmark`, `canary`, `setup-browser-cookies`.

### Type Label

* 항상 대문자 사용.
* `SKILL`, `AGENT`, `MCP`, `MEMORY`.

### Korean Description

* 한 줄 22~34자 권장.
* 카드에서는 최대 2줄.
* inspector에서는 3~4줄 가능.

### Score

* `79pt`, `Lv.7`, `v1.0.0`처럼 짧게 표기한다.
* `총 파워 412pt`는 하단 바에서 강조한다.

### Action Label

* `장착`
* `해제`
* `비교`
* `로드아웃 저장`
* `가져오기`
* `새로 추가`
* `모두 보기`
* `메모리 보관함 전체 보기`

---

## Implementation Tokens

```css
:root {
  --color-primary: #4F46E5;
  --color-primary-active: #4338CA;
  --color-primary-soft: #EEF2FF;

  --color-accent-orange: #F59E0B;
  --color-accent-orange-soft: #FFF7ED;
  --color-accent-emerald: #10B981;
  --color-accent-violet: #8B5CF6;
  --color-accent-blue: #3B82F6;
  --color-accent-rose: #F43F5E;

  --color-rarity-s: #F59E0B;
  --color-rarity-a: #8B5CF6;
  --color-rarity-b: #3B82F6;
  --color-rarity-c: #64748B;

  --color-canvas: #FFFFFF;
  --color-surface-app: #F8FAFC;
  --color-surface-card: #FFFFFF;
  --color-surface-soft: #F1F5F9;
  --color-surface-warm: #FFFBEB;
  --color-hairline: #E5E7EB;
  --color-hairline-strong: #CBD5E1;

  --color-ink: #0F172A;
  --color-body: #334155;
  --color-muted: #64748B;
  --color-muted-soft: #94A3B8;

  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-xxl: 20px;
  --radius-pill: 9999px;

  --shadow-xs: 0 1px 2px rgba(15, 23, 42, 0.04);
  --shadow-sm: 0 4px 12px rgba(15, 23, 42, 0.06);
  --shadow-md: 0 12px 28px rgba(15, 23, 42, 0.10);
  --shadow-focus: 0 0 0 4px rgba(79, 70, 229, 0.12);
}
```

---

## Page Blueprint

### Home Dashboard

```txt
top-nav
  logo
  global-search
  primary-tabs
  quick-actions

filter-rail
  type filters
  rarity filters
  source filters
  install status
  equipped status
  tags

main-dashboard
  recommended-cards
  recently-added
  skill-library-summary
  mcp-gear-summary
  team-roster-summary
  memory-vault

inspector-panel
  selected asset header
  action tabs
  description
  stats
  dependency graph
  sample commands
  memory notes
  activity log

equipped-loadout-bar
  current loadout name
  equipped chips
  total power
  save button
```

---

## Iteration Guide

1. 먼저 `app-shell`과 3-panel layout을 고정한다.
2. 다음으로 `recommend-card`와 `inspector-panel`을 만든다.
3. `장착` 액션이 하단 `equipped-loadout-bar`에 반영되는 흐름을 먼저 완성한다.
4. 그 다음 `Skill`, `Agent`, `MCP`, `Memory` 타입별 카드 변형을 만든다.
5. Memory는 초기에 긴 본문이 아니라 `memory-note-chip`과 `memory-vault-panel`로 시작한다.
6. 의존성 그래프는 처음부터 복잡하게 만들지 말고 5개 이하 노드로 제한한다.
7. 비교 기능은 MVP에서 2개 비교로 시작하고, 이후 4개까지 확장한다.
8. 색상 추가보다 정보 정리를 우선한다.
9. 모든 새 컴포넌트는 기존 token을 사용한다.
10. 게임 느낌이 과해지면 SaaS 쪽으로 되돌린다.

---

## Known Gaps

* 실제 화이트 시안은 이미지 생성 기반 컨셉이므로, 텍스트와 수치 일부는 구현 시 정리해야 한다.
* 카드 artwork는 최종 구현에서 아이콘 중심으로 단순화하는 것이 좋다.
* `총 파워`, `점수`, `등급` 산정 기준은 별도 데이터 모델 문서에서 정의해야 한다.
* Memory와 Skill의 연결 기준은 아직 UX 가정이다.
* Agent roster와 Team 개념은 MVP에서 축소될 수 있다.
* MCP 장비 슬롯은 실제 Claude Code 설정 구조와 맞춰 재검토가 필요하다.
* 모바일 UI는 별도 화면 설계가 필요하다.
* 접근성 색 대비는 실제 구현 후 WCAG 기준으로 검증해야 한다.
