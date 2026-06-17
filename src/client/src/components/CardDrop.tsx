import { useState } from "react";
import { useStore } from "../hooks/useStore";
import { RARITY_CONFIG } from "../types";
import type { DropResp, Kind } from "../types";
import { api } from "../lib/api";

const KIND_LABEL: Record<Kind, string> = { skill: "스킬", agent: "요원", mcp: "장비", memory: "기억" };

/* 카드 드랍 — Hermes식 스킬 자동 생성을 "전투 보상" 메타포로.
   POST /api/drop {engine?} → 신규 카드. 성공 시 풀스크린 획득 연출,
   닫으면 인덱스 재조회 + 해당 카드 하이라이트(DetailPanel). */
export function CardDrop() {
  const { engines, reloadData, setSelected, items } = useStore();
  const [engine, setEngine] = useState(engines[0] ?? "heuristic");
  const [dropping, setDropping] = useState(false);
  const [error, setError] = useState("");
  const [dropped, setDropped] = useState<DropResp["card"] | null>(null);
  const [note, setNote] = useState<string | undefined>();

  const runDrop = async () => {
    if (dropping) return;
    setDropping(true);
    setError("");
    try {
      const resp = await api.drop(engine);
      if (resp.ok && resp.card) {
        await reloadData(); // 새 카드를 덱에 반영
        setNote(resp.note);
        setDropped(resp.card);
      } else {
        setError(resp.error || "카드 드랍에 실패했습니다");
      }
    } catch {
      setError("드랍 요청이 실패했습니다 — 엔진/서버 상태를 확인하세요");
    } finally {
      setDropping(false);
    }
  };

  const closeReveal = () => {
    const id = dropped?.id;
    setDropped(null);
    setNote(undefined);
    if (id) setSelected(id); // 덱에서 해당 카드 하이라이트
  };

  // 새 카드의 전체 데이터(등급 등)는 재조회 후 store에서 조회.
  const full = dropped ? items.find((i) => i.id === dropped.id) : undefined;
  const r = full ? RARITY_CONFIG[full.rarity] : RARITY_CONFIG.legendary;

  return (
    <div className="flex items-center gap-2">
      <select
        value={engine}
        onChange={(e) => setEngine(e.target.value)}
        aria-label="드랍 엔진"
        className="h-8 border border-line bg-panel2 px-2 font-mono text-[11px] text-ink-dim focus:border-signal-dim focus:outline-none"
      >
        {engines.map((e) => (
          <option key={e} value={e}>{e}</option>
        ))}
      </select>
      <button
        onClick={runDrop}
        disabled={dropping}
        className="hud-frame bg-gold/10 px-4 py-2 font-mono text-xs font-semibold text-gold transition hover:bg-gold/20 disabled:opacity-50"
        style={{ "--hud-c": "var(--color-gold)" } as React.CSSProperties}
        title="최근 세션의 해결 패턴을 스킬 카드로 추출합니다"
      >
        {dropping ? "전투 보상 분석 중…" : "카드 드랍"}
      </button>
      {error && <span className="font-mono text-[11px] text-danger">{error}</span>}

      {dropped && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={closeReveal}
          data-testid="card-drop-reveal"
        >
          <div
            className="card-drop drop-glow hud-frame relative w-full max-w-sm border bg-panel p-6 text-center"
            style={{ "--hud-c": r.color, "--drop-glow": `${r.color}66`, borderColor: r.color } as React.CSSProperties}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-gold">신규 카드 획득!</div>
            <div className="mt-1 font-mono text-[10px] uppercase tracking-widest" style={{ color: r.color }}>
              {r.ko} · {KIND_LABEL[dropped.kind]}
            </div>
            <div className="mt-4 text-xl font-bold text-ink">{full?.displayName || dropped.name}</div>
            {full?.description && (
              <p className="mt-2 line-clamp-2 text-sm text-ink-dim">{full.description}</p>
            )}
            {note && (
              <p className="mt-3 border-t border-line pt-3 font-mono text-[10px] text-ink-faint">{note}</p>
            )}
            <button
              onClick={closeReveal}
              className="hud-frame mt-5 bg-signal/10 px-6 py-2 text-sm font-semibold text-signal transition hover:bg-signal/20"
              style={{ "--hud-c": "var(--color-signal-dim)" } as React.CSSProperties}
            >
              덱에 보관
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
