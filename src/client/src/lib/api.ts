import type { IndexData, DropResp } from "../types";
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

  // 사용자 설정(영속) — 이미지 생성 엔진 등. 서버 data/settings.json 가 진실의 원천.
  getSettings: () =>
    request<{ ok: boolean; settings: { imageEngine: string } }>("/settings").catch(
      () => ({ ok: false, settings: { imageEngine: "codex" } }),
    ),

  saveSettings: (settings: { imageEngine?: string }) =>
    request<{ ok: boolean; settings: { imageEngine: string } }>("/settings", {
      method: "POST",
      body: JSON.stringify(settings),
    }),

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

  // ── vault 토글(장착/해제) — on:true 켜기, on:false 끄기(보관). 거대 자산은 끄면 vault로 이동.
  activateVault: (id: string, on: boolean, dryRun = false) =>
    request<{
      ok: boolean; id: string; kind: string; name: string; on: boolean; dryRun: boolean;
      dest?: string; vaultSrc?: string; claudeState?: "link" | "resident" | "absent";
      moved?: boolean; verify?: unknown; backedUp?: boolean; error?: string;
    }>("/vault/activate", {
      method: "POST",
      body: JSON.stringify({ id, on, dryRun }),
    }),

  // vault 전수 상태 — 인벤토리 동기화 점검용.
  vaultStatus: () =>
    request<{
      ok: boolean; vaultRoot: string; summary: unknown;
      items: Array<{
        id: string; kind: string; name: string; inVault: boolean;
        vaultPath?: string; livePath?: string;
        claudeState?: "link" | "resident" | "absent"; divergent?: boolean; oversized?: boolean;
      }>;
    }>("/vault/status"),

  // 안전 삭제(휴지통 이동, 복구 가능) — confirmName 이 item.name 과 일치해야 서버가 실행.
  deleteItem: (id: string, confirmName: string, dryRun = false) =>
    request<{
      ok: boolean; id: string; kind: string; name: string;
      removed?: Array<{ what: string; from: string; to: string }>;
      willRemove?: Array<{ label: string; path: string }>;
      trashRoot?: string; note?: string; error?: string;
    }>("/item/delete", {
      method: "POST",
      body: JSON.stringify({ id, confirmName, dryRun }),
    }),

  // 분기 해소 — pull(vault→라이브) / push(라이브→vault).
  resolveDivergence: (id: string, choice: "pull" | "push", dryRun = false) =>
    request<{ ok: boolean; id: string; choice: "pull" | "push"; action?: string; error?: string }>(
      "/vault/resolve",
      { method: "POST", body: JSON.stringify({ id, choice, dryRun }) },
    ),

  // 사용량 재집계 — 세션 로그를 다시 스캔해 uses 갱신.
  refreshUsage: () =>
    request<{ ok: boolean; total: number }>("/usage/refresh", { method: "POST" }),

  rescan: () =>
    request<{ ok: boolean }>("/rescan", { method: "POST" }),

  getContent: (id: string, rel?: string) =>
    request<{ content: string; contentKo?: string; path?: string; files?: Array<{ name: string; path: string; size: number }> }>(
      `/content?id=${encodeURIComponent(id)}${rel ? `&rel=${encodeURIComponent(rel)}` : ""}`
    ),

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
  // 503(image-farm 미가동/로그인 필요)도 본문의 error/code 를 살려야 UI 가 사유를
  // 보여줄 수 있으므로, throw 하는 request 대신 직접 fetch 해서 JSON 본문을 항상 반환한다.
  generate: async (
    prompt: string,
    opts?: { itemId?: string; imageEngine?: string; expectedCount?: number },
  ): Promise<{ ok: boolean; engine?: string; images?: Array<{ url: string }>; error?: string; code?: string }> => {
    const res = await fetch(`${BASE}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, ...opts }),
    });
    return res.json().catch(() => ({ ok: false, error: `HTTP ${res.status}` }));
  },

  // AI 채점 — 서버는 단건 {id, engine}.
  verify: (id: string, engine?: string) =>
    request<{ ok: boolean; verdict: unknown; score: number; rarity: string; engine: string }>("/verify", {
      method: "POST",
      body: JSON.stringify({ id, engine }),
    }),

  // AI 분석 — 자산의 목적/품질/중복을 평가하고 keep/drop 권고를 반환. 엔진/모델 선택 가능.
  analyze: (id: string, engine?: string, model?: string) =>
    request<{
      ok: boolean;
      analysis: {
        purpose: string;
        quality: string;
        redundancy: string;
        recommendation: "keep" | "drop";
        confidence: number;
        reasons: string[];
      };
      engine: string;
    }>("/analyze", {
      method: "POST",
      body: JSON.stringify({ id, engine, model }),
    }),

  getSources: () =>
    request<{ roots: Array<{ path: string; exists: boolean; count: number; claude?: boolean }> }>("/sources"),

  addSource: (path: string) =>
    request<{ ok: boolean; added?: string }>("/sources/add", { method: "POST", body: JSON.stringify({ path }) }),

  removeSource: (path: string) =>
    request<{ ok: boolean; removed?: boolean }>("/sources/remove", { method: "POST", body: JSON.stringify({ path }) }),

  clone: (url: string) =>
    request<{ ok: boolean; added?: number }>("/clone", { method: "POST", body: JSON.stringify({ url }) }),

  // 카드 드랍 — 최근 세션 해결 패턴을 스킬로 추출해 신규 카드 생성.
  drop: (engine?: string) =>
    request<DropResp>("/drop", { method: "POST", body: JSON.stringify({ engine }) }),

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
