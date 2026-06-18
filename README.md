# 🎒 Loadout

> Claude Code의 **skill · agent · mcp**를 게임처럼 모으고, 비교하고, 장착하는 개인 통합 관리 시스템.

수백~수천 개의 흩어진 스킬/에이전트/MCP를 **데스티니·에이펙스에서 장비를 모으듯** 카드로 펼쳐 보고,
능력치(`⚡파워 +99`)와 등급(Common→Legendary)으로 한눈에 비교한 뒤,
**"장착(Equip)"** 한 번으로 실제 Claude Code에서 바로 쓸 수 있게 만드는 것이 목표다.

```
link 붙여넣기 → clone → 자동 추출 → 카탈로그(카드) → 비교/중복정리(AI) → 장착(인벤토리) → 사용
```

---

## 게임 메타포

| 실제 | 게임 개념 | 화면 |
|------|----------|------|
| **Skill** | 🃏 스킬/아이템 **카드** | 카드 컬렉션 · 클릭 시 3D 플립으로 상세 |
| **Agent** | 🧑‍🤝‍🧑 **팀원/유닛** | 로스터 → **포메이션 배치**(축구·턴제 팀게임) |
| **MCP** | ⚔️ **무기/장비** | 장비 슬롯 · 능력 부스트 |
| 장착한 것 | 🎒 **인벤토리 / 로드아웃** | 장착 = 인벤토리에 들어가 즉시 사용 가능 |
| 능력치 | ⚡ `+99` 스탯 · 등급 | 카드/유닛에 표시, 비교는 스탯 막대 대결 |

---

## 폴더 구조

```
loadout/
├── README.md          ← 지금 이 문서
├── docs/              ← 설계 문서 (브레인스토밍 결과)
│   ├── 00-vision.md         비전 & 게임 메타포
│   ├── 01-architecture.md   시스템 구조 (스캔·서버·SPA)
│   ├── 02-data-model.md     데이터 모델 · 스탯 · ID/충돌 규칙
│   ├── 03-ui-design.md      게임풍 UI/UX (카드·인벤토리·포메이션)
│   ├── 04-workflows.md      핵심 흐름 (clone→장착→업데이트)
│   ├── 05-roadmap.md        MVP 단계별 로드맵
│   ├── 06-decisions.md      확정된 의사결정 로그
│   └── 07-card-design.md    기밀 작전 자산 카드 디자인 기준
├── sources/           ← clone된 원본 repo (gitignore, 독립 소유)
├── src/               ← 스캔 스크립트 · 로컬 서버 · 웹앱 (구현 예정)
├── data/              ← 생성된 인덱스 JSON (gitignore)
└── media/             ← 다이어그램/카드 아트
    └── generated/         codex-image로 생성한 이미지
```

> 기존 이미지: `D:/lab/document/KnowledgeVault/media/skill-ecosystems/` (14개) 재사용 + 필요 시 생성.

---

## 실행 방법

```bash
# 1) 스캔 — sources(현재 D:/lab/ref/skills)를 훑어 data/index.json 생성
npm run scan        # = node src/scan.mjs

# 2) 서버 — 게임 UI + 행동 API
npm start           # = node src/server.mjs  →  http://localhost:4970

# (선택) 이미지 생성 쓰려면
npm install         # chrome-remote-interface
.\skills\web-image-forge\launch-chrome.ps1   # 디버그 Chrome + ChatGPT 로그인
```

브라우저에서 `http://localhost:4970` → 카드 클릭(우측 상세) → **🎒 장착** → `~/.claude/skills`에 junction 연결되어 즉시 사용.

## 현재 상태 (2026-06-05)

✅ **동작하는 MVP** — Phase 1(카탈로그) + Phase 2(장착) 완료, Phase 3 부분.

| 구성 | 상태 |
|------|------|
| 스캐너 `src/scan.mjs` | ✅ 실데이터 4,971개(스킬 4,921·에이전트 49·MCP 1), 백분위 등급 |
| 게임 UI `src/web/` | ✅ 한국어, 3분할 레이아웃, 카드 그리드/상세/능력치바, 필터/정렬/검색 |
| 서버 `src/server.mjs` | ✅ 정적+API: index·equip(junction)·verify·generate·save-slice·clone·rescan |
| 장착(Equip) | ✅ `~/.claude/skills`에 junction 생성/해제 검증됨 |
| 이미지 스킬 `skills/web-image-forge/` | ✅ 생성(CDP)+슬라이서(canvas)+프롬프트빌더 |
| AI 검증 `+99` | ⚠️ 휴리스틱 judge(추후 `claude -p` 어댑터) |
| 이미지 생성 | ⚠️ 코드 완성, 실사용은 Chrome+ChatGPT 로그인 필요 |

설계 문서는 `docs/` (비전·구조·데이터모델·UI·워크플로·로드맵·결정).
다음 단계는 [docs/05-roadmap.md](docs/05-roadmap.md) 참고.
