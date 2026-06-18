# SkillSpector 위험 감지 통합 — 설계 스펙 (2026-06-18)

> Phase A of [docs/11-evolving-system.md](../../11-evolving-system.md). 브레인스토밍 산출물.
> 상태: **승인 대기** (구현 전 사용자 검토).

## 1. 목표 & 범위

NVIDIA **SkillSpector**(Apache-2.0, 16개 취약점 카테고리)를 Loadout에 붙여, 자산의 보안 위험을
**보고 판단**할 수 있게 한다. scan.mjs의 regex 3종(network/shell/creds)을 대체·보강한다.

**확정된 결정:**
| ID | 결정 | 근거 |
|---|---|---|
| D1 | **실행 = Docker 우선**, 플러그블(Docker→로컬 venv→regex 폴백) | SkillSpector PyPI 미존재(uvx 불가, 증거: 404). Docker 설치됨 + 악성 스킬 **격리** 분석 + 문서화 경로 |
| D2 | **검사 범위 = skill + MCP** | 둘 다 장착 대상 + SkillSpector가 MCP tool-poisoning/least-privilege도 검사. agent·memory는 후순위 |
| D3 | **정적분석만**(`--no-llm`) MVP | 빠름·무료·오프라인·결정적. LLM 시맨틱 단계는 후속(기존 엔진 재사용) |
| D4 | **역할 = 가시성 + 경고** | 위험배지 표시 + 위험자산 장착 시 경고. **하드 차단 없음**(결합 최소) |
| D5 | **트리거 = 온디맨드 + 캐시** | 카드별/일괄 버튼. 콘텐츠 해시로 변경분만 재검사. 자동 보호루프는 후속 |
| D6 | **캐시 키 = item id**, 스테일 판정 = `contentHash` 비교 | scan이 이미 산출하는 `contentHash`(scan.mjs:476,518) 재사용. 요청시 재해싱 불필요 |

**비-범위 (후속):** agent/memory 검사, 자동 보호루프(rescan 시 자동), LLM 시맨틱 단계,
CRITICAL 하드 차단, CI/SARIF 게이트.

## 2. 아키텍처

```
src/risk.mjs (신규)        server.mjs (수정)            client (수정)
┌────────────────────┐    ┌──────────────────────┐    ┌────────────────────┐
│ probeEngine()      │◀───│ POST /api/risk-scan   │◀───│ api.ts riskScan()  │
│ resolveTarget()    │    │ GET  /api/risk-engine │    │ Card 위험배지       │
│ runSkillSpector()  │    │ /api/index 위험 병합   │    │ DetailPanel 위험섹션 │
│ parseReport()      │    └──────────────────────┘    │ Inventory 일괄검사   │
│ regexFallback()    │           │                     │ 장착 시 경고         │
│ cache I/O          │──▶ data/risk.json (gitignore)   └────────────────────┘
│ + CLI 배치 진입     │
└────────────────────┘
```
**scan.mjs는 수정하지 않는다** (멱등·zero-dep 불변식). 위험은 전적으로 사이드카.

## 3. `src/risk.mjs` — 핵심 모듈

### 3.1 공개 인터페이스
```js
// 한 아이템 검사(캐시 우선). item = index.json의 항목.
export async function scanRisk(item, opts = {}) → RiskResult
// 여러 아이템 배치(동시성 제한). 반환: { [id]: RiskResult }
export async function scanRiskBatch(items, opts = {}) → Record<string, RiskResult>
// 엔진 가용성 프로브(1회 캐시): {engine:"docker"|"local"|"regex", version?}
export async function probeRiskEngine() → EngineInfo
// 캐시 로드(서버 /api/index 병합용)
export function loadRiskCache() → { version, results: Record<id, RiskResult> }
```
이중 진입: `node src/risk.mjs [--all|--id <id>|<path>]` 로 CLI 배치 실행(= 접근법 C 흡수,
나중 자동 보호루프의 디딤돌).

### 3.2 엔진 프로브 & 폴백 체인 (server.mjs:94 프로브 패턴 차용)
1. **Docker**: `docker image inspect skillspector` 성공 → docker 엔진.
2. **로컬**: `skillspector` PATH에 있거나 `tools/skillspector-src/.venv/Scripts/skillspector(.exe)` 존재 → local 엔진.
3. **regex**: 둘 다 없음 → scan.mjs의 `detectRisks` 로직 이식(network/shell/creds), `engine:"regex"`.
결과는 1회 프로브 후 메모리 캐시.

### 3.3 검사 대상 경로 해석 (`resolveTarget(item)`)
| kind | 대상 | 비고 |
|---|---|---|
| skill | `dirname(join(root, source.path))` (SKILL.md의 **디렉토리**) | 보조 스크립트/refs 포함 분석 |
| agent | `join(root, source.path)` (단일 .md) | (범위 D2상 MVP 제외, 인터페이스는 지원) |
| mcp (파일) | `join(root, source.path)` (.mcp.json) | 직접 스캔 |
| mcp (cc-config, `source.repo==="cc-config"`) | **임시 `.mcp.json` 합성** → `{mcpServers:{[name]:def}}` 만 담아 temp 디렉토리에 쓰고 스캔 | `~/.claude.json` 통째 스캔 금지(거대·타서버·유저데이터). meta로 def 복원 |
temp는 검사 후 삭제.

### 3.4 실행 (안전)
- Docker: `docker run --rm --network none -v "<target>:/scan:ro" skillspector scan /scan --no-llm --format json`
  - `--network none`(망 차단) + `:ro`(읽기전용 마운트) + 컨테이너 격리. Windows 경로는 docker 데몬 형식으로 변환.
- 로컬: `<bin> scan "<target>" --no-llm --format json` (stdout 또는 --output temp).
- 공통: `execFile`/`spawn` **인자배열**(인젝션 차단, server.mjs:526/404 패턴), `--no-llm`, 타임아웃 60s 후 kill(server.mjs:410 패턴), `windowsHide`.
- 동시성: 배치는 **max 3** 동시(174개 동시 스폰 방지).

### 3.5 파서 (`parseReport(json)`) — 방어적
SkillSpector export 스키마가 미문서화이므로 **여러 후보 필드명**을 관용 처리:
```
score  ← risk_score ?? riskScore ?? score ?? 0          // 0~100 클램프
level  ← (risk_severity ?? severity ?? "").toUpperCase() 정규화 → LOW|MEDIUM|HIGH|CRITICAL
                                                          // 없으면 score로 매핑(<25 LOW,<50 MED,<75 HIGH,else CRIT)
reco   ← risk_recommendation ?? null                     // SAFE|CAUTION|DO NOT INSTALL
findings ← (filtered_findings ?? findings ?? results ?? []).map(f => ({
   ruleId:   f.rule_id ?? f.ruleId ?? f.id ?? null,
   severity: (f.severity ?? "").toUpperCase(),
   message:  f.message ?? f.title ?? f.description ?? "",
   location: f.location ?? (f.file ? `${f.file}:${f.line ?? ""}` : null),
   confidence: f.confidence ?? null,
   category: f.category ?? f.rule_id ?? null
}))
```
파싱 실패(비JSON/타임아웃) → regex 폴백 + `note`. **실제 출력으로 파서를 검증**(테스트 §7).

### 3.6 RiskResult 정규화 형태
```js
{
  id, contentHash,            // 캐시 키 + 스테일 판정
  score,                      // 0~100
  level,                      // LOW|MEDIUM|HIGH|CRITICAL  (regex는 매핑: 카테고리수 기반)
  recommendation,             // string|null
  categories: string[],       // 고유 rule/category 모음 (배지 칩)
  findings: Finding[],        // 상세(패널)
  engine,                     // "skillspector(docker)"|"skillspector(local)"|"regex"
  scannedAt,                  // ISO (서버가 stamp — scan.mjs는 시간 못 넣지만 risk는 사이드카라 허용)
  note?                       // 폴백/부분실패 설명
}
```

## 4. 데이터 모델 — `data/risk.json`
```json
{ "version": 1,
  "results": { "<itemId>": { /* RiskResult */ } } }
```
gitignore 추가. 원자적 쓰기(tmp+rename, forge.mjs 선례).

### `/api/index` 병합
각 item에 `risk` 부착:
```
risk = cache.results[item.id]
if (risk && risk.contentHash !== item.contentHash) risk.stale = true   // "재검사 필요"
item.risk = risk ?? null
```
(`equipped`/`uses` 병합과 동일 위치.)

## 5. API 계약 (server.mjs)
| 메서드/경로 | 요청 | 응답 |
|---|---|---|
| `POST /api/risk-scan` | `{id}` 단건 / `{ids:[...]}` / `{all:true}` | `{ ok, results: {[id]: RiskResult}, engine }` |
| `GET /api/risk-engine` | — | `{ engine, version?, available:bool }` |
| `GET /api/index` (기존) | — | 각 item에 `risk` 병합(§4) |
`api.ts`(클라이언트)는 **서버 계약에 맞춤**(CLAUDE.md 불변규칙). 신규: `riskScan(idOrIds)`, `riskEngine()`.

## 6. 클라이언트 / UX
- `types/index.ts`: `Item.risk?: RiskResult`, `RiskResult`/`Finding` 타입 추가(기존 `risks?:string[]`는 유지/하위호환).
- **Card**: 우상단/스트립에 위험 배지 — level별 색(LOW 무표시·MED amber·HIGH orange·CRITICAL rose). `stale` 시 점선/물음표. 미검사 시 배지 없음(또는 "미검사" 고스트).
- **DetailPanel**(기존 risks 섹션 `DetailPanel.tsx:260` 확장): 위험점수 게이지 + level + recommendation + findings 목록(ruleId·severity·message·location). "위험검사" 버튼(미검사/스테일 시 강조).
- **Inventory/BatchBar**: "위험 일괄 검사" 버튼 → 진행률.
- **장착 경고**: equip 액션 시 `item.risk.level ∈ {HIGH,CRITICAL}` 또는 `recommendation==="DO NOT INSTALL"`이면 확인 모달(차단 아님, 진행 가능). D4.
- store: `riskScan(id)`/`riskScanBatch()` 액션, 결과를 items에 머지.
- 디자인 토큰은 `design.md`(라이트 SaaS) 따름 — `accent-rose`(#F43F5E)=위험, 색+텍스트+아이콘 병기(접근성).

## 7. 에러 처리 & 검증 전략
**에러 처리:** 엔진부재→regex 폴백(note). 타임아웃→kill+폴백. 파싱실패→폴백. cc-config temp 실패→skip+note. 모든 실패는 카드 검사를 막지 않음(부분성공 허용).

**검증(완료 증거):**
- **U1 단위**: `parseReport` — 실제 SkillSpector 출력 픽스처 + 합성 JSON으로 정규화 검증(vitest, `cd src/client`엔 무관하니 노드 테스트 또는 간이 assert). regex 폴백 경로는 SkillSpector 없이도 즉시 검증.
- **U1 통합**: `node src/risk.mjs --id <한 skill>` → RiskResult 출력 확인(폴백/도커 양쪽).
- **U2**: 서버 부팅 → `curl -XPOST /api/risk-scan {id}` 200 + 형태 확인. `/api/index`에 `risk` 병합 확인.
- **U3**: `npm run client:build` 통과 + 위험배지/패널 수동 확인.
- **도커 경로**: 이미지 빌드 후 한 스킬로 실제 `risk_score` 반환 확인(미빌드 시 regex 폴백으로 기능 보장).

## 8. 구현 단위 (분해)
- **U1** `src/risk.mjs` + `.gitignore`(data/risk.json) + `package.json` `"risk"` 스크립트. 증거: CLI 실행.
- **U2** server.mjs 3개 변경(엔드포인트·프로브·index 병합). 증거: curl.
- **U3** 클라이언트(types·api·Card·DetailPanel·Inventory·store·장착경고). 증거: build.
- **U4** 통합 1바퀴 + 진행로그 체크.
의존: U2←U1(인터페이스), U3←U2(API 계약). 계약이 이 스펙에 고정돼 병렬 착수 가능하나, 안전상 U1→U2→U3 순차+단위검증 권장.

## 9. 미해결/리스크
- SkillSpector export JSON 정확 스키마 미문서 → 파서 실검증 필수(§7). 빌드된 이미지로 1회 실측 후 필드 확정.
- Windows Docker 볼륨 마운트 경로 변환 — 검증에서 확인, 실패 시 로컬 venv 또는 regex로.
- cc-config MCP 합성 스캔의 유효성(SkillSpector가 단일서버 .mcp.json을 의미있게 보는지) — 실측 필요.
- 도커 콜드스타트(~1-2s/스캔) → 배치 동시성 3 + 캐시로 완화.
