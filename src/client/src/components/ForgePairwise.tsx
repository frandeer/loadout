import { useEffect, useMemo, useRef, useState } from "react";
import type { ForgeSession, ForgeVariant } from "../types/forge";

interface Props {
  session: ForgeSession;
  eliminated: Set<string>;
  onMatch: (a: string, b: string, result: 0 | 0.5 | 1, timeMs: number) => Promise<void>;
  onDone: () => void;
}

// 클라이언트 측 다음 비교쌍 선택 — 비교가 적은 변형 우선(서버 nextMatchup과 동일 휴리스틱).
// seed: 건너뛰기 시 다른 쌍으로 회전시키기 위한 오프셋.
function pickPair(live: ForgeVariant[], counts: Record<string, number>, seed = 0): [ForgeVariant, ForgeVariant] | null {
  if (live.length < 2) return null;
  const sorted = [...live].sort((a, b) => (counts[a.id] || 0) - (counts[b.id] || 0) || b.elo - a.elo);
  const a = sorted[seed % sorted.length];
  const b = sorted.find((v) => v.id !== a.id) ?? sorted[0];
  return [a, b];
}

export function ForgePairwise({ session, eliminated, onMatch, onDone }: Props) {
  const live = useMemo(
    () => session.variants.filter((v) => v.status === "done" && !eliminated.has(v.id)),
    [session.variants, eliminated],
  );
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [rounds, setRounds] = useState(0);
  const [skipSeed, setSkipSeed] = useState(0);
  // 비교쌍은 상태가 아니라 live+counts+seed에서 파생(렌더 중 계산 — effect/setState 불필요).
  const pair = useMemo(() => pickPair(live, counts, skipSeed), [live, counts, skipSeed]);
  // 라운드 시작 시각은 ref만 갱신(setState 아님 → cascading 없음).
  const startRef = useRef<number>(0);
  const pairKey = pair ? `${pair[0].id}|${pair[1].id}` : "";
  useEffect(() => { startRef.current = Date.now(); }, [pairKey]);

  if (!pair) {
    return (
      <div className="py-16 text-center text-sm text-zinc-400">
        비교할 변형이 2개 이상 필요합니다.
        <div className="mt-3">
          <button onClick={onDone} className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:text-white">
            갤러리로
          </button>
        </div>
      </div>
    );
  }

  const decide = async (result: 0 | 0.5 | 1) => {
    const [a, b] = pair;
    await onMatch(a.id, b.id, result, Date.now() - startRef.current);
    setCounts((c) => ({ ...c, [a.id]: (c[a.id] || 0) + 1, [b.id]: (c[b.id] || 0) + 1 }));
    setRounds((r) => r + 1);
  };

  const ranked = [...live].sort((a, b) => b.elo - a.elo);

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <h3 className="text-sm font-semibold text-white">A/B 비교 · 라운드 {rounds + 1}</h3>
        <button onClick={onDone} className="ml-auto rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:text-white">
          갤러리로 돌아가기
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {pair.map((v, i) => (
          <Side key={v.id} v={v} label={i === 0 ? "A" : "B"} onWin={() => decide(i === 0 ? 1 : 0)} />
        ))}
      </div>

      <div className="mt-4 flex justify-center gap-3">
        <button onClick={() => decide(0.5)} className="rounded-md border border-zinc-700 bg-zinc-900 px-4 py-2 text-xs text-zinc-300 hover:text-white">
          무승부 / 둘 다 별로
        </button>
        <button onClick={() => setSkipSeed((s) => s + 1)} className="rounded-md border border-zinc-700 bg-zinc-900 px-4 py-2 text-xs text-zinc-400 hover:text-white">
          건너뛰기 →
        </button>
      </div>

      {/* 현재 랭킹 */}
      <div className="mt-8">
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">현재 Elo 랭킹</h4>
        <div className="space-y-1">
          {ranked.map((v, idx) => (
            <div key={v.id} className="flex items-center gap-3 rounded border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs">
              <span className="w-5 text-zinc-500">{idx + 1}</span>
              <span className="text-zinc-300">{v.engine}</span>
              <span className="text-zinc-600">{v.strategy}/{v.style}</span>
              <span className="ml-auto font-mono text-amber-400">{v.elo}</span>
              <span className="text-zinc-600">{v.wins}승 {v.losses}패</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Side({ v, label, onWin }: { v: ForgeVariant; label: string; onWin: () => void }) {
  const isHtml = v.file?.endsWith(".html");
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900">
      <div className="flex items-center gap-2 border-b border-zinc-800 px-3 py-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500/20 text-xs font-bold text-amber-400">{label}</span>
        <span className="text-xs text-zinc-400">{v.engine} · {v.strategy}/{v.style}</span>
        <span className="ml-auto font-mono text-xs text-amber-400">Elo {v.elo}</span>
      </div>
      <div className="h-80 overflow-hidden bg-zinc-950">
        {v.file && isHtml ? (
          <iframe src={v.file} title={v.id} className="h-full w-full" />
        ) : v.file ? (
          <img src={v.file} alt={v.id} className="h-full w-full object-contain" />
        ) : null}
      </div>
      <button onClick={onWin} className="w-full bg-amber-500/20 py-2.5 text-sm font-semibold text-amber-300 transition hover:bg-amber-500/30">
        이쪽이 더 낫다 ▲
      </button>
    </div>
  );
}
