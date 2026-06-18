---
name: pencil
description: >-
  Pencil MCP로 LOADOUT 디자인 시스템을 .pen 파일에 구축·적용한다.
  design.md 스펙과 docs/design/ 레퍼런스 이미지를 기반으로 컬러, 타이포, 스페이싱, 컴포넌트를 설계한다.
  .pen 파일 생성·편집, 디자인 토큰 세팅, 컴포넌트 배치, 레이아웃 스냅샷을 수행한다.
  Use when working with .pen files, Pencil MCP, or building/applying the LOADOUT design system.
---

# Pencil — LOADOUT 디자인 시스템 빌더

Pencil MCP를 사용해 LOADOUT 디자인 시스템을 `.pen` 파일로 구축하는 스킬.

## 레퍼런스

- **디자인 스펙**: `design.md` (프로젝트 루트) — 컬러, 타이포, 스페이싱, 컴포넌트, 인터랙션 전체 정의
- **시각 가이드**: `docs/design/` — 4장의 디자인 시스템 시트
  - 01 Foundations: 컬러, 타이포, 스페이싱, 반경, 그림자, 아이콘
  - 02 Components · Navigation & Controls: 탑 내비, 검색, 탭, 필터, 버튼, 인풋, 배지, 빈 상태
  - 03 Components · Asset Discovery & Detail: 추천 카드, 컴팩트 카드, 리스트, MCP 장비, 팀 로스터, 인스펙터, 스탯 바, 의존성 그래프, 명령어 박스
  - 04 Components · Memory & Loadout: 메모리 금고, 노트 칩/태그, 메모리 그래프, 로드아웃 바, 비교 트레이, 저장 패널, 활동 타임라인

## Pencil MCP 도구

| 도구 | 용도 |
|------|------|
| `get_editor_state` | 현재 .pen 파일 상태(열린 페이지, 선택 노드) 확인 |
| `get_guidelines` | 파일에 설정된 디자인 가이드라인 조회 |
| `batch_get` | 여러 노드/프레임 정보를 한 번에 조회 |
| `batch_design` | 여러 노드를 한 번에 생성·수정·삭제 |
| `snapshot_layout` | 현재 레이아웃을 YAML/JSON 구조로 캡처 |
| `get_screenshot` | 특정 노드/프레임의 스크린샷 촬영 |
| `get_variables` | 디자인 변수(토큰) 조회 |
| `set_variables` | 디자인 변수(토큰) 설정 |
| `export_nodes` | 노드를 PNG/SVG/PDF로 내보내기 |

**중요**: `.pen` 파일은 암호화되어 있어 직접 읽기/쓰기가 불가능하다. 반드시 Pencil MCP를 통해서만 접근한다.

## 워크플로

### 1. 새 .pen 파일 시작

```
1. get_editor_state로 현재 상태 확인
2. set_variables로 디자인 토큰 일괄 등록 (아래 토큰 섹션 참고)
3. batch_design으로 페이지 구조 생성
4. snapshot_layout으로 결과 확인
5. get_screenshot으로 시각 검증
```

### 2. 디자인 토큰 적용

`set_variables`로 아래 토큰을 `.pen` 파일에 등록한다.

#### Colors

```json
{
  "color/primary": "#4F46E5",
  "color/primary-active": "#4338CA",
  "color/primary-soft": "#EEF2FF",
  "color/accent-orange": "#F59E0B",
  "color/accent-orange-soft": "#FFF7ED",
  "color/accent-emerald": "#10B981",
  "color/accent-violet": "#8B5CF6",
  "color/accent-blue": "#3B82F6",
  "color/accent-rose": "#F43F5E",
  "color/rarity-s": "#F59E0B",
  "color/rarity-a": "#8B5CF6",
  "color/rarity-b": "#3B82F6",
  "color/rarity-c": "#64748B",
  "color/rarity-legendary": "#F97316",
  "color/canvas": "#FFFFFF",
  "color/surface-app": "#F8FAFC",
  "color/surface-card": "#FFFFFF",
  "color/surface-soft": "#F1F5F9",
  "color/surface-warm": "#FFFBEB",
  "color/surface-success": "#ECFDF5",
  "color/surface-violet": "#F5F3FF",
  "color/surface-blue": "#EFF6FF",
  "color/hairline": "#E5E7EB",
  "color/hairline-strong": "#CBD5E1",
  "color/divider-soft": "#F1F5F9",
  "color/ink": "#0F172A",
  "color/body": "#334155",
  "color/muted": "#64748B",
  "color/muted-soft": "#94A3B8",
  "color/on-primary": "#FFFFFF",
  "color/on-accent": "#111827",
  "color/success": "#10B981",
  "color/warning": "#F59E0B",
  "color/error": "#EF4444",
  "color/info": "#3B82F6"
}
```

#### Typography

| 토큰 | 크기 | 무게 | 행간 | 자간 | 용도 |
|------|------|------|------|------|------|
| display-lg | 40px | 700 | 1.15 | -0.8px | 랜딩/빈 상태 |
| display-md | 32px | 700 | 1.2 | -0.6px | 페이지 제목 |
| title-xl | 24px | 700 | 1.3 | -0.3px | 자산명 |
| title-lg | 20px | 700 | 1.35 | -0.2px | 섹션 제목 |
| title-md | 17px | 600 | 1.4 | 0 | 카드 제목 |
| title-sm | 15px | 600 | 1.4 | 0 | 리스트 항목 |
| body-md | 15px | 400 | 1.55 | 0 | 기본 본문 |
| body-sm | 14px | 400 | 1.5 | 0 | 카드 설명 |
| caption | 12px | 500 | 1.4 | 0 | 메타 정보 |
| caption-strong | 12px | 700 | 1.4 | 0 | 배지 라벨 |
| code | 13px | 400 | 1.55 | 0 | 명령어/경로 |
| score | 14px | 700 | 1.2 | -0.2px | 점수/레벨 |
| button | 14px | 700 | 1.0 | 0 | 버튼 |
| nav-link | 14px | 600 | 1.4 | 0 | 네비게이션 |

- UI: **Pretendard**
- Code/Score: **JetBrains Mono**
- Logo: **Sora** / Space Grotesk / Inter Tight

#### Spacing

```
xxs: 4px · xs: 8px · sm: 12px · md: 16px · lg: 24px · xl: 32px · xxl: 48px
```

#### Border Radius

```
xs: 4px · sm: 6px · md: 8px · lg: 12px · xl: 16px · xxl: 20px · pill: 9999px · full: 50%
```

#### Shadows

```
xs: 0 1px 2px rgba(15,23,42,0.04)
sm: 0 4px 12px rgba(15,23,42,0.06)
md: 0 12px 28px rgba(15,23,42,0.10)
focus: 0 0 0 4px rgba(79,70,229,0.12)
rarity-s: 0 0 0 1px rgba(245,158,11,0.55), 0 8px 24px rgba(245,158,11,0.16)
```

### 3. 컴포넌트 설계

`batch_design`으로 컴포넌트를 생성할 때 아래 구조를 따른다.

#### App Shell (3-Panel Layout)

```
top-nav (56px, 고정)
├── logo: "LOADOUT" (Sora, bold)
├── global-search (⌘K 힌트)
├── primary-tabs: 홈 · 스킬 · 에이전트 · MCP · 팀
└── quick-actions: 새로 추가 · 가져오기 · 알림 · 설정

filter-rail (220px, 좌측 고정)
├── 유형 필터
├── 등급 필터 (S/A/B/C)
├── 출처 필터
├── 장착 상태
└── 태그 칩

main-dashboard (유동 폭)
├── 추천 카드 (최대 4개, S-Class = 오렌지 border)
├── 최근 추가
├── 스킬 라이브러리
├── MCP 장비
├── 팀 로스터
└── 메모리 보관함

inspector-panel (360~420px, 우측 고정)
├── 헤더 (배지 + 이름 + 타입 + 레벨)
├── 액션 탭 (장착 · 해제 · 비교)
├── 설명 (2~4줄)
├── 스탯 바
├── 의존성 그래프 (5노드 이하)
├── 명령어 박스
├── 메모리 노트
└── 활동 로그

equipped-loadout-bar (76~96px, 하단 고정)
├── 로드아웃명
├── 장착 칩들 + "+N개 더"
├── 총 파워 (mono)
└── 저장 버튼
```

#### 카드 Variants

| 타입 | 크기 | 내부 패딩 | radius | 정보 |
|------|------|----------|--------|------|
| recommend-card | 큰 카드 | 20px | xl(16px) | 아이콘·이름·타입·설명·점수·장착 상태 |
| asset-card-compact | 작은 카드 | 16px | lg(12px) | 이름·타입·설명(2줄)·Lv·점수 |
| asset-list-card | 리스트 행 | 12px | md(8px) | 이름·타입·Lv·점수·등급 배지 |

#### 등급 배지 색상

- **S-Class**: orange (`#F59E0B`) bg + dark text
- **A-Class**: violet (`#8B5CF6`) bg + white text
- **B-Class**: blue (`#3B82F6`) bg + white text
- **C-Class**: slate (`#64748B`) bg + white text
- **Legendary**: deep orange (`#F97316`)

#### 버튼 패턴

| 종류 | 배경 | 텍스트 | 높이 | 용도 |
|------|------|--------|------|------|
| primary | primary(#4F46E5) | white | 40px | 저장, 가져오기 |
| accent | orange(#F59E0B) | dark(#111827) | 40px | 장착 |
| secondary | white + hairline | body | 40px | 해제, 비교 |
| ghost | 투명 | muted | 36px | 초기화, 더보기 |
| icon | 투명/soft | — | 36px | 알림, 설정, 복사 |

### 4. 검증

컴포넌트를 만든 후 반드시:

1. `snapshot_layout`으로 구조 확인
2. `get_screenshot`으로 시각 검증
3. `docs/design/` 이미지와 대조
4. 토큰 일관성 점검 (커스텀 값 금지, 정의된 토큰만 사용)

### 5. 디자인 원칙 체크리스트

- [ ] 화이트 캔버스 기반 — 어두운 게임 HUD 금지
- [ ] 색상은 상태 전달에만 사용
- [ ] S-Class는 오렌지 강조, 과한 glow 금지
- [ ] 카드 제목 15~17px, 설명 최대 2줄
- [ ] 점수/레벨/버전은 mono 폰트
- [ ] 그림자는 매우 약하게
- [ ] 한 카드에 핵심 지표 5개 이하
- [ ] primary indigo와 orange accent를 같은 우선순위로 남용 금지
- [ ] 게임 느낌이 과하면 SaaS 쪽으로 되돌림

## Do / Don't 빠른 참조

**Do**: 일관된 토큰 사용, 등급은 색+텍스트+아이콘 함께, 여백 충분히, 정보 계층 명확히, 포커스 상태 명확히

**Don't**: 임의 색상/반경, 컴포넌트 간 간격 임의 변경, 텍스트 계층 혼용, 그림자 과다, 아이콘 의미 변경

## 추가 리소스

- 전체 디자인 스펙: [design.md](../../design.md)
- 시각 레퍼런스: [docs/design/](../../docs/design/)
- 데이터 모델: [docs/02-data-model.md](../../docs/02-data-model.md)
- UI 설계: [docs/03-ui-design.md](../../docs/03-ui-design.md)
