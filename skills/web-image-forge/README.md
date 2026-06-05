# web-image-forge

프롬프트로 게임/웹 이미지 자산을 생성하고 **슬라이스**해서 사이트에 쓰는 스킬.
자세한 사용법은 [SKILL.md](SKILL.md) 참고.

## 빠른 시작

```powershell
npm install              # chrome-remote-interface
.\launch-chrome.ps1      # 디버그 Chrome 실행 (최초 1회)
# ChatGPT 쓰려면: chatgpt.com 로그인
# Grok 쓰려면:    grok.com 로그인 (X/Twitter 계정)
```

```bash
npm install
chmod +x ./launch-chrome.sh
./launch-chrome.sh       # Linux/macOS/WSL 디버그 Chrome 실행
```

- 생성+슬라이스: Loadout 앱의 🎨 이미지 작업실 (서버 API 사용)
- 슬라이스만(서버 불필요): `slicer.html` 더블클릭 → 이미지 불러와 격자/드래그로 잘라 PNG 저장

## 파일

| 파일 | 역할 |
|------|------|
| `SKILL.md` | 스킬 정의 + 사용법 |
| `lib/imagegen.js` | **백엔드 디스패처** — `generate({ engine, prompt, count, outDir })` |
| `lib/chrome.js` | CDP로 ChatGPT 조종 → 이미지 생성/다운로드 |
| `lib/grok.js` | CDP로 Grok 조종 → 이미지 생성/다운로드 |
| `lib/save.js` | base64 → 파일 저장 |
| `prompts.js` | 카드/아이콘/로고/BG/레이아웃 프롬프트 빌더 |
| `slicer.html` | 독립 실행 캔버스 슬라이서 (무의존) |
| `launch-chrome.ps1` | 디버그 Chrome 실행 |
| `launch-chrome.sh` | Linux/macOS/WSL용 디버그 Chrome 실행 |
