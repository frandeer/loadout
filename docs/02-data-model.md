# 02 · 데이터 모델 · 스탯 · ID 규칙

## 탐지 규칙

스캔 스크립트가 `sources/`를 훑으며 세 종류를 식별한다.

| 종류 | 탐지 신호 | 비고 |
|------|----------|------|
| 🃏 **Skill** | `SKILL.md` (frontmatter `name`/`description`) | 가장 표준적. `skills/**/SKILL.md` |
| 🧑 **Agent** | `agents/**/*.md` (frontmatter), `.claude/agents/*.md`, `plugin.json`의 agents | 역할/모델/도구 메타 추출 |
| ⚔️ **MCP** | `.mcp.json` / `mcp.json`, `package.json`의 `mcpServers`, README의 `npx ... mcp` 패턴 **+ 내 `~/.claude` 설정에 등록된 MCP** | repo엔 드묾 → 내 CC 설정이 주 소스 |

> 자동 탐지가 놓치면 **수동 오버라이드**(`.loadout-override.json`)로 보정 가능 — 초기엔 자동만, 필요 시 추가.

## 공통 항목 스키마

```jsonc
{
  "id": "anthropics__skills/skills/pdf",   // 충돌 불가 고유 ID (아래 규칙)
  "kind": "skill",                          // skill | agent | mcp
  "name": "pdf",                            // 표시 이름 (frontmatter name)
  "displayName": "PDF",
  "description": "PDF 추출·병합·분할·폼 처리",
  "source": {
    "repo": "anthropics__skills",
    "owner": "anthropics",
    "url": "https://github.com/anthropics/skills",
    "path": "skills/pdf",                   // repo 내 상대경로
    "commit": "a1b2c3d",                    // 마지막 커밋(업데이트 감지용)
    "stars": 4200
  },
  "meta": {                                  // kind별 추가 메타
    "allowedTools": ["Read", "Bash"],
    "model": null,                          // agent면 haiku/sonnet/opus
    "hasReferences": true,
    "scripts": 2
  },
  "stats": { /* 아래 '능력치' 참조 */ },
  "rarity": "rare",                          // 등급 (계산값)
  "contentHash": "sha1:...",                 // 항목 단위 변경 감지
  "group": "pdf-tools",                      // 중복 그룹 키 (없으면 null)
  "image": "skill-ecosystems/02-oh-my-claudecode.png", // 매핑된 이미지(있으면)
  "equipped": false                          // 장착 여부 (loadout.json과 동기)
}
```

## ID & 이름 충돌 규칙 ⚠️

repo들이 죄다 `skills/`·`skill` 이름을 재사용 → **그냥 모으면 충돌**. 해결:

- **clone 위치**: `sources/<owner>__<repo>/` (예: `anthropics__skills`, `sickn33__antigravity-awesome-skills`)
- **고유 ID**: `<owner>__<repo>/<repo내 상대경로>` → 전역 유일 보장.
- **표시 이름**: `name`만 보여주되, 같은 이름이 여러 개면 **소스 배지**(`anthropics`)로 구분.
- **중복 그룹**: 이름/설명이 비슷하면 같은 `group`으로 묶어 "비교 후보"로 노출(→ 비교 UI).

## 능력치(스탯) 시스템 🎮

> **자동 기본 스탯**(항상, 무료) + **요청 시 AI `+99`**(볼 때만). [decisions](06-decisions.md) 참조.

### 기본 스탯 — 객관 지표, 즉시 계산

| 스탯 | 아이콘 | 산출 근거 | 정규화 |
|------|-------|----------|--------|
| **인기** Popularity | ⭐ | 소스 repo의 GitHub stars | 0–99 (log 스케일) |
| **신선도** Freshness | 🔄 | 마지막 커밋 경과일 (최근일수록 ↑) | 0–99 |
| **파워** Power | ⚡ | 복잡도: 도구 수 + 스크립트/references 수 + 본문 길이 | 0–99 |
| **명확도** Clarity | 🎯 | 설명 품질: frontmatter 완전성 + 적정 길이 + 예시 유무 | 0–99 |
| **무게** Weight | 📦 | 용량/토큰(클수록 무겁다 = 비용) | 0–99 (낮을수록 가벼움) |

### AI 스탯 — `/verify` 시 Claude가 채점 (0–99)

| 스탯 | 의미 |
|------|------|
| **유용성** Usefulness | 실제로 얼마나 쓸모 있나 |
| **품질** Quality | 작성 완성도·안정성 |
| **우세도** Dominance | 같은 중복 그룹 안에서 대안 대비 얼마나 나은가 (병합/선택 판단의 핵심) |

### 등급(Rarity) — 종합 점수 → 카드 프레임

```
score = 0.25*인기 + 0.20*파워 + 0.20*명확도 + 0.20*신선도 + 0.15*(AI유용성 || 기본추정)
```

| 등급 | 점수대 | 프레임(→ [03-ui-design.md](03-ui-design.md)) |
|------|--------|------|
| Common | 0–39 | 회색 |
| Uncommon | 40–54 | 초록 |
| Rare | 55–69 | 파랑 보석 |
| Epic | 70–84 | 보라 |
| **Legendary** | 85–99 | 주황 + **홀로그래픽 foil** ✨ |

> AI 채점 전에는 기본 스탯만으로 잠정 등급 → 채점 후 확정(`+99`가 붙으며 등급 상승 가능).

## 변경 감지 (업데이트)

- **repo 단위**: `data/sources.json`에 마지막 커밋 해시 저장 → `git fetch` 후 비교 → repo에 🆕 표시.
- **항목 단위**: 각 항목의 `contentHash` 비교 → 정확히 **어떤 카드가 바뀌었는지** 🆕 배지.
- 사용자는 웹에서 **업데이트(pull) / 유지(현재 커밋 핀 고정)** 선택 → [04-workflows.md](04-workflows.md#업데이트).

관련: [01-architecture.md](01-architecture.md) · [03-ui-design.md](03-ui-design.md)
