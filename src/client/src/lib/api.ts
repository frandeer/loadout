import type { IndexData } from "../types";

const BASE = "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) throw new Error(`API ${path}: ${res.status}`);
  return res.json();
}

export const api = {
  getIndex: () => request<IndexData>("/index"),

  getEngines: () =>
    request<{ engines: string[] }>("/engines").catch(() => ({ engines: ["heuristic"] })),

  equip: (id: string) =>
    request<{ ok: boolean }>("/equip", { method: "POST", body: JSON.stringify({ id }) }),

  unequip: (id: string) =>
    request<{ ok: boolean }>("/unequip", { method: "POST", body: JSON.stringify({ id }) }),

  rescan: () =>
    request<{ ok: boolean }>("/rescan", { method: "POST" }),

  getContent: (id: string) =>
    request<{ content: string }>(`/content?id=${encodeURIComponent(id)}`),

  translate: (id: string, engine?: string) =>
    request<{ nameKo: string; descKo: string }>("/translate", {
      method: "POST",
      body: JSON.stringify({ id, engine }),
    }),

  generate: (ids: string[], engine?: string) =>
    request<Record<string, string>>("/generate", {
      method: "POST",
      body: JSON.stringify({ ids, engine }),
    }),

  verify: (ids: string[], engine?: string) =>
    request<Record<string, unknown>>("/verify", {
      method: "POST",
      body: JSON.stringify({ ids, engine }),
    }),

  getSources: () =>
    request<{ roots: Array<{ path: string; exists: boolean; count: number; claude?: boolean }> }>("/sources"),

  addSource: (path: string) =>
    request<{ ok: boolean }>("/add-source", { method: "POST", body: JSON.stringify({ path }) }),

  removeSource: (path: string) =>
    request<{ ok: boolean }>("/remove-source", { method: "POST", body: JSON.stringify({ path }) }),

  clone: (url: string) =>
    request<{ ok: boolean; added?: number }>("/clone", { method: "POST", body: JSON.stringify({ url }) }),
};
