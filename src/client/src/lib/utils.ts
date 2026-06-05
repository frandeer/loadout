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

export function computeLevel(power: number): number {
  return Math.max(1, Math.round((power || 50) / 12));
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
