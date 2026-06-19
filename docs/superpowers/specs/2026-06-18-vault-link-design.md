# Loadout Vault + Link 관리 — 설계 스펙 (2026-06-18)

> Phase E of [docs/11-evolving-system.md](../../11-evolving-system.md). 핵심 목표(컨텍스트 on/off).
> 살아있는 스펙. 안전 최우선: **무손실 · 무삭제 · 검증+롤백**.

## 1. 목표

`~/.claude`에 상주(99개 실폴더, 끌 수 없음)하는 스킬/에이전트/MCP를 **Loadout vault로 모두 가져와
관리**하고, **링크 기반 on/off**로 컨텍스트를 통제한다. **Windows·Mac 동일 동작.**

## 2. 모델 — 소유권 반전

```
현재:  ~/.claude/skills = 원본(상주) → off 불가
목표:  vault = 원본·진실의 단일 출처 (scan이 여기를 읽음)
       ~/.claude/skills/<name> = 링크(켠 것만) → vault
       켜기 = 링크 생성 / 끄기 = 링크 제거(vault 보존)
```
import 후 **scan 소스루트를 `~/.claude/skills` → vault로 전환**(이중 카탈로그 방지).
`~/.claude`는 source가 아니라 **activation surface**가 된다.

## 3. 3-kind 통합 (vault 하나, 활성화 메커니즘만 분기)

| kind | vault 저장 | 켜기 | 끄기 | Windows | Mac/Linux |
|---|---|---|---|---|---|
| **skill**(폴더) | 폴더 복사 | 링크 생성 | 링크 제거 | junction | symlink(dir) |
| **agent**(파일) | .md 복사 | 활성화 | 비활성화 | **복사**(파일심링크=관리자필요) | symlink(file) |
| **mcp**(설정) | 서버 정의 JSON | `claude mcp add-json` | `claude mcp remove` | (CLI 공통) | (CLI 공통) |

현황: agent 0개(준비만), mcp on/off는 Phase1서 구현됨(vault는 정의저장=무손실만 추가), skill이 본체.

### 3.1 크로스플랫폼 링크 프리미티브 (`src/vault.mjs`)
```js
function activate(kind, src, dest) {            // src=vault, dest=~/.claude/...
  if (kind === 'skill') {                       // 폴더
    fs.symlinkSync(src, dest, process.platform === 'win32' ? 'junction' : 'dir');
  } else if (kind === 'agent') {                // 파일
    if (process.platform === 'win32') fs.cpSync(src, dest);     // 복사(관리자 회피)
    else fs.symlinkSync(src, dest, 'file');
  }
}
function deactivate(dest) {                      // 링크/복사본만 제거, vault 불가침
  const st = fs.lstatSync(dest);
  if (st.isSymbolicLink()) fs.unlinkSync(dest);
  else if (isJunction(dest)) fs.rmSync(dest, { recursive:false });  // junction 제거(타겟 보존)
  else moveToBackup(dest);                       // 상주 실폴더 → 백업 이동(삭제 아님)
}
```
junction/크로스볼륨(C:→D:) 검증 완료. 기존 equip 메커니즘(검증됨) 확장.

## 4. 분기(divergence) 감지 + 버전 선택 (요구 1·2)

```
per skill 상태:
  vaultHash = hash(vault/<name>)              // vault에 있으면
  liveHash  = hash(~/.claude/skills/<name>)   // 실폴더로 존재하면(우리 링크 제외)
  - vault만        → 'vault-only'
  - live만         → 'unmanaged'(가져오기 후보)
  - 둘 다 동일      → 'in-sync'
  - 둘 다 다름      → 'divergent'  ← 충돌. 사용자 선택:
        ① pull: live → vault (플러그인이 ~/.claude에 넣은 최신본을 vault로 당김)
        ② push: vault → live (vault판으로 링크/덮어쓰기)
```
플러그인 갱신 = live가 더 최신인 'divergent' → ① pull 추천. 자동 적용 안 함(항상 사용자 선택).
해시는 scan의 `contentHash`(head 4000자+size) 대신 **전체 디렉토리 해시**(파일목록+크기+내용) — 정확도 위해.

## 5. 안전 모델 (무손실·무삭제·검증)

- **E1 import = 순수 복사**. 원본 무손상. 되돌리기 = vault 삭제.
- **이동은 backup 경유**: 끄기/링크전환 시 상주 실폴더는 `~/.claude/.loadout-backup/<ts>/`로 **이동**, 하드삭제 0.
- **dry-run**: 모든 변형 작업은 미리보기 모드 우선.
- **검증+롤백**: 각 작업 후 결과 확인, 실패 시 백업 복원.
- **플러그인 소유 감지**: 외부 도구가 갱신하는 스킬은 'divergent' 빈발 → 경고, 강제 링크전환 지양.

## 6. 데이터 / API
- `data/vault.json`(gitignore): `{ version, items: { [id]: { inVault, vaultPath, claudeState, vaultHash, liveHash, divergent } } }`. 원자적 쓰기(tmp+rename).
- `vault/`(gitignore): `vault/skills/<owner>__<name>/`, `vault/agents/<name>.md`, `vault/mcp/<name>.json`.
- `GET /api/vault/status` — 전 아이템 vault/링크/분기 상태.
- `POST /api/vault/import {ids?|all, dryRun?}` — E1 복사 가져오기.
- `POST /api/vault/activate {id, on}` — E2 링크 on/off(dryRun 지원).
- `POST /api/vault/resolve {id, choice:'pull'|'push'}` — 분기 해소.
- scan: import 완료 후 sources.json 루트 전환(`~/.claude/skills` → vault).

## 7. 단위 분해 (안전 순서)
- **E1**(무위험): `src/vault.mjs`(import·status·해시·크로스플랫폼 프리미티브) + `/api/vault/status|import` + gitignore. **복사·읽기만, 실데이터 링크/이동 없음.** 증거: status 출력 + dry-run + 샘플 1개 복사 해시일치.
- **E2**(주의): activate/deactivate를 **샌드박스에서 검증** → dry-run을 사용자에 제시 → 승인 후 실데이터. 백업+롤백.
- **E3**: 분기 해소 UI + 플러그인 감지 + scan 루트 전환 + 인벤토리 on/off 토글.
- **E4**: Mac 실검증(symlink 경로).

## 8. 검증 전략
- E1: `node src/vault.mjs --status`(읽기전용), `--import --dry-run`, 샘플 import 후 `hashDir(vault)==hashDir(원본)`. 원본 무손상 확인.
- E2: 임시 디렉토리에 가짜 skill로 activate→읽기확인→deactivate→복원 확인(양 OS 분기 코드 경로).
- E3: 분기 시나리오(내용 1바이트 변경) → 'divergent' 뜨고 pull/push 동작.
- 서버 zero-dep 유지, Node 빌트인만.

## 9. 미해결/리스크
- **D7 vault 위치** = `D:\lab\loadout\vault\`(프로젝트 내, gitignore). 크로스볼륨 junction 검증됨. (C: 동일볼륨 대안 가능)
- **D8 안전선**: 에이전트는 메커니즘 구축·검증까지. 실제 99개 링크전환/이동은 dry-run + 사용자 게이트.
- scan MCP 감지 누락(현재 카탈로그 mcp:0) — 별도 점검.
- 플러그인이 junction 위에 덮어쓸 때 거동 — E2 실검증 필요.
- Mac 실기기 검증은 E4(현재 Windows 환경).

---

## 10. 구현 현황 (2026-06-18) — 검증 완료

핵심 목표(컨텍스트 on/off)가 **실제 작동**한다. API e2e 12/12 PASS, 샌드박스 4/4 PASS.

### 확정된 설계 변경(구현 중 발견·반영)
- **D-LAZY (오버사이즈 지연 가져오기)**: gstack(1.5GB)/browse(110MB)는 import하지 않고 `~/.claude`에 상주 유지.
  **끌 때만** vault로 무손실 MOVE(`setActive(off, onResident:'vault')` → `moveToVault`: 복사→해시검증→원본삭제).
  켜면 vault에서 junction 재링크(이후엔 상주 아닌 링크). 사용자가 끄기 전엔 1.5GB를 건드리지 않음.
- **D-SCAN-VAULT (스캔이 vault를 읽음)**: Windows에서 junction은 Node `readdir`가 symlink로 보고
  `isDirectory()===false` → **scan이 junction을 따라가지 않는다**(실측). 따라서 cutover 후 `~/.claude/skills`만
  스캔하면 관리 스킬 95개가 사라진다. 해결: `data/sources.json` roots에 `vault/skills`·`vault/agents` 추가.
  vault 폴더는 실디렉토리라 스캔됨 → on/off 무관하게 항상 카탈로그에 존재. `~/.claude`는 junction이 스킵되어
  **미관리 상주(gstack/browse)만** 기여 → 이중 카탈로그 없음.
- **D-REKEY (vault-구조 id)**: vault 스캔 id는 `<leaf>/<leaf>/SKILL.md`(leaf=`<owner>__<name>`). `data/vault.json`을
  이 id로 일괄 재키(`tools/vault-rekey.mjs`, 백업 `vault.json.bak-rekey`). lazy-move 시에도 서버가 새 leaf로 재키.
- **D-OVERLAY (서버 오버레이)**: `GET /api/index`가 항목마다 `managed`/`claudeState`/`equipped`/`oversized`/`divergent`를
  vault.json + 라이브 존재검사(`vault.liveState`, 해시 없음)로 주입. 관리 항목의 라이브 자리가 link 아닌 **resident면
  divergent**(외부/플러그인 덮어씀 신호) → UI에서 pull/push 해소. 끈 항목은 vault 스캔으로 유지되므로 스냅샷 주입은
  안전망(중복 가드).

### 엔드포인트(최종)
- `GET /api/vault/status`(읽기전용 해시 포함), `POST /api/vault/import`, `POST /api/vault/activate {id,on,dryRun}`
  (관리=링크 토글 / 미관리 상주=vault로 lazy MOVE, `onResident:'vault'`, await 필수), `POST /api/vault/resolve {id,choice}`,
  `POST /api/vault/cutover`(이중 게이트 `dryRun:false && confirm:true`).

### 검증 증거
- `tools/vault-lazy-test.mjs` 4/4(move 무손실·OFF→ON·pull·dryRun), `tools/vault-verify.mjs` 12/12
  (rescan 후에도 95 관리=link, 끈 항목 vault 스캔 유지, 무손실·가역 토글, gstack lazy=move-to-vault dryRun).
- 파일시스템: `~/.claude/skills` junction 95→vault 물리적 보존, 원본 95개 `~/.claude/.loadout-backup/` 보관.

### 남은 폴리시(비차단)
- `/api/vault/status`의 status()는 livePath를 `source.path` 기준으로 유도 → vault 스캔본에선 부정확(진단용
  보조 지표만; 권위는 `/api/index` 오버레이). 추후 liveName 기반으로 정렬 가능.
- 끈 항목 카드의 한국어/아트는 raw 스냅샷이라 미반영 가능(기능엔 무영향).
- agent/mcp vault 경로는 메커니즘만 준비(현재 대상 0). Mac symlink 경로는 코드상 분기 존재, 실기 검증은 E4.
