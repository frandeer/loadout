// Design Forge · 생성 엔진 어댑터 + 프롬프트 빌더
// - HTML 생성: CLI 엔진(claude/codex/gemini) 헤드리스 호출(stdin→stdout). server.mjs의 runEngine과 동일 전략.
// - 이미지 생성: skills/web-image-forge/lib(CDP) 지연 로드.
// design-system의 4단계 프롬프트 전략(minimal/detailed/reference/system)과 스타일 프리셋을 차용하되,
// stub 어댑터 대신 loadout의 실제 CLI 셸아웃을 사용한다.
import { spawn } from "node:child_process";

// ---------- CLI 엔진 헤드리스 호출 ----------
// 프롬프트는 stdin으로 전달(Windows 멀티라인 -p 인자 잘림 회피). stdout 텍스트 반환, 실패시 null.
export function runCli(engine, prompt, timeoutMs = 120000) {
  return new Promise((resolve) => {
    let output = "", settled = false;
    const done = (v) => { if (!settled) { settled = true; resolve(v); } };
    let proc;
    try { proc = spawn(engine, ["-p"], { stdio: ["pipe", "pipe", "ignore"], shell: process.platform === "win32" }); }
    catch { return done(null); }
    proc.stdout.on("data", (c) => { output += c.toString("utf8"); });
    proc.on("close", () => done(output));
    proc.on("error", () => done(null));
    try { proc.stdin.write(prompt); proc.stdin.end(); } catch {}
    const timer = setTimeout(() => { try { proc.kill(); } catch {} done(null); }, timeoutMs);
    proc.on("close", () => clearTimeout(timer));
  });
}

const ENGINES = ["claude", "codex", "gemini", "grok"];
const ENGINE_ALIASES = { google: "gemini", openai: "codex", xai: "grok", anthropic: "claude" };
const _avail = new Map();
function normEngine(e) {
  const k = (e || "claude").toLowerCase();
  return ENGINE_ALIASES[k] || (ENGINES.includes(k) ? k : "claude");
}
export async function checkCliAvailable(engine) {
  engine = normEngine(engine);
  if (_avail.has(engine)) return _avail.get(engine);
  const ok = await new Promise((resolve) => {
    const cmd = process.platform === "win32" ? "where" : "which";
    const p = spawn(cmd, [engine], { stdio: "ignore", shell: true });
    p.on("close", (code) => resolve(code === 0));
    p.on("error", () => resolve(false));
    setTimeout(() => { try { p.kill(); } catch {} resolve(false); }, 3000);
  });
  _avail.set(engine, ok);
  return ok;
}
export async function availableClis() {
  const out = [];
  for (const e of ENGINES) if (await checkCliAvailable(e)) out.push(e);
  return out;
}

// ---------- 스타일 프리셋(design-system skills의 taste를 인라인으로 차용) ----------
// 외부 레포(skills/*)에 의존하지 않도록 loadout 내부에 스타일 플레이버를 정의한다.
export const STYLE_PRESETS = {
  frontend: {
    label: "Frontend Craft",
    guidance: "Distinctive, production-grade craft. Bold typographic scale, intentional whitespace, " +
      "tasteful micro-interactions. Avoid generic AI/bootstrap aesthetics — no centered hero with a single CTA cliché.",
  },
  taste: {
    label: "Supanova Taste",
    guidance: "Editorial, high-taste look. Strong type hierarchy, confident color, dense-but-legible layout. " +
      "Think award-winning agency landing page. Subtle texture and depth over flat minimalism.",
  },
  soft: {
    label: "Supanova Soft",
    guidance: "Soft, calm, friendly UI. Rounded corners, gentle gradients, airy spacing, muted pastel palette, " +
      "soft shadows. Approachable and modern, never harsh.",
  },
  reference: {
    label: "Reference-driven",
    guidance: "Emulate the structure and polish of best-in-class reference sites (Linear, Stripe, Vercel). " +
      "Clear sections, strong grid, refined dark/light theme tokens.",
  },
};

// ---------- 4단계 프롬프트 전략(design-system 차용) ----------
export const STRATEGIES = ["minimal", "detailed", "reference", "system"];

const QUALITY_REQS = [
  "## Quality Requirements",
  "- WCAG AA contrast (4.5:1 minimum for text)",
  "- All interactive elements have hover, focus, and active states",
  "- Responsive: works at 375px, 768px, 1024px, 1440px",
  "- Touch targets minimum 44x44px",
].join("\n");

const OUTPUT_FMT = [
  "## Output Format",
  "Output ONE self-contained HTML file. All CSS in a single <style> tag in <head>.",
  "No external dependencies, no CDN links, no remote image URLs.",
  "Use CSS gradients, inline SVG, or emoji for visual elements.",
  "Output ONLY the HTML document — start at <!DOCTYPE html>. No prose, no code fences.",
].join("\n");

// design-system harness/tokens 대신, 'system' 전략에서 주입할 기본 디자인 토큰 스캐폴드.
const SYSTEM_TOKENS = [
  "## Design System Constraints (use exactly these CSS custom properties)",
  ":root tokens — define and use them:",
  "  --color-bg, --color-surface, --color-text, --color-muted, --color-accent, --color-border",
  "  --space-1..8 (4px scale), --radius-sm/md/lg, --font-sans, --text-sm/base/lg/xl/2xl/3xl",
  "Every color/spacing/radius/font-size MUST reference a token (no magic numbers in component CSS).",
].join("\n");

/**
 * 프롬프트 빌더 — 전략 + 스타일 + 사용자 의도를 결합한 HTML 생성 프롬프트.
 * @param {object} o
 * @param {string} o.intent   - 사용자가 원하는 디자인 설명(한 줄~여러 줄)
 * @param {"minimal"|"detailed"|"reference"|"system"} o.strategy
 * @param {string} [o.style]  - STYLE_PRESETS 키
 * @param {string} [o.reference] - 참고 사이트/토큰(선택)
 */
export function buildHtmlPrompt({ intent, strategy = "detailed", style, reference }) {
  const layers = ["You are a senior product designer building a production-quality web page."];
  const preset = STYLE_PRESETS[style];
  if (preset) layers.push(`\n## Art Direction — ${preset.label}\n${preset.guidance}`);

  layers.push(`\n## Brief\n${intent}`);

  if (strategy === "detailed" || strategy === "reference" || strategy === "system") {
    layers.push([
      "\n## Layout Guidance",
      "- Establish a clear visual hierarchy: hero/header → primary content sections → footer.",
      "- Use a consistent spacing rhythm and a deliberate type scale.",
      "- Include realistic placeholder copy, not lorem ipsum where a real label fits.",
    ].join("\n"));
  }
  if (strategy === "reference") {
    layers.push(`\n## Reference\n${reference || "Draw on best-in-class modern SaaS landing pages for structure, polish, and spacing."}`);
  }
  if (strategy === "system") {
    layers.push("\n" + SYSTEM_TOKENS);
  }

  layers.push("\n" + QUALITY_REQS);
  layers.push("\n" + OUTPUT_FMT);
  return layers.join("\n");
}

// 이미지 생성용 프롬프트(같은 의도를 시각 디자인 시트로). 엔진별 미세 조정.
export function buildImagePrompt({ intent, style, engine = "chatgpt" }) {
  const preset = STYLE_PRESETS[style];
  const art = preset ? ` Art direction: ${preset.guidance}` : "";
  const base =
    `A high-fidelity UI/web design mockup for: ${intent}.${art} ` +
    `Clean realistic web page screenshot, desktop viewport, crisp typography, ` +
    `cohesive color palette, modern layout with clear hierarchy. Flat UI screenshot, not a photo.`;
  // grok은 짧고 직설적인 프롬프트에 더 잘 반응 → 약간 압축.
  return engine === "grok" ? base.replace(/\s+/g, " ").slice(0, 480) : base;
}

// ---------- HTML 추출 ----------
// CLI 출력에서 최외곽 HTML 문서만 뽑아낸다(코드펜스/설명 텍스트 제거). 실패시 원문 래핑.
export function extractHtml(output) {
  if (!output) return null;
  let s = output.replace(/```[\w]*\n?/g, "").trim();
  const lower = s.toLowerCase();
  const dt = lower.indexOf("<!doctype");
  const ht = lower.indexOf("<html");
  const start = dt >= 0 ? dt : ht;
  const end = lower.lastIndexOf("</html>");
  if (start >= 0 && end > start) return s.slice(start, end + 7);
  // <html>이 없지만 마크업처럼 보이면 최소 문서로 래핑
  if (s.includes("<") && s.includes(">")) {
    return `<!DOCTYPE html>\n<html lang="en"><head><meta charset="UTF-8">` +
      `<meta name="viewport" content="width=device-width, initial-scale=1.0"></head>\n<body>\n${s}\n</body></html>`;
  }
  return null;
}

/**
 * HTML 변형 1개 생성(CLI 셸아웃). 사용 가능한 엔진이 없으면 요청 엔진 → 대체 엔진.
 * @returns {Promise<{ok:boolean, engine:string, html?:string, error?:string, timeMs:number}>}
 */
export async function generateHtmlVariant({ engine, prompt, timeoutMs = 120000 }) {
  const started = Date.now();
  let eng = normEngine(engine);
  if (!(await checkCliAvailable(eng))) {
    const others = await availableClis();
    if (!others.length) return { ok: false, engine: eng, error: "사용 가능한 CLI 엔진 없음(claude/codex/gemini)", timeMs: 0 };
    eng = others[0];
  }
  const out = await runCli(eng, prompt, timeoutMs);
  const html = extractHtml(out);
  const timeMs = Date.now() - started;
  if (!html) return { ok: false, engine: eng, error: "엔진 출력에서 HTML을 추출하지 못함(타임아웃/형식)", timeMs };
  return { ok: true, engine: eng, html, timeMs };
}

/**
 * 이미지 변형 1개 생성(CDP). chatgpt/grok 지원. google은 드라이버 미구현 → 안내 에러.
 * @returns {Promise<{ok:boolean, engine:string, files?:Array, error?:string, timeMs:number}>}
 */
export async function generateImageVariant({ engine = "chatgpt", prompt, outDir }) {
  const started = Date.now();
  const eng = (engine || "chatgpt").toLowerCase();
  if (eng === "google") {
    return { ok: false, engine: eng, error: "Google 이미지 드라이버는 아직 미구현입니다(로드맵).", timeMs: 0 };
  }
  let gen;
  try { ({ generate: gen } = await import("../skills/web-image-forge/lib/imagegen.js")); }
  catch (e) { return { ok: false, engine: eng, error: "이미지 모듈 로드 실패(npm i chrome-remote-interface): " + e.message, timeMs: 0 }; }
  try {
    const files = await gen({ engine: eng === "grok" ? "grok" : "chatgpt", prompt, count: 1, outDir });
    return { ok: files.length > 0, engine: eng, files, timeMs: Date.now() - started };
  } catch (e) {
    const hint = e.code === "NO_CHATGPT_TAB" || e.code === "NO_GROK_TAB"
      ? `${eng === "grok" ? "grok.com" : "chatgpt.com"} 탭이 없습니다 — launch-chrome 실행 후 로그인하세요.`
      : "이미지 생성 실패: " + e.message;
    return { ok: false, engine: eng, error: hint, timeMs: Date.now() - started };
  }
}
