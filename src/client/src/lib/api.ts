import type { IndexData, TeamVerifyResp, TeamAbResp, DropResp, TeamExportOmcResp } from "../types";
import type {
  ForgeSession, ForgeSessionSummary, ForgeCapabilities, ForgeStatusResp,
  ForgeVariant, ForgeExportResult,
} from "../types/forge";

const BASE = "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) throw new Error(`API ${path}: ${res.status}`);
  return res.json();
}

// 서버 계약(src/server.mjs)이 진실의 원천 — 경로/페이로드를 서버에 맞춘다.
export const api = {
  getIndex: () => request<IndexData>("/index"),

  getEngines: () =>
    request<{ engines: string[] }>("/engines").catch(() => ({ engines: ["heuristic"] })),

  // 장착/해제는 단일 /api/equip 엔드포인트 — equip:false 가 해제.
  equip: (id: string) =>
    request<{ ok: boolean; equipped: boolean; installed?: boolean; note?: string }>("/equip", {
      method: "POST",
      body: JSON.stringify({ id, equip: true }),
    }),

  unequip: (id: string) =>
    request<{ ok: boolean; equipped: boolean; note?: string }>("/equip", {
      method: "POST",
      body: JSON.stringify({ id, equip: false }),
    }),

  // 사용량 재집계 — 세션 로그를 다시 스캔해 uses 갱신.
  refreshUsage: () =>
    request<{ ok: boolean; total: number }>("/usage/refresh", { method: "POST" }),

  rescan: () =>
    request<{ ok: boolean }>("/rescan", { method: "POST" }),

  getContent: (id: string) =>
    request<{ content: string; contentKo?: string; path?: string }>(`/content?id=${encodeURIComponent(id)}`),

  translateContent: (id: string, engine?: string) =>
    request<{ ok: boolean; id: string; contentKo: string; error?: string }>("/translate-content", {
      method: "POST",
      body: JSON.stringify({ id, engine }),
    }),

  // 배치 번역 — 응답은 { translations: { [id]: {name, description} } }.
  translate: (ids: string | string[], engine?: string) =>
    request<{ ok: boolean; engine?: string; error?: string; translations: Record<string, { name: string; description: string }>; count: number }>(
      "/translate",
      { method: "POST", body: JSON.stringify({ ids: Array.isArray(ids) ? ids : [ids], engine, force: true }) },
    ),

  // 카드 아트 생성 — 서버는 {prompt, imageEngine, itemId} 를 기대.
  generate: (prompt: string, opts?: { itemId?: string; imageEngine?: string; expectedCount?: number }) =>
    request<{ ok: boolean; engine: string; images: Array<{ url: string }>; error?: string }>("/generate", {
      method: "POST",
      body: JSON.stringify({ prompt, ...opts }),
    }),

  // AI 채점 — 서버는 단건 {id, engine}.
  verify: (id: string, engine?: string) =>
    request<{ ok: boolean; verdict: unknown; score: number; rarity: string; engine: string }>("/verify", {
      method: "POST",
      body: JSON.stringify({ id, engine }),
    }),

  getSources: () =>
    request<{ roots: Array<{ path: string; exists: boolean; count: number; claude?: boolean }> }>("/sources"),

  addSource: (path: string) =>
    request<{ ok: boolean; added?: string }>("/sources/add", { method: "POST", body: JSON.stringify({ path }) }),

  removeSource: (path: string) =>
    request<{ ok: boolean; removed?: boolean }>("/sources/remove", { method: "POST", body: JSON.stringify({ path }) }),

  clone: (url: string) =>
    request<{ ok: boolean; added?: number }>("/clone", { method: "POST", body: JSON.stringify({ url }) }),

  // 팀 프리셋 — data/teams.json (서버 영속)
  getTeams: () =>
    request<{ ok: boolean; teams: Record<string, { name: string; slots: Record<string, string | null>; at: number; elo?: number; eval?: unknown }> }>("/teams"),

  saveTeams: (teams: Record<string, { name: string; slots: Record<string, string | null>; at: number; elo?: number }>) =>
    request<{ ok: boolean; count: number }>("/teams", { method: "POST", body: JSON.stringify({ teams }) }),

  // 팀 단위 AI 평가 — 편성 슬롯(또는 저장된 teamId)을 시나리오로 채점. 엔진 실패 시 서버가 휴리스틱 폴백.
  // slots는 역할명→itemId 맵 (예: {"분석관":"...","정찰관":null}) — 역할명이 평가 프롬프트에 쓰임.
  teamVerify: (params: { teamId?: string; slots?: Record<string, string | null>; scenario?: string; engine?: string }) =>
    request<TeamVerifyResp>("/team/verify", { method: "POST", body: JSON.stringify(params) }),

  // 팀 A/B 대전 — 양 팀 모두 저장된 프리셋 id. 같은 시나리오로 채점해 승패+Elo 갱신(서버 영속).
  teamAb: (aId: string, bId: string, scenario?: string, engine?: string) =>
    request<TeamAbResp>("/team/ab", { method: "POST", body: JSON.stringify({ aId, bId, scenario, engine }) }),

  // 카드 드랍 — 최근 세션 해결 패턴을 스킬로 추출해 신규 카드 생성.
  drop: (engine?: string) =>
    request<DropResp>("/drop", { method: "POST", body: JSON.stringify({ engine }) }),

  // OMC export — 저장된 팀을 /team 파이프라인 설정 파일로 변환(data/exports/<teamId>/에 기록).
  teamExportOmc: (teamId: string) =>
    request<TeamExportOmcResp>("/team/export-omc", { method: "POST", body: JSON.stringify({ teamId }) }),

  // ---------- Design Forge ----------
  forge: {
    capabilities: () => request<{ ok: boolean } & ForgeCapabilities>("/forge/capabilities"),

    sessions: () =>
      request<{ ok: boolean; sessions: ForgeSessionSummary[] }>("/forge/sessions"),

    session: (id: string) =>
      request<{ ok: boolean; session: ForgeSession }>(`/forge/session?id=${encodeURIComponent(id)}`),

    status: (id: string) =>
      request<{ ok: boolean } & ForgeStatusResp>(`/forge/status?id=${encodeURIComponent(id)}`),

    nextMatchup: (id: string) =>
      request<{ ok: boolean; matchup: { variantA: ForgeVariant; variantB: ForgeVariant } | null }>(
        `/forge/next?id=${encodeURIComponent(id)}`,
      ),

    create: (prompt: string, opts?: { title?: string; style?: string; matrix?: unknown[] }) =>
      request<{ ok: boolean; session: ForgeSession }>("/forge/session", {
        method: "POST",
        body: JSON.stringify({ prompt, ...opts }),
      }),

    generate: (id: string, concurrency?: number) =>
      request<{ ok: boolean; variants: ForgeVariant[]; already?: boolean }>("/forge/generate", {
        method: "POST",
        body: JSON.stringify({ id, concurrency }),
      }),

    match: (id: string, variantA: string, variantB: string, result: 0 | 0.5 | 1, timeMs?: number) =>
      request<{ ok: boolean; variantA: { id: string; elo: number }; variantB: { id: string; elo: number } }>(
        "/forge/match",
        { method: "POST", body: JSON.stringify({ id, variantA, variantB, result, timeMs }) },
      ),

    refine: (id: string, variantId: string, instructions: string) =>
      request<{ ok: boolean; variant: ForgeVariant }>("/forge/refine", {
        method: "POST",
        body: JSON.stringify({ id, variantId, instructions }),
      }),

    exportKit: (id: string, variantId?: string) =>
      request<ForgeExportResult>("/forge/export", {
        method: "POST",
        body: JSON.stringify({ id, variantId }),
      }),

    remove: (id: string) =>
      request<{ ok: boolean }>("/forge/delete", { method: "POST", body: JSON.stringify({ id }) }),
  },
};
