import { useState } from "react";
import { api } from "../lib/api";
import { useStore } from "../hooks/useStore";
import type { TeamAbResp, TeamAbSide } from "../types";
import { ScoreGauge } from "./TeamEvalPanel";
import { Icon } from "./Icon";

export function TeamAbPanel({ engines }: { engines: string[] }) {
  const presets = useStore((s) => s.presets);
  const presetList = Object.entries(presets).sort((a, b) => b[1].at - a[1].at);
  const enough = presetList.length >= 2;

  const [aId, setAId] = useState("");
  const [bId, setBId] = useState("");
  const [scenario, setScenario] = useState("");
  const [engine, setEngine] = useState(engines[0] ?? "heuristic");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<TeamAbResp | null>(null);
  const [prevElo, setPrevElo] = useState<{ a: number; b: number } | null>(null);

  const canFight = enough && !!aId && !!bId && aId !== bId && !loading;

  const fight = async () => {
    if (!canFight) return;
    setLoading(true);
    setError("");
    const snap = { a: presets[aId]?.elo ?? 1500, b: presets[bId]?.elo ?? 1500 };
    try {
      const resp = await api.teamAb(aId, bId, scenario.trim() || "범용 코딩 작업", engine);
      if (resp.ok && resp.a && resp.b) {
        setPrevElo(snap);
        setResult(resp);
        useStore.setState((s) => ({
          presets: {
            ...s.presets,
            [aId]: { ...s.presets[aId], elo: resp.elo.a },
            [bId]: { ...s.presets[bId], elo: resp.elo.b },
          },
        }));
      } else {
        setError(resp.error || "대전에 실패했습니다");
      }
    } catch {
      setError("대전 요청이 실패했습니다 — 두 작전 모두 저장됐는지·서버 상태를 확인하세요");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mt-6" data-testid="team-ab-panel">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wide text-muted">A/B 대전</h3>
        {result && (
          <span className="rounded-full bg-surface-soft px-2 py-0.5 text-[9px] font-medium text-muted">
            {result.a.result.engine}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <TeamSelect label="팀 A" value={aId} exclude={bId} list={presetList} onChange={setAId} />
        <span className="text-xs font-bold text-muted">VS</span>
        <TeamSelect label="팀 B" value={bId} exclude={aId} list={presetList} onChange={setBId} />
        <input
          value={scenario}
          onChange={(e) => setScenario(e.target.value)}
          placeholder="시나리오 — 예: 대규모 리팩토링 작전"
          className="h-9 w-56 rounded-lg border border-hairline bg-canvas px-3 text-sm text-ink placeholder:text-muted-soft focus:border-primary focus:outline-none"
        />
        <select
          value={engine}
          onChange={(e) => setEngine(e.target.value)}
          aria-label="대전 엔진"
          className="h-9 rounded-lg border border-hairline bg-canvas px-2 font-mono text-xs text-body focus:border-primary focus:outline-none"
        >
          {engines.map((e) => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>
        <button
          onClick={fight}
          disabled={!canFight}
          title={!enough ? "저장된 작전이 2개 이상 필요합니다" : aId && aId === bId ? "서로 다른 두 작전을 선택하세요" : undefined}
          className="flex items-center gap-1.5 rounded-lg bg-accent-orange-soft px-5 py-2 text-sm font-bold text-accent-orange transition hover:bg-accent-orange/20 disabled:opacity-40"
        >
          <Icon name="compare-scale" size="sm" />
          {loading ? "모의 교전 중… (~50s)" : "대전 개시"}
        </button>
        {error && <span className="text-xs text-accent-rose">{error}</span>}
      </div>

      {!enough && (
        <p className="mt-2 text-[11px] text-muted">
          저장된 작전이 2개 이상이어야 대전할 수 있습니다 — 위에서 작전을 저장하세요.
        </p>
      )}

      {result && (
        <div
          className="mt-3 rounded-xl border border-hairline bg-canvas p-4"
          data-testid="team-ab-result"
        >
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
            <SideCard side={result.a} won={result.winner === "a"} prev={prevElo?.a} next={result.elo.a} />
            <div className="text-center">
              <div className="flex justify-center text-2xl" data-testid="ab-verdict">
                {result.winner === "draw" ? "무승부" : <Icon name="trophy" size="xl" />}
              </div>
              <div className="mt-1 text-[10px] font-bold uppercase tracking-wide text-muted">
                {result.winner === "draw" ? "DRAW" : result.winner === "a" ? "← 팀 A" : "팀 B →"}
              </div>
              <div className="mt-1 font-mono text-xs font-bold text-accent-orange">Δ {result.delta}</div>
            </div>
            <SideCard side={result.b} won={result.winner === "b"} prev={prevElo?.b} next={result.elo.b} />
          </div>
        </div>
      )}
    </section>
  );
}

function TeamSelect({
  label, value, exclude, list, onChange,
}: {
  label: string;
  value: string;
  exclude: string;
  list: [string, { name: string; elo?: number }][];
  onChange: (id: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      className="h-9 max-w-[200px] rounded-lg border border-hairline bg-canvas px-2 text-sm text-ink focus:border-primary focus:outline-none"
    >
      <option value="">{label} 선택</option>
      {list.map(([id, p]) => (
        <option key={id} value={id} disabled={id === exclude}>
          {p.name}{typeof p.elo === "number" ? ` (${p.elo})` : ""}
        </option>
      ))}
    </select>
  );
}

function SideCard({ side, won, prev, next }: { side: TeamAbSide; won: boolean; prev?: number; next: number }) {
  const diff = typeof prev === "number" ? next - prev : null;
  return (
    <div className={`rounded-xl border p-3 ${won ? "border-accent-orange/50 bg-accent-orange-soft" : "border-hairline bg-surface-soft"}`}>
      <div className="mb-1 flex items-center gap-2">
        <span className="truncate text-sm font-semibold text-ink" title={side.name}>{side.name}</span>
        {won && <span className="text-[9px] font-bold text-accent-orange">승</span>}
      </div>
      <div className="mb-2 flex items-baseline gap-2">
        <span className="font-mono text-3xl font-bold text-accent-orange">{side.result.total}</span>
        <span className="text-[9px] text-muted-soft">/ 100</span>
      </div>
      <div className="space-y-1.5">
        <ScoreGauge label="커버리지" value={side.result.scores.coverage} />
        <ScoreGauge label="시너지" value={side.result.scores.synergy} />
        <ScoreGauge label="균형" value={side.result.scores.balance} />
      </div>
      <div className="mt-2 font-mono text-[11px]">
        <span className="text-muted">Elo </span>
        {typeof prev === "number" ? (
          <span className="text-body">{prev}→<span className="font-bold text-primary">{next}</span></span>
        ) : (
          <span className="font-bold text-primary">{next}</span>
        )}
        {diff !== null && diff !== 0 && (
          <span className={diff > 0 ? "ml-1 text-accent-emerald" : "ml-1 text-accent-rose"}>
            {diff > 0 ? `+${diff}` : diff}
          </span>
        )}
      </div>
      {side.result.comment && (
        <p className="mt-2 border-t border-hairline pt-2 text-xs leading-relaxed text-muted">
          {side.result.comment}
        </p>
      )}
    </div>
  );
}
