# 05 · 로드맵 (MVP 단계적)

> 전략: **빨리 동작하는 걸 보고 키운다.** 각 단계가 끝나면 실제로 쓸 수 있는 상태.

**진행: Phase 1 ✅ · Phase 2 ✅ · Phase 3 🔶(부분) · Phase 4 ⬜** (2026-06-05 기준)

## 🥇 Phase 1 — 카탈로그 (가장 먼저 동작)

목표: clone한 repo를 **카드로 펼쳐 보기**.

- [ ] `sources/`에 샘플 repo 몇 개 clone (또는 `ref/`에서 시드)
- [ ] `src/scan.mjs` — 탐지 + 메타 추출 + **기본 스탯** + 중복 그룹 → `data/index.json`
- [ ] `src/web/` — 바닐라 SPA: 🃏 컬렉션 그리드, 카드 앞면, **클릭 플립** 뒷면, 검색/필터/정렬
- [ ] 등급 프레임 + 호버 틸트 + 가상 스크롤(대량 카드)
- [ ] 정적으로 열어 확인 (`index.html` + `data/index.json`)

**완료 기준**: 브라우저에서 수백 장 카드를 보고, 클릭하면 뒤집혀 상세가 보인다.

## 🥈 Phase 2 — 장착 + 업데이트

목표: 고른 카드를 **실제 사용 가능**하게 + **변경 추적**.

- [ ] `src/server.mjs` — Node 내장 http, 액션 엔드포인트
- [ ] `POST /clone` — link 추가 → clone → rescan → "팩 오프닝"
- [ ] `POST /equip` `/unequip` — `~/.claude` 심링크/junction(Win fallback) → 🎒 인벤토리 탭
- [ ] `POST /update` + `src/update.mjs` — `git fetch` 변경 감지 → 🆕 배지 → 업데이트/유지
- [ ] `data/loadout.json` · `data/sources.json`

**완료 기준**: 웹에서 link 추가·장착·업데이트가 다 되고, 장착한 스킬이 Claude Code에서 실제로 보인다.

## 🥉 Phase 3 — AI 비교 + 게임 연출 + 이미지

목표: "어떤 게 좋은지" 판정 + 재미 + 시각화.

- [ ] `POST /verify` + AI judge 어댑터(`claude -p`) → `+99` 채점 / 그룹 비교 판정 → `verdicts.json`
- [ ] ⚔️ 비교 화면(스탯 대결 + WINNER + 병합/선택 권장)
- [ ] 🧑 포메이션 탭(agent 드래프트·배치·팀 프리셋)
- [ ] ⚔️ 무기고 탭(mcp 장비 + 내 CC 설정 연동)
- [ ] 🎨 이미지생성(codex-image) + 기존 14개 매핑
- [ ] 등급 상승/장착 파티클 등 "물 흐르듯" 연출

**완료 기준**: 중복 카드를 AI가 비교해 우세를 알려주고, 팀을 짜고, 카드 아트가 보인다.

## 🏅 Phase 4 — 다듬기 (선택)

- [ ] 정기 업데이트 자동화(`/loop` 또는 OS 스케줄러)
- [ ] 팀 프리셋 → OMC `/team`·워크플로 export
- [ ] 수동 오버라이드(`.loadout-override.json`)
- [ ] 백업/이식, 설정 페이지

---

## 지금 당장 다음 액션

1. **Phase 1 착수 승인** → `scan.mjs` + 최소 SPA부터.
2. 시드 소스 결정: `ref/`의 기존 clone을 `sources/`로 복사해 시드할지, 새로 clone할지.
   - 권장: 큰 repo(antigravity 등)는 `ref/`에서 복사 시드(재다운로드 절약), 신규는 clone.

관련: [01-architecture.md](01-architecture.md) · [04-workflows.md](04-workflows.md)
