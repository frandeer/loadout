import type { Item, Rarity } from "../types";

/** 아이콘 카테고리 매칭 패턴 — 모듈 로드 시 1회 컴파일(렌더마다 new RegExp 생성 방지). */
const ICON_PATTERNS: [RegExp, string][] = [
  [/pdf|doc/, "docs"], [/design/, "design"], [/debug/, "debug"],
  [/test/, "test"], [/security/, "security"], [/game/, "game"],
  [/data/, "data"], [/web/, "web"], [/api/, "api"], [/git/, "git"],
  [/deploy/, "deploy"], [/image/, "image"], [/music|audio/, "audio"],
  [/video/, "video"], [/ml|ai|model/, "ai"], [/search/, "search"],
  [/plan/, "plan"], [/write/, "writing"], [/memory/, "memory"],
  [/slide/, "slides"], [/review/, "review"],
];

export function iconFor(it: Item): string {
  if (it.kind === "agent") return "agent";
  if (it.kind === "mcp") return "module";
  const t = `${it.name} ${it.category ?? ""} ${it.description}`.toLowerCase();
  for (const [re, e] of ICON_PATTERNS) if (re.test(t)) return e;
  return "util";
}

/** 카드 설명의 언어 선택 — ko이고 descKo가 있으면 그걸, 아니면 기본 description.
 *  Card·CompactCard·DetailPanel에서 동일하게 쓰던 분기를 한 곳으로 모음. */
export function pickDesc(it: Item, lang: string): string {
  return lang === "ko" && it.descKo ? it.descKo : it.description;
}

export function summarize(text: string, max = 110): string {
  let s = (text || "").replace(/\s+/g, " ").trim();
  if (!s) return "";
  s = s.replace(
    /\s*(Use (this )?(skill )?when|Trigger|사용 시점|사용할 때|이럴 때 사용|언제 사용)\b.*$/i,
    "",
  ).trim() || s;
  const stop = s.search(/[.。!?！？]\s|[.。!?！?]$|\n/);
  if (stop > 24) s = s.slice(0, stop + 1).trim();
  if (s.length > max) s = s.slice(0, max - 1).trimEnd() + "\u2026";
  return s;
}

/** hex(#RRGGBB) \u2192 rgba \ubb38\uc790\uc5f4. \ub808\uc5b4\ub3c4 \uc0c9 \ud558\ub098\ub97c \uc54c\ud30c\ub9cc \ubc14\uafd4 \ud14c\ub450\ub9ac\u00b7\ub9c1\u00b7\uae00\ub85c\uc6b0\ub85c \uc7ac\uc0ac\uc6a9\ud55c\ub2e4. */
export function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** \ub808\uc5b4\ub3c4 \ub4f1\uae09 \u2192 \ud504\ub808\uc784 \uac15\ub3c4(0=common ~ 4=legendary).
 *  \ub8e8\ud130\uc288\ud130\ucc98\ub7fc \ub4f1\uae09\uc774 \ub192\uc744\uc218\ub85d \ud14c\ub450\ub9ac\uac00 \uc9c4\ud574\uc9c0\uace0 \ubc14\uae65 \uae00\ub85c\uc6b0\uac00 \ubd99\ub294\ub2e4.
 *  common(D)\uc740 0 \u2192 \ubb34\ucc44\uc0c9 \uae30\ubcf8 hairline\uc744 \uc720\uc9c0\ud574 \ud76c\uadc0 \ub4f1\uae09\uc774 \ub3c4\ub4dc\ub77c\uc9c0\uac8c \ud55c\ub2e4. */
const RARITY_FRAME_TIER: Record<Rarity, number> = {
  legendary: 4,
  epic: 3,
  rare: 2,
  uncommon: 1,
  common: 0,
};

const EQUIPPED_RING = "0 0 0 1.5px rgba(16, 185, 129, 0.5)"; // accent-emerald, \uc7a5\ucc29 \ud45c\uc2dc

/** \uce74\ub4dc \ub8e8\ud2b8\uc5d0 \uc778\ub77c\uc778\uc73c\ub85c \uc904 \ub808\uc5b4\ub3c4 \ud504\ub808\uc784 \uc2a4\ud0c0\uc77c(borderColor + boxShadow).
 *  - \uc120\ud0dd(isSelected) \uc0c1\ud0dc\uc5d0\uc11c\ub294 \ud638\ucd9c\ud558\uc9c0 \uc54a\ub294\ub2e4(\uc120\ud0dd \ud14c\ub450\ub9ac\uac00 \uc6b0\uc120).
 *  - \uc778\ub77c\uc778 boxShadow\ub294 Tailwind ring \uc720\ud2f8\uc744 \ub36e\uc5b4\uc4f0\ubbc0\ub85c, \uc7a5\ucc29 \ub9c1\ub3c4 \uc5ec\uae30\uc11c \ud569\uc131\ud55c\ub2e4.
 *  - common\uc740 \ube48 \uac1d\uccb4\ub97c \ubc18\ud658 \u2192 \ud638\ucd9c\ubd80\uac00 \uae30\ubcf8 hairline \ud074\ub798\uc2a4\ub85c \ud3f4\ubc31. */
export function rarityFrame(
  rarity: Rarity,
  color: string,
  opts: { equipped?: boolean; glow?: boolean } = {},
): { borderColor?: string; boxShadow?: string } {
  const tier = RARITY_FRAME_TIER[rarity];
  const shadows: string[] = [];
  if (opts.equipped) shadows.push(EQUIPPED_RING);

  let borderColor: string | undefined;
  if (tier > 0) {
    borderColor = hexToRgba(color, 0.28 + tier * 0.1); // C .38 \u2192 B .48 \u2192 A .58 \u2192 S .68
    // \ubcf4\uac15\uc6a9 1px \ub9c1\uc740 \uc81c\uac70 \u2014 1px border\uc640 \uacb9\uccd0 \ud14c\ub450\ub9ac\uac00 2\uc904\ub85c \ubcf4\uc600\ub2e4(\uc0ac\uc774\ub85c \ud770 \ubc30\uacbd\uc774 \ube44\uce68).
    if (tier >= 3 && opts.glow !== false) {
      // epic\u2191 \ubd80\ud130\ub9cc \ubc14\uae65 \uae00\ub85c\uc6b0 \u2014 \ubb35\uc9c1\ud55c "\uc804\ub9ac\ud488" \ub290\ub08c. \uc870\ubc00 \ubdf0\ub294 glow:false\ub85c \ub048\ub2e4.
      shadows.push(`0 10px ${12 + tier * 4}px ${hexToRgba(color, 0.05 + (tier - 2) * 0.045)}`);
    }
  }

  const out: { borderColor?: string; boxShadow?: string } = {};
  if (borderColor) out.borderColor = borderColor;
  if (shadows.length) out.boxShadow = shadows.join(", ");
  return out;
}

/** 레벨 산출.
 *  uses가 있으면 경험치 곡선 LV = min(99, 1 + floor(sqrt(uses))).
 *  uses가 undefined/0이면 기존 power 기반 폴백 유지(하위 호환). */
export function computeLevel(power: number, uses?: number): number {
  if (uses && uses > 0) return Math.min(99, 1 + Math.floor(Math.sqrt(uses)));
  return Math.max(1, Math.round((power || 50) / 12));
}

/** uses 기반 XP 진행도(0~100%). LV 경계는 (lv-1)² ~ lv² 사용. uses 없으면 null. */
export function computeXp(uses?: number): number | null {
  if (!uses || uses <= 0) return null;
  const lv = Math.min(99, 1 + Math.floor(Math.sqrt(uses)));
  if (lv >= 99) return 100;
  const prev = (lv - 1) * (lv - 1);   // 현재 레벨 진입 경계
  const next = lv * lv;               // 다음 레벨 경계
  return Math.max(0, Math.min(100, ((uses - prev) / (next - prev)) * 100));
}

/** 토큰 수 축약 표기 — 1234 → "1.2k", 24000 → "24k" */
export function formatK(n: number): string {
  if (n < 1000) return `${n}`;
  const k = n / 1000;
  return `${k >= 10 ? Math.round(k) : k.toFixed(1)}k`;
}

/** 클립보드 복사 — Clipboard API 우선, 비보안 컨텍스트 등 거부 시 execCommand 폴백. */
export async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); } finally { ta.remove(); }
  }
}

const FAV_KEY = "loadout-fav";

export function loadFavorites(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(FAV_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

export function saveFavorites(favs: Set<string>): void {
  localStorage.setItem(FAV_KEY, JSON.stringify([...favs]));
}

export function getTheme(): "light" | "dark" {
  return (localStorage.getItem("loadout-theme") as "light" | "dark") || "light";
}

export function setTheme(t: "light" | "dark"): void {
  localStorage.setItem("loadout-theme", t);
  document.documentElement.dataset.theme = t;
}

const ORBITAL_MONITOR_STYLE =
  "밝고 깔끔한 플랫 아이콘 일러스트. 흰색~아주 옅은 하늘색 단색 배경(격자는 생략하거나 거의 안 보이게), 단순하고 또렷한 플랫 라인 아이콘, 넉넉한 여백, 부드럽고 절제된 그림자. SHIP은 차분한 launch blue, MONITOR는 안정적인 orbit green 포인트 컬러. 친근하지만 진중한 엔지니어링 문서 톤. 빽빽한 디테일·여러 오브젝트 나열·과한 네온·어두운 군사 콘솔·홀로그램·실제 로고·국기·무기·군인·긴 문자는 없음.";

export function promptFor(preset: string, it: Item, lang: "ko" | "en" = "ko"): string {
  const dispName = it ? (lang === "ko" && it.nameKo ? it.nameKo : it.displayName) : "generic mission asset";
  const dispDesc = it ? (lang === "ko" && it.descKo ? it.descKo : it.description) : "";
  const itemName = dispName || it.name;
  const itemDesc = (dispDesc || "").replace(/\s+/g, " ").slice(0, 360);
  const itemTools = it?.meta?.allowedTools ? [].concat(it.meta.allowedTools as any).join(", ").slice(0, 160) : "";
  const itemSource = it?.source ? `${it.source.owner}/${it.source.repo}/${it.source.path}`.slice(0, 180) : "";
  const itemRole = it
    ? it.kind === "skill"
      ? "skill/procedure"
      : it.kind === "mcp"
        ? "MCP support module/tool connector"
        : "agent/operator"
    : "mission asset";
  const subject = it
    ? `Internal reference only, never render as text: asset name "${itemName}", type ${itemRole}, category ${it.category}, purpose ${itemDesc || "No description provided."}, clues ${itemTools || itemSource || "none"}`
    : "generic mission asset";
  const laneAccent = it
    ? it.kind === "mcp" || it.rarity === "legendary" || it.rarity === "uncommon"
      ? "orbit green MONITOR lane"
      : "launch blue SHIP lane"
    : "launch blue SHIP lane and orbit green MONITOR lane";
  const identityRule =
    "Translate the asset's name and description into a visual metaphor. Do not copy the tool name into the image. Show objects, actions, state changes, before/after cues, arrows, plugs, shields, windows, servers, charts, or other visual symbols that explain the purpose. Make the purpose recognizable at a glance with ONE single clear, flat, literal icon-like scene. Good examples: abstract color chips for design, an unlabeled terminal shape for code, a magnifier over a page for review/search, a shield or lock for security, an unlabeled bar/line chart or database for data, a stacked server for infra, a glowing node for AI, a plug/connector for an MCP module, an operator badge or small robot for an agent, and a browser window ONLY when the asset itself is a browser or web page. Prefer a distinctive silhouette unique to THIS asset so cards stay distinguishable at thumbnail size. If the name implies an upgrade/version/migration, add a clear directional cue like a bold up-arrow, but do not write version text. Pick the single best-fitting visual metaphor. Keep it simple: one focal subject, clean light background, balanced margin, flat minimal style. Text rule: no title, no tool name, no speech bubble, no object labels, no screen text, no command text, no code text, no gauge letters, no numbers, no pseudo-text. Allow exactly one small bottom caption only: 2-5 plain words, core idea only, no punctuation.";

  const P: Record<string, string> = {
    card: `Simple, clean, flat icon-style card art for this exact Loadout asset. ${subject}. ${identityRule} ${ORBITAL_MONITOR_STYLE}. Compose ONE large, simple central visual metaphor that depicts what the asset does; size the single subject large and consistent so it fills roughly 70% of the frame with only a comfortable margin — never a tiny object floating in a big empty field. Use ${laneAccent} only as a restrained accent. Keep it minimal and uncluttered — no dense telemetry, no crowded diagrams, no multiple competing objects. Borderless edge-to-edge graphic, no outer card frame, no generic stock image, no title, no tool name. Add only one short bottom caption with the core idea, not a sentence.`,
    icon: `항공우주 운영용 아이콘 시트 1장(4x4 격자, 16개). ${ORBITAL_MONITOR_STYLE}. 각 칸은 로켓, 체크리스트, 업로드 구름, 성능 게이지, 위성, 문서 동기화, 모델 비교, 레이더 상태 아이콘. 균일한 셀 크기, 밝은 배경, 또렷한 파란/초록 라인.`,
    logo: `A premium, modern app logo emblem for a mission-control deck called LOADOUT. One bold central mark: a sleek stylized rocket lifting off along a dotted telemetry arc that curves up to a glowing orbit node with a small satellite, evoking launch then monitor. Palette: launch blue (#2E73DF) and orbit green (#22965A) on a clean white to pale-blue background. Flat geometric crisp vector style with subtle depth and soft shadow, rounded-square app-icon composition, centered with generous padding and balanced negative space, polished and confident like a top tech brand mark. No text, no letters, no words, no military insignia, no clutter. 1:1 square.`,
    bg: `Wide 16:9 SHIP MONITOR dashboard background. ${ORBITAL_MONITOR_STYLE}. Left rocket launch pad impression, center dotted orbital arc, right satellite over earth horizon, plenty of empty central space for UI panels, bright blueprint grid.`,
    layout: `Full 16:9 web dashboard mockup in the style of gstack SHIP MONITOR. ${ORBITAL_MONITOR_STYLE}. Two large operation panels: blue SHIP checklist lane and green MONITOR telemetry lane, top breadcrumb capsule, rocket-to-satellite orbital arc hero.`,
    sprite: `Bright blueprint UI sprite sheet, 5x4 grid. ${ORBITAL_MONITOR_STYLE}. Buttons, checklist rows, status chips, telemetry dots, module slots, launch queue badges, orbit monitor badges. Crisp web-ready components.`,
  };
  return P[preset] || P.card;
}

// ── 카드 아트 프롬프트 ──────────────────────────────────────────────
// codex-api / codex 경로용. 핵심 의미를 정확하게 전달하는 플랫 일러스트.
const DOODLE_STYLE =
  "Clean flat-style illustration on a solid off-white background — NO grid, NO paper texture, NO background clutter. " +
  "Crisp outlines, flat fills with subtle depth, professional yet approachable. NOT cartoonish or overly cute — think technical illustration meets infographic icon. " +
  "ONE focused visual metaphor: the single most essential concept, depicted with precision and clarity, legible even as a small thumbnail.";

const RARITY_HIGHLIGHT: Record<Rarity, string> = {
  legendary: "amber/gold",
  epic: "violet",
  rare: "sky blue",
  uncommon: "light green",
  common: "light grey",
};

// description 을 비유 소재로 정리: 끝의 "(...)" 꼬리표·"Use when/this/it ..." 트리거 절 제거 후 첫 문장.
function cleanDescEn(s: string): string {
  let t = (s || "").replace(/\s+/g, " ").trim();
  t = t.replace(/\s*\([^)]*\)\s*$/g, "");
  t = t.split(/\s+Use\s+(?:when|this|it)\b/i)[0];
  const first = t.match(/^.*?[.!?](?=\s|$)/);
  return (first ? first[0] : t).replace(/[.\s]+$/, "").trim();
}

export function doodlePrompt(it: Item, lang: "ko" | "en" = "ko"): string {
  const name = it.name;
  const descEn = cleanDescEn(it.description) || it.category || "a helpful tool";
  const hl = RARITY_HIGHLIGHT[it.rarity] || "light grey";
  const localizedHint = lang === "ko" && it.descKo ? ` Korean context for interpretation only, never render as text: ${it.descKo.replace(/\s+/g, " ").trim().slice(0, 90)}. ` : " ";
  const captionLanguage = lang === "ko" ? "Korean" : "English";
  return (
    `${DOODLE_STYLE} Internal reference only, never render as text: tool name "${name}", purpose: ${descEn}.${localizedHint}` +
    `Think carefully about what this tool ACTUALLY does, then pick the single most accurate visual metaphor — not a generic icon, but something that captures the specific mechanism or workflow. ` +
    `Depict one clear scene with objects and actions that convey the core function at a glance. ` +
    `Add exactly one small, clean bottom caption in ${captionLanguage}: 2-4 precise words that name the core action, no punctuation. ` +
    `Use ${hl} only as a small visual accent, not as a marker behind words. ` +
    `Do NOT write the tool name. Do NOT include a title, object label, UI text, speech bubble, command text, code, gauge letters, numbers, logo text, watermark, pseudo-text, or any extra text beyond that one caption. ` +
    `No outer card border frame, no dark or military tone, no photorealism. No anthropomorphic characters with faces on objects. 1:1 square.`
  );
}

