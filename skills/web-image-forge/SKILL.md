---
name: web-image-forge
description: Use when building a website or game UI and you need real image assets — generate images from a prompt (via ChatGPT/gpt-image or Grok in a logged-in Chrome), then slice them into web-ready pieces (card art, icon sheets → individual icons, logos, backgrounds, and full UI-layout mockups cut into components). Trigger on "카드 아트 만들어", "아이콘 시트 잘라줘", "배경 생성", "UI 레이아웃 이미지", "이미지 슬라이스", "generate game card art", "slice this image into icons", "grok으로 이미지 생성".
---

# web-image-forge

프롬프트로 **게임/웹 이미지 자산**을 생성하고, 그걸 **잘라서(슬라이스)** 사이트에 바로 쓰는 스킬.
이미지 한 장을 통으로 쓰는 게 아니라 — 카드 아트 · 아이콘 시트 · 로고 · 배경 · UI 레이아웃 목업을
만들고 **조각으로 잘라** card/icon/bg/layout 으로 활용한다.

> **백엔드 선택:** ChatGPT(기본) 또는 **Grok** — `engine` 파라미터 하나로 전환.

## 무엇을 만드나 (프리셋)

| 프리셋 | 결과 | 추천 슬라이스 |
|--------|------|--------------|
| `card`   | 세로 게임 카드 아트 1장 | 그대로 사용 (1x1) |
| `icon`   | 4x4 아이콘 시트(16개) | **4x4 격자 분할** → 개별 아이콘 PNG |
| `logo`   | 정사각 로고(투명) | 1x1 |
| `bg`     | 16:9 배경, 중앙 비움 | 1x1 |
| `frame`  | 투명 카드 프레임(테두리만) | 1x1, 아트 위에 덧씌움 |
| `layout` | 풀 UI 레이아웃 목업 | **격자/드래그**로 패널·버튼 컷 |

프롬프트 문구는 `prompts.js`의 `buildPrompt(preset, ctx)`가 한국어 게임 톤으로 자동 구성한다.

## 작동 방식

1. **생성** — `lib/imagegen.js` 디스패처가 `engine` 파라미터에 따라 ChatGPT 또는 Grok 탭을 CDP로 조종해 이미지를 **호출자가 지정한 `outDir`에** 저장. (API 키 불필요)
   - `engine: "chatgpt"` (기본) → `lib/chrome.js` 사용, 파일명 `chatgpt-<timestamp>-<i>.png`
   - `engine: "grok"` → `lib/grok.js` 사용, 파일명 `grok-<timestamp>-<i>.png`
2. **슬라이스** — 브라우저 Canvas로 자른다(네이티브 의존성 0):
   - 드래그로 임의 영역 추출, 또는 `NxM` 격자 자동 분할.
   - 각 조각을 PNG로 저장(`/api/save-slice`) → `media/generated/`.
3. **반영** — 저장된 조각 URL을 카드 `image`, 아이콘, 배경 등에 바로 연결.

## 한 번 준비

```powershell
# 1) 의존성
cd skills/web-image-forge ; npm install
# 2) 디버그 Chrome 띄우기 (최초 1회, 이후 프로필 유지)
.\launch-chrome.ps1
# 3a) ChatGPT 쓰려면: chatgpt.com 로그인
# 3b) Grok 쓰려면:    grok.com 로그인 (X/Twitter 계정)
```

## 사용

- **Loadout 앱 안**: 우측 카드 상세 → `🎨 카드아트` → 이미지 작업실에서 생성/슬라이스. (서버가 `/api/generate`, `/api/save-slice` 제공)
- **독립 실행**: `slicer.html`을 열어 아무 이미지나 불러와 잘라 PNG로 저장. (생성 없이 슬라이스만 할 때)
- **코드에서 (디스패처 — 권장)**:
  ```js
  import { generate } from "./lib/imagegen.js";
  // ChatGPT 경로 (기본)
  const files = await generate({ engine: "chatgpt", prompt: "...", count: 1, outDir: "/abs/path/to/dir" });
  // Grok 경로
  const files = await generate({ engine: "grok", prompt: "...", count: 1, outDir: "/abs/path/to/dir" });
  // → [{ filename: "grok-1234567890-0.png", path: "/abs/path/to/dir/grok-1234567890-0.png" }]
  ```
- **코드에서 (저수준 ChatGPT)**:
  ```js
  import { connectChrome, newChat, sendPrompt, waitForImages, downloadImageBlob } from "./lib/chrome.js";
  import { buildPrompt } from "./prompts.js";
  const ctx = await connectChrome({});
  await newChat(ctx); await sendPrompt(ctx, buildPrompt("icon", {}));
  const imgs = await waitForImages(ctx, { expectedCount: 1 });
  // → downloadImageBlob → save → 4x4 슬라이스
  ```

## 트러블슈팅

### ChatGPT 백엔드
- **Chrome 미연결**: `launch-chrome.ps1` 먼저. 작업실 상단 점이 초록이어야 함.
- **로그인 벽**: Chrome 창에서 chatgpt.com 재로그인.
- **셀렉터 변경**으로 composer 못 찾으면 `lib/chrome.js`의 `COMPOSER_SELECTOR`/`SEND_BUTTON_SELECTOR` 갱신.

### Grok 백엔드
- **Grok 탭 없음** (`NO_GROK_TAB`): Chrome에서 grok.com을 열고 X/Twitter 계정으로 로그인 후 재시도.
- **입력창 못 찾음**: `lib/grok.js` 상단 `COMPOSER_SELECTOR` 상수를 현재 grok.com의 실제 셀렉터로 갱신.
- **이미지 감지 안 됨**: `lib/grok.js`의 `IMAGE_HOST_PATTERN` 상수에 grok CDN 호스트를 추가.
- **전송 버튼 오류**: `lib/grok.js`의 `SEND_BUTTON_SELECTOR` 상수 갱신.

### 공통
- **투명 PNG가 필요**한 아이콘은 프롬프트에 "투명 배경"을 유지하고, 단색 배경이면 슬라이스 후 후처리.
- **outDir 미지정**: `NO_OUT_DIR` 에러 — 항상 절대경로를 `outDir`에 전달해야 함.

> 원형: `D:/lab/side-project/slide-design`(슬라이드 최적화) 를 카드/아이콘/레이아웃용으로 변형.
