import type { Item } from "../types";

export function iconFor(it: Item): string {
  if (it.kind === "agent") return "agent";
  if (it.kind === "mcp") return "module";
  const t = `${it.name} ${it.category ?? ""} ${it.description}`.toLowerCase();
  const map: [string, string][] = [
    ["pdf|doc", "docs"], ["design", "design"], ["debug", "debug"],
    ["test", "test"], ["security", "security"], ["game", "game"],
    ["data", "data"], ["web", "web"], ["api", "api"], ["git", "git"],
    ["deploy", "deploy"], ["image", "image"], ["music|audio", "audio"],
    ["video", "video"], ["ml|ai|model", "ai"], ["search", "search"],
    ["plan", "plan"], ["write", "writing"], ["memory", "memory"],
    ["slide", "slides"], ["review", "review"],
  ];
  for (const [k, e] of map) if (new RegExp(k).test(t)) return e;
  return "util";
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
    ? `"${itemName}" ${itemRole}. Category: ${it.category}. Description: ${itemDesc || "No description provided."}. Tools/source clues: ${itemTools || itemSource || "none"}`
    : "generic mission asset";
  const laneAccent = it
    ? it.kind === "mcp" || it.rarity === "legendary" || it.rarity === "uncommon"
      ? "orbit green MONITOR lane"
      : "launch blue SHIP lane"
    : "launch blue SHIP lane and orbit green MONITOR lane";
  const identityRule =
    "Make the asset's purpose recognizable at a glance with ONE single clear, flat, literal icon of what it actually does — a concrete object that matches its name, description and category. Good examples: a browser window for web, a document with 'Aa' and color chips for design, a terminal with code brackets for code, a magnifier over a page for review/search, a shield or lock for security, a bar/line chart or database for data, a stacked server for infra, a glowing node for AI, a plug/connector for an MCP module, an operator badge or small robot for an agent. Pick the single best-fitting object. Keep it simple: one focal subject, clean light background, generous empty space, flat minimal style — never a busy diagram, a pile of objects, or a generic rocket. No readable long text; at most a tiny abstract label.";

  const P: Record<string, string> = {
    card: `Simple, clean, flat icon-style card art for this exact Loadout asset: ${subject}. ${identityRule} ${ORBITAL_MONITOR_STYLE}. Compose ONE large, simple central icon that literally depicts what the asset does, centered with calm empty space; use ${laneAccent} only as a restrained accent. Keep it minimal and uncluttered — no dense telemetry, no crowded diagrams, no multiple competing objects. Borderless edge-to-edge graphic, no outer card frame, no generic stock image, no readable long text.`,
    icon: `항공우주 운영용 아이콘 시트 1장(4x4 격자, 16개). ${ORBITAL_MONITOR_STYLE}. 각 칸은 로켓, 체크리스트, 업로드 구름, 성능 게이지, 위성, 문서 동기화, 모델 비교, 레이더 상태 아이콘. 균일한 셀 크기, 밝은 배경, 또렷한 파란/초록 라인.`,
    logo: `A premium, modern app logo emblem for a mission-control deck called LOADOUT. One bold central mark: a sleek stylized rocket lifting off along a dotted telemetry arc that curves up to a glowing orbit node with a small satellite, evoking launch then monitor. Palette: launch blue (#2E73DF) and orbit green (#22965A) on a clean white to pale-blue background. Flat geometric crisp vector style with subtle depth and soft shadow, rounded-square app-icon composition, centered with generous padding and balanced negative space, polished and confident like a top tech brand mark. No text, no letters, no words, no military insignia, no clutter. 1:1 square.`,
    bg: `Wide 16:9 SHIP MONITOR dashboard background. ${ORBITAL_MONITOR_STYLE}. Left rocket launch pad impression, center dotted orbital arc, right satellite over earth horizon, plenty of empty central space for UI panels, bright blueprint grid.`,
    layout: `Full 16:9 web dashboard mockup in the style of gstack SHIP MONITOR. ${ORBITAL_MONITOR_STYLE}. Two large operation panels: blue SHIP checklist lane and green MONITOR telemetry lane, top breadcrumb capsule, rocket-to-satellite orbital arc hero.`,
    sprite: `Bright blueprint UI sprite sheet, 5x4 grid. ${ORBITAL_MONITOR_STYLE}. Buttons, checklist rows, status chips, telemetry dots, module slots, launch queue badges, orbit monitor badges. Crisp web-ready components.`,
  };
  return P[preset] || P.card;
}

