# Loadout Orbital Launch Monitor Design System

> **Current priority direction:** 2026-06-05 이후 카드 디자인 충돌은 이 섹션이 최우선이다. 첨부 레퍼런스 이미지는 **전체 레이아웃 복제 기준이 아니라 카드/패널 표면 언어 기준**이다. Loadout의 앱 구조는 유지하되, 카드는 NASA mission-control처럼 밝은 blueprint, 체크리스트, 원격측정 카드로 보이게 한다. Palantir/국방부식 과도한 진지함과 어두운 군사 콘솔 톤은 줄인다.

## Orbital Launch Monitor

Loadout의 새 카드 언어는 “스킬/에이전트/MCP를 우주 임무의 체크리스트, 위성 감시 모듈, 원격측정 항목처럼 정리하는 운영 카드”다. 사용자는 자산을 고를 때 어두운 기밀 작전이 아니라, 배포 전 점검부터 배포 후 카나리/성능/문서 동기화까지 이어지는 엔지니어링 운영 흐름을 본다고 느껴야 한다.

### Reference Asset

- Primary visual reference: user-provided `gstack ▷ SHIP · MONITOR` dashboard image.
- Visual keywords: blueprint grid, launch arc, rocket, satellite, earth horizon, checklist rows, blue SHIP lane, green MONITOR lane.
- UI should feel precise, technical, optimistic, and operational. It should feel closer to NASA/JPL mission-control materials than defense-intelligence dashboards.

### Product Metaphor Override

| 실제 개념 | 새 메타포 | UI 표현 |
|---|---|---|
| Skill | 발사/운영 절차 | 체크리스트 행, 명령 모듈, SHIP 단계 |
| Agent | 관제 담당/운영자 | 로스터, 지상국 담당자, 임무 역할 |
| MCP | 궤도 지원 모듈 | MONITOR 장비, 원격 측정 모듈 |
| Loadout | 임무 패키지 | 발사 준비 묶음, 궤도 감시 세트 |
| Equip | 임무 배치 | 발사대/궤도 운영에 연결 |
| Verify | 상태 점검 | 체크리스트 검증, 신호 확인 |

### Color System

- **Paper Sky** `#F7FBFF`: 전체 캔버스.
- **Blueprint Grid** `#D9EAFB`: 배경 격자와 보조 구획선.
- **Launch Blue** `#2E73DF`: SHIP, 주요 액션, 선택 상태.
- **Orbit Green** `#22965A`: MONITOR, 정상/운영 상태.
- **Ink Navy** `#10243D`: 주요 텍스트.
- **Slate Line** `#A9BDD5`: 패널 경계.
- **Soft Panel** `#FFFFFF`: 카드/패널 표면.
- **Telemetry Mint** `#EAF8F1`: 모니터 행 배경.
- **Checklist Blue** `#EAF3FF`: 발사 행 배경.

### Layout Direction

1. **Top Breadcrumb Bar**: 작은 캡슐형 경로와 현재 모드 표시.
2. **Hero Mission Arc**: 왼쪽 발사대/SHIP, 중앙 점선 궤적, 오른쪽 위성/MONITOR를 연상시키는 상단 배너.
3. **Subtle Lane Language**: 주요 작업은 파란 SHIP, 초록 MONITOR 언어를 카드와 작은 섹션 헤더에만 절제해서 쓴다.
4. **Checklist Cards**: 카드는 어두운 금속 플레이트가 아니라 흰 표면, 얇은 파란 테두리, 코드형 이름 배지, 간결한 설명으로 구성한다.
5. **Blueprint Density**: 배경은 밝고 넓지만, 운영 대시보드답게 행/표/칩은 촘촘하고 정확해야 한다.

### Do / Don't

- Do: 카드 안에서 밝은 배경, 얇은 청사진 격자, 파란/초록 헤더, 체크리스트형 행, 위성/궤도/발사 은유.
- Do: 텍스트는 `Ink Navy` 기준으로 고대비를 유지하고, 모든 버튼/칩은 4~12px 반경의 실무 도구처럼 보이게 한다.
- Don't: 전체 앱 레이아웃을 레퍼런스 이미지처럼 바꾸기, 어두운 graphite 배경, amber 군사 글로우, 과한 홀로그램, 판타지 카드 문법, 실제 군 문장/국기/무기 이미지.

> **Current priority direction:** 이 문서에서 충돌이 생기면 아래의 **Black-Ops Anomaly Tactical Console** 섹션이 우선한다. 기존 판타지 카드 게임 문법은 참고 수준으로 낮추고, 앞으로의 UI는 “기밀 작전 자산을 운용하는 고급 전투 시뮬레이션 콘솔”을 기준으로 구현한다.

## Black-Ops Anomaly Tactical Console

Loadout은 더 이상 밝은 판타지 카드 게임이나 귀여운 RPG 인벤토리처럼 보이면 안 된다. 핵심 방향은 **미국 국방부식 고급 작전 콘솔 + 블랙옵스 전투 시뮬레이션 + 신비로운 이상 현상 분석 UI**다. 사용자는 카드를 클릭할 때 “단순 상세보기”가 아니라, **기밀 자산의 잠금이 해제되고 작전이 시작될 것 같은 긴장감**을 느껴야 한다.

이 스타일은 실제 정부 기관, 실제 군 로고, 실제 군사 문장, 국기, 무기 이미지, 군인 사진을 복제하지 않는다. 분위기만 차용한다. 결과물은 fictional classified operations console이어야 한다.

### Reference Asset

- Primary visual reference: `media/reference/black-ops-anomaly-console.png`
- Card design contract: `docs/07-card-design.md`
- 이 이미지는 향후 UI 개편, 카드 스타일, 패널 프레임, 선택 효과, 색상 대비의 기준 시안이다.
- 구현자는 새 화면이나 카드를 만들거나 수정하기 전에 반드시 이 이미지와 카드 디자인 문서를 보고 톤을 맞춘다.

### Core Mood

**키워드**
- Classified operations console
- Black-ops tactical simulation
- Anomaly signal analysis
- Premium defense command UI
- Covert asset management
- Radar, scanline, encrypted dossier
- Serious, tense, powerful, mysterious

**사용자가 느껴야 하는 감각**
- “이 카드는 스킬 카드가 아니라 기밀 작전 자산이다.”
- “클릭하면 숨겨진 분석 화면이 열리고 위험한 작전이 시작될 것 같다.”
- “UI는 장난감이 아니라 고급 전술 시스템이다.”
- “신비로운 이상 현상은 존재하지만 과장된 마법 이펙트는 아니다.”

### Product Metaphor Override

| 실제 개념 | 새 메타포 | UI 표현 |
|---|---|---|
| Skill | 기밀 작전 자산 / 프로토콜 | 자산 카드, 등급, 신호 강도, 접근 권한, 작전 효과 |
| Agent | 요원 / 오퍼레이터 | 좌측 요원 명단, 계열, 작전 가능 상태, 레벨 |
| MCP | 지원 모듈 / 장비 모듈 | 지원 모듈 슬롯, 연결 상태, 작전 보정치 |
| Loadout | 작전덱 / 임무 편성 | 하단 전술 편성 보드, 슬롯 번호, 지원 모듈 |
| Stats | 작전 지표 / 신호 지표 | 안정도, 파워, 명확도, 신선도, 무게, 이상 지수 |
| Equip | 작전 투입 / 장착 | 선택 자산을 작전덱에 투입하는 CTA |
| Verify | 신호 감정 / 상세 분석 | AI 엔진 기반 자산 채점, 등급 재판정 |

### Layout Direction

화면 구성은 다음 작전 콘솔 구조를 따른다.

1. **Top Command Bar**
   - 브랜드, 작전 자산 / 전술 편성 / 장비 창고 / 내 작전덱 탭.
   - 작전 준비 상태, 레이더 또는 신호 상태, 검색, 자원 카운터.
   - 장식은 얇고 절제된 금속 프레임과 상태등 위주.

2. **Left Operator Roster**
   - “영웅”보다 “요원 명단”이라는 표현을 우선한다.
   - 각 요원은 계열, 레벨, 작전 가능 / 휴식 중 상태를 표시한다.
   - 둥근 판타지 초상 대신 기밀 요원 배지, 삼각/방패형 추상 마크, 작은 상태등을 사용한다.

3. **Center Classified Asset Grid**
   - 카드는 “기밀 자산” 또는 “작전 자산”이다.
   - 카드 아트는 마법 일러스트가 아니라 레이더, 파형, 이상 신호, 기하학 분석도, 암호화된 프로토콜 이미지처럼 보인다.
   - 선택된 카드는 amber 림라이트, 얇은 스캔 빔, 연결선으로 우측 상세 패널과 이어진다.

4. **Right Intelligence Dossier**
   - “카드 상세”보다 “선택 자산 정보”가 우선한다.
   - 선택 자산의 등급, LV, 작전 안정도, 이상 지수, 핵심 효과, 요구 조건, 접근 권한을 보여준다.
   - 버튼은 “작전 투입”, “신호 감정”, “상세 분석”처럼 중요하고 위험해 보이는 문구를 사용한다.

5. **Bottom Tactical Loadout Board**
   - 장착된 카드/모듈을 작전덱 슬롯으로 보여준다.
   - 번호 슬롯, 레벨, 등급, 지원 모듈, 잠긴 슬롯, 작전 준비 완료 상태를 표시한다.

### Card Style: Classified Asset Card

카드는 앞으로 아래 구조를 기준으로 만든다.

**Card Anatomy**
- Top-left: 등급 라벨 (`S-CLASS`, `A-CLASS`, `B-CLASS`) 또는 작전 비용.
- Top-right: 작은 인증/즐겨찾기/잠금 아이콘 자리.
- Art Area: 레이더, 파형, 이상 신호, 기하학 도형, 암호화된 지도, 홀로그램 분석 이미지.
- Title Band: 자산명. 강한 흰색/아이보리, 짧고 굵게.
- Metadata Strip: `LV.7`, `32/50`, `신호 안정`, `프로토콜`, `모듈`.
- Selection State: amber 외곽 프레임 + 얇은 스캔라인 + 우측 패널로 이어지는 light trace.

**Card Do**
- 카드 외곽은 4~8px radius 이하의 단단한 군사 장비 느낌.
- 프레임은 graphite metal + amber highlight.
- 배경에는 미세 grid, scanline, coordinate tick, noise texture를 사용한다.
- 호버 시 `translateY(-2px)` 정도의 아주 짧은 상승과 스캔라인 이동만 허용한다.
- 선택 시 “잠금 해제 / 신호 증폭” 느낌의 controlled pulse를 준다.

**Card Don't**
- 회전하는 홀로그램 전체 레이어 금지.
- 보석, 룬, 마법진, 판타지 주문 카드 느낌 금지.
- 과한 보라색 글로우, 장난감 같은 둥근 카드, 귀여운 아이콘 금지.
- 라벨이 카드 밖으로 잘리는 음수 위치 배치 금지.

### Motion Direction

움직임은 “대단한 일이 벌어질 것 같은” 긴장감을 만들되, 과하면 안 된다.

- Hover: 얇은 scanline이 카드 위를 한 번 지나간다.
- Select: amber rim이 켜지고 1회 controlled pulse.
- Equip / Operation Launch: 버튼 내부 amber glow가 좌우로 흐른다.
- Detail Panel Open: dossier가 잠금 해제되는 듯한 fade/slide.
- Background: 아주 약한 radar sweep 또는 grid shimmer만 사용한다.

금지:
- 계속 회전하는 큰 장식 레이어.
- 카드 전체가 흔들리거나 과하게 튀는 애니메이션.
- 모든 카드가 동시에 강하게 빛나는 효과.

### Color System Override

주요 색상은 아래 톤을 우선한다.

- **Command Black** `#05080A`: 전체 캔버스.
- **Graphite Panel** `#101514`: 기본 패널.
- **Armor Plate** `#18201D`: raised panel/card.
- **Military Olive** `#283326`: 보조 표면, 작전 슬롯.
- **Classified Amber** `#D49A2A`: 선택 상태, 주요 CTA, S-Class, 경고성 강조.
- **Radar Cyan** `#38D6C6`: 레이더, 신호선, 정보 분석.
- **Signal Green** `#39D98A`: 작전 가능, 연결 성공, 준비 완료.
- **Anomaly Violet** `#8D5CFF`: 이상 현상, 신호 감정, 제한적 accent.
- **Danger Red** `#D45A3C`: 접근 불가, 오류, 위험.
- **Text Primary** `#E8E1CF`: 주요 텍스트.
- **Text Muted** `#8B938B`: 보조 정보.

### Copy Tone

기능명은 게임 판타지보다 작전 콘솔 문구를 우선한다.

- `카드 도감` → `작전 자산`
- `파티 편성` → `전술 편성`
- `장비 창고` → `지원 모듈`
- `내 덱` → `내 작전덱`
- `영웅 명단` → `요원 명단`
- `스킬 카드 컬렉션` → `기밀 자산`
- `카드 상세` → `선택 자산 정보`
- `장착하기` → `작전 투입`
- `능력 감정` → `신호 감정`
- `우세 비교` → `상세 분석` 또는 `우세 분석`
- `전투력` → `작전력`
- `명성` → `신뢰도`

---

# Legacy Agent Workspace Game UI Design System

## Overview

Agent Workspace는 AI 작업공간을 **수집형 카드 게임 + 전략 RPG 로드아웃 + 팀 포메이션 대시보드**로 해석한 웹 애플리케이션이다. 사용자는 Skill을 카드처럼 수집하고, MCP를 장비처럼 장착하며, Agent를 유닛처럼 배치해 하나의 작업 덱과 팀을 구성한다.

전체 화면은 하스스톤류 카드 게임의 감각을 참고하되, 특정 게임의 UI를 복제하지 않고 **오리지널 판타지-테크 워크스페이스**로 구성한다. 핵심은 “업무 설정”을 딱딱한 관리자 화면이 아니라, “전투 준비 / 덱 빌딩 / 파티 편성”처럼 느끼게 만드는 것이다.

화면의 기본 정서는 **어두운 옵시디언 배경**, **청색·보라색 마법광**, **금속성 골드 프레임**, **카드 슬롯**, **장착 장비**, **능력치 비교 막대**로 이루어진다. SaaS 대시보드의 정보 구조는 유지하지만, 시각 언어는 게임 UI처럼 몰입감 있게 만든다.

**Key Characteristics:**
- Skill은 `카드`, Agent는 `유닛`, MCP는 `장비`, Loadout은 `덱/인벤토리`, 능력치는 `스탯`으로 치환한다.
- 좌측은 Skill Library, 중앙은 Team Formation, 우측은 Selected Skill Detail, 하단은 MCP Equipment / Loadout으로 구성한다.
- 핵심 인터랙션은 `드래그 장착`, `카드 뒤집기`, `스탯 비교`, `시너지 활성화`, `덱 저장`이다.
- 카드와 패널은 어두운 판타지 금속 프레임을 사용하고, 중요한 상태는 보석·룬·글로우로 표현한다.
- 업무 기능을 게임 메타포로 감싸되, 텍스트·수치·상태는 실제 제품처럼 명확하게 읽혀야 한다.
- 전체 화면은 16:10 또는 16:9 와이드 대시보드에 최적화한다.

---

## Product Metaphor

| 실제 개념 | 게임 개념 | UI 표현 |
|---|---|---|
| Skill | 스킬 / 주문 / 아이템 카드 | 이름, 일러스트, 비용, 설명, 쿨다운, 등급, 스탯 표시 |
| Agent | 팀원 / 유닛 / 영웅 | 포지션에 배치되는 캐릭터 카드, 역할, 레벨, 시너지 아이콘 |
| MCP | 무기 / 장비 / 장신구 | 장비 슬롯에 장착, 능력치 부스트와 호환성 표시 |
| 장착한 것 | 인벤토리 / 로드아웃 / 덱 | 현재 사용할 수 있는 Skill + MCP + Agent 구성 |
| 능력치 | 스탯 / 전투력 / 등급 | Team Power, Efficiency, Speed, Reliability, Scalability |
| 워크플로우 | 미션 / 퀘스트 / 자동화 전투 | Active Deck, Mission Queue, Save Deck, Execute Workflow |
| 프롬프트 / 설정 | 룬 / 특성 / 시너지 | 조합에 따라 보너스 발동 |
| 비교 / 평가 | 스탯 막대 대결 | Your Build vs Avg. Top Decks |

---

## Visual Direction

### Core Mood

Agent Workspace는 “AI 업무 오케스트레이션을 위한 전술 카드 테이블”처럼 보여야 한다. 일반 SaaS처럼 깨끗하기만 하면 안 되고, 사용자가 “내 팀을 편성한다”, “스킬을 장착한다”, “장비로 능력치를 올린다”는 감각을 받아야 한다.

**시각 키워드**
- Dark fantasy dashboard
- Arcane technology
- Collectible card interface
- Tactical formation board
- Equipment loadout
- Premium game UI
- Strategy command table
- SaaS readability

### Signature Gesture

이 시스템의 대표 제스처는 **카드 + 슬롯 + 연결선**이다.

- 카드: Skill, Agent, MCP 모두 카드형 오브젝트로 표현한다.
- 슬롯: 장착 가능한 위치는 명확한 프레임과 빈 슬롯으로 표시한다.
- 연결선: Agent 간 협업, Skill 시너지, MCP 호환성은 빛나는 라인과 룬 아이콘으로 표시한다.
- 글로우: 활성화된 조합, 선택된 카드, 전설 등급, 저장 가능한 상태에만 제한적으로 사용한다.

---

## Colors

> 색상은 어두운 표면을 기본으로 하고, 골드 프레임과 보석색 액센트로 계층을 만든다.

### Brand & Accent

- **Arcane Blue** (`{colors.primary}` — `#2F8CFF`): 주요 액션, 선택 상태, 마법 에너지, 링크 라인.
- **Void Purple** (`{colors.secondary}` — `#8F4DFF`): 희귀/마법 계열, 활성 탭, 카드 글로우.
- **Aurelian Gold** (`{colors.gold}` — `#D6A84F`): 전설 등급, 프레임, 주요 타이틀, 저장 버튼.
- **Emerald Sync** (`{colors.emerald}` — `#31C878`): 성공, 시너지 활성화, 상승 스탯.
- **Ember Red** (`{colors.ember}` — `#E05243`): 공격 계열, 경고, 파괴형 스킬.
- **Crystal Cyan** (`{colors.cyan}` — `#42D8FF`): 데이터, 분석, 정찰, 정보 계열.

### Surface

- **Obsidian Canvas** (`{colors.canvas}` — `#070B10`): 전체 앱 배경.
- **Panel Deep** (`{colors.panel}` — `#101722`): 기본 패널 배경.
- **Panel Raised** (`{colors.panel-raised}` — `#162131`): 카드 라이브러리, 장비 패널, 상세 정보 패널.
- **Board Green** (`{colors.board}` — `#12321F`): Team Formation 전술 보드 배경.
- **Card Black** (`{colors.card}` — `#121212`): 카드 내부 베이스.
- **Card Parchment** (`{colors.card-paper}` — `#E9D9B2`): 카드 설명문 영역 또는 밝은 카드 텍스트 박스.
- **Slot Empty** (`{colors.slot-empty}` — `#0B111A`): 비어 있는 장비/유닛 슬롯.
- **Border Dark Gold** (`{colors.border-gold}` — `#6F5529`): 패널 경계선.
- **Hairline** (`{colors.hairline}` — `#243044`): 일반 구분선.

### Text

- **Text Primary** (`{colors.text-primary}` — `#F4EBD2`): 주요 제목, 카드 이름, 상단 네비게이션.
- **Text Secondary** (`{colors.text-secondary}` — `#B8A982`): 보조 설명, 라벨, 탭.
- **Text Muted** (`{colors.text-muted}` — `#7E8796`): 비활성 정보, 하단 힌트, 미세 설명.
- **Text On Glow** (`{colors.text-on-glow}` — `#FFFFFF`): 글로우 버튼과 배지 위 텍스트.
- **Text Dark** (`{colors.text-dark}` — `#18120A`): 밝은 카드 설명 영역 위 텍스트.

### Rarity

- **Common** (`{colors.rarity-common}` — `#A8A8A8`)
- **Rare** (`{colors.rarity-rare}` — `#2F8CFF`)
- **Epic** (`{colors.rarity-epic}` — `#8F4DFF`)
- **Legendary** (`{colors.rarity-legendary}` — `#D6A84F`)
- **Mythic** (`{colors.rarity-mythic}` — `#FF7A2F`)

### Semantic

- **Success** (`{colors.success}` — `#31C878`): 시너지 보너스, 스탯 상승, 정상 상태.
- **Warning** (`{colors.warning}` — `#F0B84A`): 비용 부족, 조건 미충족.
- **Danger** (`{colors.danger}` — `#E05243`): 실패, 충돌, 위험 상태.
- **Info** (`{colors.info}` — `#42D8FF`): 데이터, 도움말, 분석 정보.

---

## Typography

### Font Family

기본 폰트는 **Inter / Pretendard / Manrope** 계열을 사용한다. 한글 서비스라면 Pretendard를 우선 사용한다. 다만 화면의 게임성을 위해 타이틀과 카드명에는 약간 판타지 느낌이 있는 세리프 또는 웨지 세리프 계열을 제한적으로 사용할 수 있다.

**권장 조합**
- UI 본문: `Pretendard`, `Inter`, `system-ui`
- 영문 판타지 타이틀: `Cinzel`, `Cormorant Garamond`, `Trajan-like fallback`
- 숫자/스탯: `Inter`, `Roboto Mono`, `JetBrains Mono`

### Hierarchy

| Token | Size | Weight | Line Height | Use |
|---|---:|---:|---:|---|
| `{typography.display-xl}` | 40px | 700 | 1.05 | 메인 화면 타이틀, 랜딩 히어로 |
| `{typography.display-lg}` | 32px | 700 | 1.1 | 패널 대제목, 선택 카드 제목 |
| `{typography.display-md}` | 24px | 700 | 1.15 | 카드 이름, Agent 이름 |
| `{typography.display-sm}` | 20px | 600 | 1.2 | 섹션 제목, 탭 제목 |
| `{typography.body-lg}` | 18px | 500 | 1.4 | 주요 설명, 선택 카드 설명 |
| `{typography.body-md}` | 16px | 400 | 1.45 | 기본 본문 |
| `{typography.body-sm}` | 14px | 400 | 1.45 | 카드 설명, 장비 설명 |
| `{typography.caption-md}` | 12px | 500 | 1.35 | 라벨, 스탯명, 쿨다운 |
| `{typography.caption-sm}` | 11px | 500 | 1.3 | 카드 하단 메타, 희귀도, 힌트 |
| `{typography.stat-lg}` | 28px | 700 | 1.0 | Team Power, 주요 수치 |
| `{typography.stat-md}` | 18px | 700 | 1.0 | 카드 비용, 장비 보너스 |
| `{typography.button-md}` | 14px | 700 | 1.0 | 주요 버튼 |
| `{typography.button-sm}` | 12px | 700 | 1.0 | 작은 액션 버튼 |

### Principles

- 카드 이름과 Agent 이름은 시각적 개성을 위해 약간 장식적인 세리프를 허용한다.
- UI 설명과 상태값은 반드시 산세리프로 유지한다.
- 숫자와 스탯은 가독성을 위해 고정폭 느낌의 폰트를 사용할 수 있다.
- 모든 텍스트는 어두운 배경에서 충분한 대비를 가져야 한다.
- 카드 안의 설명은 2줄 이하를 기본으로 한다.
- 상세 패널에서만 긴 설명을 허용한다.

---

## Layout

### App Shell

전체 화면은 5개 영역으로 나눈다.

1. **Top Navigation**
   - 브랜드, 메뉴, 자원, 사용자 프로필.
2. **Left Skill Library**
   - Skill 카드 검색, 필터, 카드 목록.
3. **Center Team Formation**
   - Agent 배치, 포지션, 시너지, Save Deck.
4. **Right Detail Inspector**
   - 선택된 Skill/Agent/MCP 상세 정보.
5. **Bottom Loadout Bar**
   - MCP 장비, 장착 슬롯, 로드아웃 보너스.

### Desktop Grid

| 영역 | 권장 너비 | 역할 |
|---|---:|---|
| Left Rail | 64px | 주요 앱 아이콘 |
| Skill Library | 320–360px | 카드 컬렉션 |
| Center Board | flexible | 팀 포메이션 |
| Inspector | 360–420px | 선택 항목 상세 |
| Bottom Bar | 180–220px height | MCP / Loadout |

### Screen Ratio

- 기본: 16:10
- 발표용: 16:9
- 최소 데스크톱: 1440×900
- 최적 데스크톱: 1600×1000 이상
- 태블릿 이하는 카드 편집 화면과 포메이션 화면을 분리한다.

### Spacing System

- **Base unit**: 8px
- `{spacing.xxs}` 4px
- `{spacing.xs}` 8px
- `{spacing.sm}` 12px
- `{spacing.md}` 16px
- `{spacing.lg}` 20px
- `{spacing.xl}` 24px
- `{spacing.xxl}` 32px
- `{spacing.panel}` 40px

### Panel Rhythm

- 패널 내부 기본 패딩: 16px
- 큰 정보 패널 패딩: 24px
- 카드 그리드 간격: 12px
- 하단 장비 카드 간격: 10px
- 포메이션 슬롯 간격: 48px 이상
- 네비게이션 높이: 64px
- 좌측 아이콘 레일: 64px

### Information Density

화면은 일부러 조밀하다. 게임 UI처럼 많은 정보가 보이지만, 정보 그룹은 명확해야 한다.

- 좌측: 찾기 / 수집
- 중앙: 배치 / 조합
- 우측: 해석 / 비교
- 하단: 장착 / 보너스

---

## Elevation & Depth

| Level | Treatment | Use |
|---|---|---|
| 0 — Background | `#070B10`, 미세한 노이즈 텍스처 | 전체 앱 배경 |
| 1 — Panel | 1px 골드/블루 hairline, 내부 어두운 그라데이션 | 라이브러리, 보드, 상세 패널 |
| 2 — Card | 카드 프레임 + 소프트 그림자 | Skill 카드, Agent 카드, MCP 카드 |
| 3 — Selected | 외곽 글로우 + 밝은 프레임 | 선택된 카드, 활성 Agent |
| 4 — Legendary | 강한 골드 림라이트 + 입자 효과 | 전설 등급, 최상위 장비 |
| 5 — Modal | 어두운 오버레이 + 중앙 플로팅 패널 | 카드 확대, 장비 상세, 저장 확인 |

### Shadows

- `{shadow.panel}`: `0 8px 24px rgba(0, 0, 0, 0.35)`
- `{shadow.card}`: `0 6px 16px rgba(0, 0, 0, 0.45)`
- `{shadow.selected-blue}`: `0 0 0 1px #2F8CFF, 0 0 24px rgba(47, 140, 255, 0.42)`
- `{shadow.selected-purple}`: `0 0 0 1px #8F4DFF, 0 0 28px rgba(143, 77, 255, 0.45)`
- `{shadow.legendary}`: `0 0 0 1px #D6A84F, 0 0 32px rgba(214, 168, 79, 0.48)`

### Decorative Depth

- 패널 테두리는 단순 1px 선이 아니라, 얇은 금속 프레임처럼 보이게 한다.
- 상단과 하단은 살짝 두꺼운 장식 프레임을 허용한다.
- 빈 슬롯은 살짝 움푹 들어간 느낌으로 처리한다.
- 선택된 카드만 강한 글로우를 허용한다.
- 과도한 입자 효과는 피한다. 정보가 먼저 읽혀야 한다.

---

## Shapes

### Border Radius Scale

| Token | Value | Use |
|---|---:|---|
| `{rounded.none}` | 0px | 날카로운 장식 절단면, 프레임 모서리 |
| `{rounded.xs}` | 3px | 작은 배지, 비용 칩 |
| `{rounded.sm}` | 6px | 입력창, 작은 버튼 |
| `{rounded.md}` | 8px | 일반 버튼, 슬롯 |
| `{rounded.lg}` | 12px | 카드 내부 이미지, 패널 |
| `{rounded.xl}` | 18px | 큰 카드, Inspector 패널 |
| `{rounded.card}` | 20px | Skill / Agent 카드 외곽 |
| `{rounded.pill}` | 9999px | 시너지 칩, 필터 칩 |

### Card Geometry

카드는 단순 사각형이 아니라 **상단 비용 보석 + 중앙 일러스트 + 하단 설명 박스** 구조를 가진다.

**Skill Card 구조**
- Top-left: 비용 / 에너지
- Top-right: 등급 보석
- Middle: 일러스트
- Bottom-title: Skill 이름
- Body: 한 줄 효과 설명
- Footer: 쿨다운, 비용, 태그, 스탯 아이콘

**Agent Card 구조**
- Top: 역할 라벨
- Middle: 캐릭터 초상
- Bottom: 이름, 레벨, 역할, 시너지 아이콘
- 상태: 선택됨, 배치됨, 비활성, 잠김

**MCP Card 구조**
- Top: 장비 타입
- Middle: 장비 이미지
- Bottom: 등급, 효과, 보너스 수치
- 슬롯 호환성 아이콘

---

## Components

### Top Navigation

**`app-topbar`**
- 높이 64px
- 배경 `{colors.canvas}` 위에 어두운 금속 패널
- 좌측: 로고 + `AGENT WORKSPACE`
- 중앙: Tavern / Missions / Agents / Analytics / Settings
- 우측: 자원 카운터, 프로필, 레벨

**`nav-tab-active`**
- 배경에 짙은 청색 그라데이션
- 하단에 `{colors.primary}` 글로우 라인
- 텍스트는 `{colors.text-primary}`
- 장식 프레임은 골드 또는 블루

**`resource-counter`**
- 아이콘 + 숫자 조합
- Blue Crystal, Gold Coin, Purple Shard 등 자원형 표현
- SaaS에서는 API Credit, Token, Runtime, Storage 등으로 매핑 가능

---

### Left Rail

**`icon-rail`**
- 너비 64px
- 앱 주요 섹션 바로가기
- 홈, 스킬, 에이전트, 장비, 설정, 도움말
- 활성 아이콘은 파란 글로우 배경
- 비활성 아이콘은 muted gold

---

### Skill Library

**`skill-library-panel`**
- 좌측 고정 패널
- 제목: `SKILL LIBRARY`
- 상단 필터: 전체 / 등급 / 태그 / 검색
- 카드 목록은 2열 그리드
- 스크롤 가능

**`skill-card-compact`**
- 너비 130–150px
- 높이 190–220px
- 비용 보석, 일러스트, 이름, 한 줄 설명, 미니 스탯 포함
- 등급별 프레임 색상 변경

**Default**
- 어두운 카드 배경
- 낮은 채도 프레임
- 작은 그림자

**Selected**
- 프레임 색상 상승
- 외곽 글로우
- 우측 Inspector에 상세 표시

**Equipped**
- 카드 우상단에 체크 또는 장착 배지
- 카드 하단에 `Equipped` 라벨

**Locked**
- 이미지 어둡게
- 중앙 자물쇠
- 필요 조건 표시

---

### Team Formation Board

**`formation-board`**
- 중앙 메인 영역
- 전술 보드 또는 마법진 형태
- Agent를 포지션에 배치
- 배치된 Agent 사이에는 연결선 표시
- 중앙에는 Team Crest 또는 Active Deck Crest 배치

**Formation Slots**
- Planner
- Researcher
- Builder
- Reviewer
- Operator

**`agent-unit-card`**
- 캐릭터 초상
- 역할명
- 레벨
- 이름
- 시너지 아이콘
- 현재 파워

**`synergy-bonus-panel`**
- 중앙 하단 배치
- 활성 시너지 이름과 보너스 수치 표시
- 예: `+27% Efficiency`
- 시너지 아이콘은 보석/룬 형태

**`save-deck-button`**
- 중앙 하단 주요 버튼
- 금색 프레임과 어두운 내부
- 활성 상태에서 은은한 골드 글로우
- 텍스트: `SAVE DECK`

---

### Selected Detail Inspector

**`selected-skill-panel`**
- 우측 고정 상세 패널
- 선택한 Skill을 큰 카드로 보여준다.
- 카드 아래에 세부 스탯, 호환성, 시너지, 비교 그래프를 표시한다.

**Detail Structure**
1. Large selected card
2. Skill description
3. Rarity badge
4. Energy Cost
5. Cooldown
6. Cast Time
7. Range
8. Compatibility
9. Synergy Bonus
10. Compare Bars

**`compare-stat-bars`**
- Your Build vs Avg. Top Decks
- Efficiency, Speed, Reliability, Scalability
- 각 막대는 색상으로 구분
- 상승/하락은 숫자와 화살표로 표시

**`compatibility-gems`**
- 각 Agent 역할과의 호환성 표시
- 체크 표시가 있으면 장착 가능
- 비활성은 회색 보석

---

### MCP Equipment

**`mcp-equipment-strip`**
- 하단 좌측 또는 우측 패널
- MCP를 장비 카드처럼 표시
- 장비 타입: Primary, Offhand, Charm, Glyph, Module

**`mcp-equipment-card`**
- 장비 이미지
- 등급
- 효과 수치
- 호환 슬롯
- 예: `+12% Speed`, `+25% Accuracy`, `+99 Reliability`

**`equipment-slot`**
- 빈 슬롯은 점선 프레임
- 드래그 가능 상태에서 파란 글로우
- 호환되지 않으면 붉은 테두리
- 장착 성공 시 짧은 글로우 애니메이션

---

### Loadout

**`loadout-panel`**
- 현재 장착된 카드와 장비를 보여준다.
- 사용자는 이 구성을 저장하거나 다른 로드아웃으로 전환할 수 있다.

**Loadout Slots**
- Primary
- Offhand
- Charm
- Glyph
- Skill Deck
- Agent Formation

**`loadout-bonus`**
- 최종 합산 보너스 표시
- 큰 숫자 중심
- 예: `+12% Speed`, `+25% Accuracy`, `+99 Reliability`

---

### Buttons

**`button-primary-gold`**
- 배경: 어두운 금속 그라데이션
- 테두리: `{colors.gold}`
- 텍스트: `{colors.text-primary}`
- 높이: 44px
- 용도: Save Deck, Forge Upgrade, Apply Upgrade

**`button-primary-blue`**
- 배경: `{colors.primary}` 그라데이션
- 텍스트: white
- 용도: Configure MCP, Create New Skill

**`button-secondary`**
- 배경: transparent dark
- 테두리: `{colors.border-gold}`
- 텍스트: `{colors.text-secondary}`
- 용도: Auto-fill, View All Loadouts, Filter

**`button-danger`**
- 배경: 어두운 적색
- 테두리: `{colors.danger}`
- 용도: Remove, Unequip, Reset

---

### Inputs

**`search-input`**
- 배경: `{colors.slot-empty}`
- 테두리: `{colors.hairline}`
- 높이: 36px
- 좌측 검색 아이콘
- placeholder는 `{colors.text-muted}`
- 포커스 시 `{colors.primary}` 테두리

**`filter-dropdown`**
- 어두운 패널 배경
- 작은 골드 테두리
- 우측 chevron
- 선택 상태는 보라색 또는 파란색 글로우

---

### Badges & Tags

**`rarity-badge`**
- Common: gray
- Rare: blue
- Epic: purple
- Legendary: gold
- Mythic: orange-red

**`role-badge`**
- Planner: blue
- Researcher: cyan
- Builder: amber
- Reviewer: violet
- Operator: emerald

**`stat-chip`**
- 작은 사각 또는 pill
- 아이콘 + 수치
- 예: `4.0s`, `15`, `+27%`

**`synergy-chip`**
- 아이콘 + 이름 + 진행도
- 예: `Arcane Flow 2/3`
- 활성 시 밝은 글로우
- 비활성 시 회색

---

## Core Screens

### 1. Tavern Deck Builder

가장 기본이 되는 화면이다. Skill Library, Team Formation, Selected Skill, MCP Equipment가 모두 한 화면에 보인다.

**목적**
- Skill을 고르고
- Agent에게 배치하고
- MCP를 장착하고
- 최종 덱을 저장한다.

**구성**
- 좌측: Skill Library
- 중앙: Team Formation
- 우측: Selected Skill
- 하단: MCP Equipment + Loadout

**좋은 사용처**
- 메인 워크스페이스
- 덱 빌딩
- Skill 관리
- Agent 조합 실험

---

### 2. War Room Arena

중앙의 전술 보드를 더 크게 사용하는 구성이다. Agent 연결선과 시너지 관계를 강조한다.

**목적**
- Agent 간 협업 구조를 시각적으로 이해한다.
- 팀 조합과 시너지 발동 조건을 확인한다.

**구성**
- 좌측: Inventory Drawer
- 중앙: Arena Board
- 하단: Skill Hand
- 우측: MCP Gear Rack

**좋은 사용처**
- 실시간 워크플로우 실행 화면
- Agent 협업 모니터링
- 자동화 전투 느낌의 작업 실행

---

### 3. Hero Loadout Studio

하나의 Agent를 중심으로 Skill과 MCP를 장착하는 화면이다.

**목적**
- 특정 Agent의 역량을 강화한다.
- 역할별 세팅을 튜닝한다.

**구성**
- 좌측: Agent Roster
- 중앙: Hero Agent Card
- 주변: MCP Weapons / Buff Charms / Support Modules
- 하단: Skill Cards
- 우측: Abilities / Team Stats / Compare Upgrades

**좋은 사용처**
- Agent 상세 관리
- 역할별 프리셋 설정
- 고급 사용자용 튜닝

---

### 4. Collection & Forge

Skill 카드를 수집하고 강화하는 화면이다.

**목적**
- Skill 컬렉션 관리
- 카드 업그레이드
- 등급·레벨·재료 확인

**구성**
- 좌측: Skills Collection
- 중앙: Selected Skill + Forge Upgrade
- 상단: Active Loadout
- 우측: MCP Equipment + Stat Impact Preview

**좋은 사용처**
- Skill 스토어
- Skill 제작
- 커스텀 자동화 템플릿 생성

---

### 5. Guild Mission Dashboard

업무 실행과 미션 큐를 강조하는 운영형 화면이다.

**목적**
- 현재 실행 중인 작업과 팀 상태를 본다.
- Agent 팀, Skill 덱, MCP 장비, Workspace Health를 한 번에 확인한다.

**구성**
- 좌측: Agent Roster + Formation
- 중앙: Mission Queue + Equipped Skills
- 우측: MCP Gear + Inventory + Live Stats
- 상단: Active Mission, Rank, Workspace Health

**좋은 사용처**
- 운영 대시보드
- Agent 작업 모니터링
- 팀 단위 자동화 관리

---

## Interactions

### Drag & Equip

Skill, Agent, MCP는 모두 드래그 가능한 오브젝트다.

- Skill 카드 → Agent 또는 Skill Deck 슬롯에 장착
- Agent 카드 → Formation 슬롯에 배치
- MCP 카드 → Equipment 슬롯에 장착
- 장착 가능하면 슬롯이 파란색으로 빛난다.
- 장착 불가능하면 붉은 테두리와 이유를 표시한다.

### Card Flip

Skill 카드를 클릭하면 카드가 뒤집힌다.

**Front**
- 이름
- 일러스트
- 한 줄 설명
- 비용
- 등급

**Back**
- 상세 설명
- 쿨다운
- 실행 범위
- 호환 Agent
- 추천 MCP
- 사용 로그
- 성능 통계

### Synergy Activation

조합이 맞으면 시너지 보너스가 발동된다.

**예시**
- Researcher + Planner + Insight Forge = `+15% Insight Quality`
- Builder + Auto Operator + Memory Matrix = `+20% Execution Stability`
- Reviewer + Report Smith = `+18% Report Accuracy`

### Stat Compare

장착 전후 능력치를 비교한다.

- 현재 수치
- 변경 후 수치
- 상승/하락 화살표
- 전체 Team Power 반영
- 추천 장착 표시

### Save Deck

현재 Agent + Skill + MCP 조합을 하나의 Loadout으로 저장한다.

**저장 정보**
- Deck name
- Agent formation
- Skill cards
- MCP equipment
- Synergy state
- Recommended use case

---

## Data Model Mapping

### Skill

```json
{
  "id": "skill_insight_forge",
  "name": "Insight Forge",
  "type": "Analysis",
  "rarity": "Legendary",
  "energyCost": 4,
  "cooldown": "4.0s",
  "castTime": "Instant",
  "range": "Global",
  "description": "Transform raw data into actionable insights.",
  "compatibleRoles": ["Planner", "Researcher"],
  "stats": {
    "efficiency": 92,
    "speed": 84,
    "reliability": 96,
    "scalability": 79
  }
}
```

### Agent

```json
{
  "id": "agent_strategos_ai",
  "name": "Strategos AI",
  "role": "Planner",
  "level": 28,
  "class": "Orchestrator",
  "power": 1850,
  "synergies": ["Arcane", "Planning", "Control"]
}
```

### MCP

```json
{
  "id": "mcp_chrono_lens",
  "name": "Chrono Lens",
  "type": "Offhand",
  "rarity": "Epic",
  "bonus": {
    "speed": 12,
    "accuracy": 0,
    "reliability": 0
  },
  "compatibleSlots": ["Offhand", "Module"]
}
```

### Loadout

```json
{
  "id": "loadout_growth_automation",
  "name": "Growth Automation",
  "agents": ["Planner", "Researcher", "Builder", "Reviewer", "Operator"],
  "skills": ["Data Harvest", "Web Scout", "Insight Forge", "Report Smith"],
  "mcp": ["Oracle Orb", "Chrono Lens", "Token Talisman", "Memory Matrix"],
  "teamPower": 8560,
  "synergyBonus": "+27% Efficiency"
}
```

---

## Motion

### Micro-interactions

- 카드 hover: 2–4px 위로 상승, 프레임 글로우 증가
- 카드 선택: 160ms scale `1.02`
- 장착 성공: 슬롯에서 짧은 링 파동
- 시너지 발동: 연결선이 1회 밝아짐
- Save Deck 성공: 버튼이 골드로 점등 후 원래 상태 복귀
- 카드 flip: 280–360ms 3D rotate

### Motion Principles

- 애니메이션은 빠르고 무겁지 않게 한다.
- 업무 도구이므로 과한 게임 이펙트는 피한다.
- 중요한 상태 변화만 움직인다.
- 반복되는 배경 입자는 아주 약하게 사용한다.

---

## Accessibility

### Contrast

- 어두운 배경 위 본문 텍스트는 최소 WCAG AA 대비를 확보한다.
- 카드 설명 영역은 너무 어둡게 만들지 않는다.
- 보라색 텍스트는 작은 크기에서 단독 사용하지 않는다.

### Non-color Indicators

색상만으로 상태를 구분하지 않는다.

- 등급: 색상 + 라벨
- 활성: 글로우 + 체크
- 비활성: 회색 + lock
- 상승: 초록색 + 위쪽 화살표
- 하락: 빨간색 + 아래쪽 화살표

### Touch Targets

- 버튼: 최소 44×44px
- 카드 드래그 핸들: 최소 32×32px
- 장비 슬롯: 최소 56×56px
- 모바일에서는 카드 그리드를 1열 또는 2열로 단순화한다.

---

## Responsive Behavior

### Desktop Large

- 전체 5영역 동시 표시
- Skill Library 2열 카드
- Team Formation 전체 표시
- Inspector 고정
- Bottom Loadout 항상 표시

### Desktop Small

- 좌측 아이콘 레일 축소 가능
- Skill Library 너비 축소
- Inspector는 탭으로 접을 수 있음

### Tablet

- Formation 화면과 Library 화면을 분리
- 우측 Inspector는 하단 drawer로 전환
- MCP Equipment는 별도 탭

### Mobile

- 메인 네비게이션은 하단 탭
- Skill / Agent / MCP / Loadout을 개별 화면으로 분리
- 카드 드래그 대신 `장착하기` 버튼 사용
- Formation은 세로형 슬롯 리스트로 표시

---

## Do's and Don'ts

### Do

- Skill, Agent, MCP를 모두 카드 또는 슬롯 오브젝트로 표현한다.
- 선택 상태는 명확한 글로우와 프레임으로 표시한다.
- 능력치 비교는 항상 숫자 + 막대 + 상승/하락 표시를 함께 사용한다.
- 게임 UI처럼 보여도 실제 작업 정보는 명확히 읽히게 한다.
- 카드 설명은 짧게 쓰고, 상세 정보는 Inspector로 넘긴다.
- 시너지 보너스는 화면 중앙 또는 하단에 강하게 표시한다.
- 등급 색상은 일관되게 유지한다.
- 저장 가능한 상태와 실행 가능한 상태를 버튼 색상으로 구분한다.

### Don't

- 특정 상용 게임의 로고, 카드 형태, 아이콘, 문양을 그대로 복제하지 않는다.
- 모든 요소에 글로우를 넣지 않는다.
- 카드 안에 긴 설명을 넣지 않는다.
- 판타지 장식 때문에 실제 기능을 찾기 어렵게 만들지 않는다.
- 너무 많은 색상을 동시에 사용하지 않는다.
- 모바일에서 데스크톱 레이아웃을 억지로 축소하지 않는다.
- 스탯 수치만 보여주고 의미를 설명하지 않는 화면을 만들지 않는다.

---

## Implementation Notes

### CSS Token Example

```css
:root {
  --color-canvas: #070B10;
  --color-panel: #101722;
  --color-panel-raised: #162131;
  --color-primary: #2F8CFF;
  --color-secondary: #8F4DFF;
  --color-gold: #D6A84F;
  --color-emerald: #31C878;
  --color-ember: #E05243;

  --text-primary: #F4EBD2;
  --text-secondary: #B8A982;
  --text-muted: #7E8796;

  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 18px;
  --radius-card: 20px;

  --shadow-panel: 0 8px 24px rgba(0, 0, 0, 0.35);
  --shadow-card: 0 6px 16px rgba(0, 0, 0, 0.45);
  --shadow-selected: 0 0 0 1px var(--color-primary), 0 0 24px rgba(47, 140, 255, 0.42);
}
```

### Suggested Frontend Stack

- Next.js
- React
- Tailwind CSS
- Framer Motion
- Zustand 또는 Jotai
- DnD Kit
- Radix UI
- Lucide Icons + custom SVG rune icons

### Component Naming

```txt
AppShell
TopNavigation
ResourceCounter
SkillLibrary
SkillCard
AgentFormationBoard
AgentUnitCard
SelectedSkillInspector
McpEquipmentStrip
LoadoutPanel
SynergyBonusPanel
StatCompareBars
EquipmentSlot
CardFlipDetail
```

---

## MVP Scope

### Phase 1

- Skill Library
- Agent Formation
- MCP Equipment
- Loadout 저장
- 카드 선택 상세 패널
- 기본 스탯 비교

### Phase 2

- 드래그 앤 드롭 장착
- 카드 Flip 상세
- 시너지 자동 계산
- Agent별 추천 Skill
- MCP 호환성 체크

### Phase 3

- Mission Dashboard
- 실행 로그
- Workspace Health
- 자동화 성능 리포트
- Skill Marketplace
- 공유 가능한 Loadout 템플릿

---

## Design Principle Summary

Agent Workspace는 “AI 업무 도구”가 아니라 “나만의 AI 파티를 편성하는 전략 게임 UI”처럼 느껴져야 한다.  
하지만 게임적 장식은 기능을 가리는 장식이 아니라, 복잡한 워크플로우 구성을 더 직관적으로 이해시키는 메타포여야 한다.

최종 목표는 다음 한 문장으로 정리된다.

> Skill을 카드처럼 고르고, Agent를 유닛처럼 배치하고, MCP를 장비처럼 장착해, 나만의 AI 작업 덱을 완성하는 웹 기반 Agent Workspace.
