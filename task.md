# Loadout Frontend Migration — React + Vite + Bun

## 개요
`src/web/` 바닐라 SPA(index.html + app.js + styles.css)를 React + Vite + TypeScript로 마이그레이션.
기존 `src/server.mjs`와 `src/scan.mjs`는 유지, 프론트엔드만 `src/client/`로 교체.

---

## Story 1: Foundation (프로젝트 기반)
- [x] `bun create vite src/client --template react-ts`
- [x] Tailwind CSS 4 설정
- [x] API proxy (vite.config.ts → localhost:7777)
- [x] 공통 타입 정의 (`types/index.ts`)
- [x] API 클라이언트 모듈 (`lib/api.ts`)
- [x] 라우팅 없음 (SPA 단일 뷰)
- [x] 기본 레이아웃 컴포넌트 (Header, Main)
- [x] `bun run dev` 로 Vite 서버 기동 확인

## Story 2: Catalog Parity (카탈로그 화면)
- [x] 카드 그리드 컴포넌트 (`CardGrid`, `Card`)
- [x] 검색 입력
- [x] Kind 필터 (all/skill/agent/mcp)
- [x] Rarity 필터
- [x] 정렬 (score, name, power, freshness 등)
- [x] 중복만/장착만/즐겨찾기만 토글
- [x] 무한 스크롤 (PAGE=60)
- [x] 카드 hover/선택 상호작용
- [x] 헤더 통계 (총 N개, S-CLASS N개 등)
- [x] 일괄 선택 체크박스 + BatchBar
- [x] 복수 그룹 뱃지
- [x] 레벨 프로그레스 바

## Story 3: Detail + Equip Parity (상세/장착)
- [x] 상세 패널 (카드 클릭 → 오버레이)
- [x] 스탯 표시 (한국어 레이블)
- [x] 장착/해제 버튼 (POST /api/equip, /api/unequip)
- [x] 즐겨찾기 토글 (localStorage)
- [x] 문서 전체보기 (marked 렌더링)
- [x] 번역 기능 (POST /api/translate)
- [x] 테마 토글 (light/dark)
- [x] 언어 토글 (ko/en)
- [x] 복수 자산 감지 힌트

## Story 4: Advanced Features (고급 기능)
- [x] 범용 모달 컴포넌트 (`Modal.tsx`)
- [x] 일괄 이미지 생성 바 (`BatchBar.tsx`)
- [x] 포메이션 사이드바 (`Formation.tsx` — 장착 세트 시각화)
- [x] 소스 관리 모달 (`SourceManager.tsx` — clone/add/remove/rescan)
- [x] Header에 포메이션/소스 토글 버튼 통합

## Story 5: Cleanup + Test + Verify (마무리)
- [x] Vitest 설정 (jsdom, @testing-library/react)
- [x] 유틸 테스트 (`utils.test.ts` — iconFor, summarize, computeLevel)
- [x] 스토어 테스트 (`store.test.ts` — filter, sort, favorites, picks)
- [x] 19개 테스트 전체 통과
- [x] server.mjs 정적 경로를 `src/client/dist`로 변경 (fallback 유지)
- [x] 프로덕션 빌드 확인 (`bun run build` — 258KB JS, 30KB CSS)
- [x] TypeScript 컴파일 무에러

## 구조
```
src/client/
├── index.html
├── vite.config.ts
├── package.json
├── tsconfig.json
└── src/
    ├── App.tsx
    ├── main.tsx
    ├── index.css
    ├── types/index.ts
    ├── lib/api.ts
    ├── lib/utils.ts
    ├── hooks/useStore.ts
    ├── components/
    │   ├── Header.tsx
    │   ├── Card.tsx
    │   ├── CardGrid.tsx
    │   ├── DetailPanel.tsx
    │   ├── BatchBar.tsx
    │   ├── Formation.tsx
    │   ├── Modal.tsx
    │   └── SourceManager.tsx
    └── test/
        ├── setup.ts
        ├── utils.test.ts
        └── store.test.ts
```
