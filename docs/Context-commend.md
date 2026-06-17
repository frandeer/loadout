# `/context` 슬래시 명령

Claude Code REPL에서 컨텍스트 윈도우 사용량을 분석·시각화하는 슬래시 명령이다. API에 실제로 보내지는 뷰(컴팩트 경계, context collapse, microcompact 적용 후)를 기준으로 토큰을 집계한다.

## 명령 등록

| 모드 | 타입 | 파일 | 설명 |
|------|------|------|------|
| 인터랙티브 REPL | `local-jsx` | `src/commands/context/index.ts` → `context.tsx` | 컬러 그리드 시각화 |
| Non-interactive (`-p` 등) | `local` | `src/commands/context/index.ts` → `context-noninteractive.ts` | 마크다운 테이블 텍스트 |

전역 명령 목록: `src/commands.ts` (`context`, `contextNonInteractive`).

실행 경로: `src/utils/processUserInput/processSlashCommand.tsx`

- `local-jsx` → JSX `call(onDone, context, args)` (약 609행)
- `local` → `mod.call(args, context)` (약 657–669행)

## 실행 흐름

```
사용자 입력 "/context"
  → processSlashCommand.tsx
  → commands/context/index.ts
  → context.tsx (REPL) | context-noninteractive.ts (headless)
  → toApiView(messages) + microcompactMessages
  → analyzeContextUsage()
  → ContextVisualization (REPL) | formatContextAsMarkdownTable (headless)
```

### API 뷰 정렬 (`context.tsx`)

`/context`는 REPL raw 히스토리가 아니라 **모델이 보는 메시지**를 기준으로 한다.

1. `getMessagesAfterCompactBoundary(messages)`
2. (feature `CONTEXT_COLLAPSE`) `projectView()` — `services/contextCollapse/operations.js`
3. `microcompactMessages()`

## 분석 엔진: `analyzeContextUsage`

**파일:** `src/utils/analyzeContext.ts`

진입:

- REPL: `src/commands/context/context.tsx` → `call()`
- Headless / SDK: `src/commands/context/context-noninteractive.ts` → `collectContextData()` → `get_context_usage` 등과 공유

입력(런타임에서 이미 로드된 것):

| 인자 | 출처 |
|------|------|
| `messages` | 컴팩트/microcompact 적용 후 메시지 |
| `tools` | `context.options.tools` |
| `agentDefinitions` | `appState.agentDefinitions` |
| `getToolPermissionContext` | AppState |

`/context`는 **전용 디스크 스캐너가 없다.** 아래 카테고리별로 기존 로더·세션 상태를 재사용한다.

---

## 카테고리별 데이터 소스

### 1. Memory (파일 전체 읽음)

**함수:** `countMemoryFileTokens()` → `getMemoryFiles()` (`src/utils/claudemd.ts`)

**토큰:** 파일 **전체 내용**을 API 토큰 카운터로 측정.

| 타입 | 경로 (대표) |
|------|-------------|
| Managed | `<managed>/CLAUDE.md`, `<managed>/.claude/rules/*.md` |
| User | `~/.claude/CLAUDE.md` (`CLAUDE_CONFIG_DIR` 가능), `~/.claude/rules/*.md` |
| Project | CWD → git root 상향: `CLAUDE.md`, `.claude/CLAUDE.md`, `.claude/rules/*.md` |
| Local | `CLAUDE.local.md` |
| 추가 | `CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD` 시 `--add-dir`의 CLAUDE.md / `.claude/…` |
| AutoMem | feature 시 `memory.md` 등 (`getAutoMemEntrypoint`) |

**비활성:** `CLAUDE_CODE_SIMPLE`이면 memory 항목 0.

**UI:** Memory Files 테이블 (`path`, `type`, `tokens`).

> `.claude/skills`는 Memory가 **아니다.**

---

### 2. Skills (프론트매터만)

**함수:** `countSkillTokens()` → `getLimitedSkillToolCommands(cwd)` → `getSkillDirCommands()` (`src/skills/loadSkillsDir.ts`)

**토큰:** `name`, `description`, `whenToUse`만 (`estimateSkillFrontmatterTokens`). **SKILL.md 본문은 호출 시에만 로드.**

| 소스 | 경로 |
|------|------|
| Managed | `<managed>/.claude/skills/**/SKILL.md` |
| User | `~/.claude/skills/**/SKILL.md` |
| Project | `<repo>/.claude/skills/**/SKILL.md` (git root까지 `getProjectDirsUpToHome`) |
| Legacy | `.claude/commands/` (단일 `.md` 또는 `name/SKILL.md`) |
| Plugin / bundled | 플러그인·내장 스킬 로더 |
| `--add-dir` | `<dir>/.claude/skills` (bare 모드 등 조건부) |

**UI:** Skills 테이블 (이름, source, 추정 토큰).

**참고:** SkillTool 스키마 전체는 `countSlashCommandTokens()`와 겹칠 수 있어, 카테고리 합산 시 스킬 frontmatter는 system tools 쪽과 분리 표시한다 (`analyzeContext.ts` 주석).

---

### 3. Custom Agents (타입 + whenToUse만)

**함수:** `countCustomAgentTokens(agentDefinitions)`

**데이터:** 세션에 이미 로드된 `agentDefinitions.activeAgents` (`loadAgentsDir`, `src/tools/AgentTool/loadAgentsDir.ts`).

로드 경로 (`loadMarkdownFilesForSubdir('agents', cwd)`):

| 소스 | 경로 |
|------|------|
| Managed | `<managed>/.claude/agents/*.md` |
| User | `~/.claude/agents/*.md` |
| Project | `<repo>/.claude/agents/*.md` |
| Plugin | `loadPluginAgents()` |
| Built-in | 코드 내장 (explore, general-purpose, plan 등) |

**토큰:** `source !== 'built-in'`인 에이전트만. **`agentType` + `whenToUse` 문자열만** 카운트 — `.md`의 `prompt` 본문은 breakdown에 **포함되지 않음**.

**UI:** Custom Agents 테이블.

---

### 4. System prompt

**함수:** `countSystemTokens(effectiveSystemPrompt)`

`buildEffectiveSystemPrompt()` + `getSystemPrompt(tools, model)` (`src/utils/systemPrompt.ts`, `src/constants/prompts.js`).

설정·에이전트·`customSystemPrompt` / `appendSystemPrompt` 반영.

---

### 5. System tools (built-in)

**함수:** `countBuiltInToolTokens()`

런타임 `tools` 중 `!tool.isMcp`. Tool search deferred 도구는 별도 표시.

SkillTool은 Skills 카테고리와 겹치지 않도록 breakdown에서 제외할 수 있음 (ant-only per-tool breakdown).

---

### 6. MCP tools

**함수:** `countMcpToolTokens()`

연결된 MCP 서버의 도구 정의 (`tool.isMcp`). Tool search 시 deferred/loaded 구분.

**UI:** MCP Tools 테이블 (`name`, `serverName`, `tokens`).

---

### 7. Messages

**함수:** `approximateMessageTokens(messages)`

현재 대화 메시지(microcompact 후). Ant-only: tool call/result, attachment 등 상세 breakdown.

---

### 8. Slash commands (메타)

**함수:** `countSlashCommandTokens()`

SkillTool에 포함된 슬래시 명령 메타. 스킬 frontmatter와 도구 스키마 overhead는 이중 집계 주의.

---

## REPL vs Non-interactive 출력

| | REPL | Non-interactive |
|---|------|-----------------|
| 구현 | `context.tsx` | `context-noninteractive.ts` |
| 출력 | `ContextVisualization` → ANSI (`renderToAnsiString`) | `formatContextAsMarkdownTable()` |
| 컴포넌트 | `src/components/ContextVisualization.tsx` | — |
| 제안 | `src/utils/contextSuggestions.js` | — |

공유: `collectContextData()` / `analyzeContextUsage()`.

---

## 관련 파일 맵

```
src/commands/context/
  index.ts              # Command 정의 (name: 'context')
  context.tsx           # REPL 핸들러
  context-noninteractive.ts

src/utils/analyzeContext.ts    # 토큰 분석 핵심
src/utils/claudemd.ts          # getMemoryFiles (CLAUDE.md 계열)
src/skills/loadSkillsDir.ts    # .claude/skills, legacy commands
src/tools/AgentTool/loadAgentsDir.ts
src/utils/markdownConfigLoader.ts  # .claude/agents, .claude/commands walk
src/components/ContextVisualization.tsx
src/utils/processUserInput/processSlashCommand.tsx
src/commands.ts                # COMMANDS 배열 등록
```

---

## 자주 묻는 점

### `/context`가 `.claude/skills` 전체를 읽나?

아니다. 스킬 **디렉터리는 로드 목록**에 쓰이지만, 표시 토큰은 **프론트매터 추정**이다. 본문은 `/skill-name` 실행 시 로드된다.

### `.claude/agents/*.md` prompt는?

에이전트 정의 파일의 **prompt 본문은** `/context` 토큰 breakdown에 넣지 않는다. `agentType` + `whenToUse`만 집계한다.

### `context:fork`와 `/context`의 관계?

`/context` 명령 자체에는 `context: 'fork'` 옵션이 없다. `context:fork`는 **prompt 타입 스킬/슬래시**용 (`processSlashCommand.tsx` 727행, `types/command.ts`). 스케줄 태스크 등에서 스킬 fork 패턴으로 언급될 뿐 `/context`와 별개다.

### Memory와 Skills 구분

| | Memory | Skills |
|---|--------|--------|
| 경로 | `CLAUDE.md`, `.claude/rules`, … | `.claude/skills`, legacy `commands` |
| `/context` 측정 | 파일 전체 | 프론트매터만 |

---

## 환경·정책으로 빠질 수 있는 것

- `CLAUDE_CODE_SIMPLE` — memory 미표시
- `settingSources` / `isSettingSourceEnabled` — user/project/local 비활성
- `isRestrictedToPluginOnly('skills'|'agents')` — 플러그인 전용 정책
- `CLAUDE_CODE_DISABLE_POLICY_SKILLS` — managed 스킬 스킵
- git root 경계 — 상위 `~/.claude/commands`가 repo에 섞이지 않도록 `getProjectDirsUpToHome`에서 git root에서 stop
- nested worktree — Project `CLAUDE.md` 중복 로드 방지 (`claudemd.ts` 주석)

---

## 코드 인용 (핵심)

명령 정의:

```ts
// src/commands/context/index.ts
export const context: Command = {
  name: 'context',
  description: 'Visualize current context usage as a colored grid',
  type: 'local-jsx',
  load: () => import('./context.js'),
}
```

스킬 frontmatter만 카운트:

```ts
// src/utils/analyzeContext.ts (요지)
// full content is only loaded on invocation
const skillFrontmatter = skills.map(skill => ({
  name: getCommandName(skill),
  tokens: estimateSkillFrontmatterTokens(skill),
}))
```

커스텀 에이전트:

```ts
// src/utils/analyzeContext.ts (요지)
content: [agent.agentType, agent.whenToUse].join(' ')
```

스킬 디렉터리 로드:

```ts
// src/skills/loadSkillsDir.ts (요지)
// ~/.claude/skills, <managed>/.claude/skills, <repo>/.claude/skills
// legacy: .claude/commands/
```