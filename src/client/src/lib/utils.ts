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
