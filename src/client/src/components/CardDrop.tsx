import { useState } from "react";
import { useStore } from "../hooks/useStore";
import { RARITY_CONFIG, KIND_LABELS } from "../types";
import type { DropResp } from "../types";
import { api } from "../lib/api";
import { Icon } from "./Icon";

interface CardDropProps {
  /**
   * 리빌(획득 카드)이 사용자에 의해 닫힐 때 호출 — 부모(예: SourceManager 모달)가
   * 자신을 닫도록. 드랍 성공 시점이 아니라 리빌이 닫히는 시점에 호출해야 한다:
   * 부모 모달이 즉시 언마운트되면 CardDrop(과 그 자식인 리빌 오버레이)도 같은 렌더에서
   * 사라져, 사용자가 "신규 카드 획득!"을 보지 못하고 setSelected도 실행되지 못한다.
   */
  onReveal?: () => void;
}

export function CardDrop({ onReveal }: CardDropProps) {
  const { engines, reloadData, setSelected, items } = useStore();
  // 사용자가 명시적으로 고른 엔진만 보관. 미선택이면 라이브 engines[0]로 폴백한다 —
  // engines가 mount 이후 비동기로 로드되어도(useStore.loadData) 기본값이 갱신되도록.
  const [picked, setPicked] = useState<string | null>(null);
  const engine = picked ?? engines[0] ?? "heuristic";
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
        await reloadData();
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
    if (id) setSelected(id);
    // 리빌이 닫힌 뒤에야 부모 모달(SourceManager)을 닫는다 — 닫히면서 선택된 카드의
    // DetailPanel이 라우트 레이어에 열린다(모달 서브트리 밖이라 언마운트 영향 없음).
    onReveal?.();
  };

  const full = dropped ? items.find((i) => i.id === dropped.id) : undefined;
  const r = full ? RARITY_CONFIG[full.rarity] : RARITY_CONFIG.legendary;

  return (
    <div className="flex items-center gap-2">
      <select
        value={engine}
        onChange={(e) => setPicked(e.target.value)}
        aria-label="드랍 엔진"
        className="h-8 rounded-lg border border-hairline bg-canvas px-2 font-mono text-[11px] text-body focus:border-primary focus:outline-none"
      >
        {engines.map((e) => (
          <option key={e} value={e}>{e}</option>
        ))}
      </select>
      <button
        onClick={runDrop}
        disabled={dropping}
        className="flex items-center gap-1.5 rounded-lg bg-accent-orange-soft px-4 py-2 text-xs font-bold text-accent-orange transition hover:bg-accent-orange/20 disabled:opacity-50"
        title="최근 세션의 해결 패턴을 스킬 카드로 추출합니다"
      >
        <Icon name="lightning" size="xs" /> {dropping ? "분석 중…" : "카드 드랍"}
      </button>
      {error && <span className="text-[11px] text-accent-rose">{error}</span>}

      {dropped && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={closeReveal}
          data-testid="card-drop-reveal"
        >
          <div
            className="reveal relative w-full max-w-sm rounded-2xl border-2 bg-canvas p-6 text-center shadow-md"
            style={{ borderColor: r.color }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-wide text-accent-orange">
              <Icon name="trophy" size="sm" /> 신규 카드 획득!
            </div>
            <div className="mt-1">
              <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold text-white" style={{ backgroundColor: r.color }}>
                {r.ko}
              </span>
              <span className="ml-2 text-xs text-muted">{KIND_LABELS[dropped.kind]}</span>
            </div>
            <div className="mt-4 text-xl font-bold text-ink">{full?.displayName || dropped.name}</div>
            {full?.description && (
              <p className="mt-2 line-clamp-2 text-sm text-muted">{full.description}</p>
            )}
            {note && (
              <p className="mt-3 border-t border-hairline pt-3 text-[10px] text-muted-soft">{note}</p>
            )}
            <button
              onClick={closeReveal}
              className="mt-5 rounded-lg bg-primary px-6 py-2.5 text-sm font-bold text-white transition hover:bg-primary-active"
            >
              덱에 보관
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
