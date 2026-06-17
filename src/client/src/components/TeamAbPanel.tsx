import { useState } from "react";
import { api } from "../lib/api";
import { useStore } from "../hooks/useStore";
import type { TeamAbResp, TeamAbSide } from "../types";
import { ScoreGauge } from "./TeamEvalPanel";

/* 팀 A/B 대전 — 저장된 작전 프리셋 2개를 같은 시나리오로 교전시켜 승패·Elo 변동을 본다.
   POST /api/team/ab {aId,bId,scenario?,engine?} → {ok,a,b,winner,delta,elo:{a,b}}.
   평가 2회라 최대 ~50s. 성공 시 서버가 teams.json elo를 영속 → 로컬 presets도 즉시 갱신. */
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
  // 대전 전 Elo(변동 표기용) — 결과 시점 prev 값 스냅샷
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
        // 서버가 영속한 새 Elo를 로컬 presets에도 반영 → 프리셋 행 뱃지 즉시 갱신
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
        <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">A/B 대전</h3>
        {result && (
          <span className="border border-line bg-panel2 px-2 py-0.5 font-mono text-[9px] text-signal-dim">
            {result.a.result.engine}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <TeamSelect label="팀 A" value={aId} exclude={bId} list={presetList} onChange={setAId} />
        <span className="font-mono text-xs text-ink-faint">VS</span>
        <TeamSelect label="팀 B" value={bId} exclude={aId} list={presetList} onChange={setBId} />
        <input
          value={scenario}
          onChange={(e) => setScenario(e.target.value)}
          placeholder="시나리오 — 예: 대규모 리팩토링 작전"
          className="h-9 w-56 border border-line bg-panel2 px-3 text-sm text-ink placeholder:text-ink-faint focus:border-signal-dim focus:outline-none"
        />
        <select
          value={engine}
          onChange={(e) => setEngine(e.target.value)}
          aria-label="대전 엔진"
          className="h-9 border border-line bg-panel2 px-2 font-mono text-xs text-ink-dim focus:border-signal-dim focus:outline-none"
        >
          {engines.map((e) => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>
        <button
          onClick={fight}
          disabled={!canFight}
          title={!enough ? "저장된 작전이 2개 이상 필요합니다" : aId && aId === bId ? "서로 다른 두 작전을 선택하세요" : undefined}
          className="hud-frame bg-gold/10 px-5 py-2 text-sm font-semibold text-gold transition hover:bg-gold/20 disabled:opacity-40"
          style={{ "--hud-c": "var(--color-gold)" } as React.CSSProperties}
        >
          {loading ? "모의 작전 교전 중… (~50s)" : "대전 개시"}
        </button>
        {error && <span className="font-mono text-xs text-danger">{error}</span>}
      </div>

      {!enough && (
        <p className="mt-2 font-mono text-[11px] text-ink-faint">
          저장된 작전이 2개 이상이어야 대전할 수 있습니다 — 위에서 작전을 저장하세요.
        </p>
      )}

      {result && (
        <div
          className="hud-frame mt-3 border border-line bg-panel p-4"
          style={{ "--hud-c": "var(--color-gold)" } as React.CSSProperties}
          data-testid="team-ab-result"
        >
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
            <SideCard side={result.a} won={result.winner === "a"} prev={prevElo?.a} next={result.elo.a} />
            <div className="text-center">
              <div className="text-2xl" data-testid="ab-verdict">
                {result.winner === "draw" ? "무승부" : "🏆"}
              </div>
              <div className="mt-1 font-mono text-[10px] uppercase tracking-widest text-ink-faint">
                {result.winner === "draw" ? "DRAW" : result.winner === "a" ? "← 팀 A" : "팀 B →"}
              </div>
              <div className="mt-1 font-mono text-xs text-gold">Δ {result.delta}</div>
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
      className="h-9 max-w-[200px] border border-line bg-panel2 px-2 text-sm text-ink focus:border-signal-dim focus:outline-none"
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
    <div className={`border p-3 ${won ? "border-gold/60 bg-gold/5" : "border-line bg-panel2/40"}`}>
      <div className="mb-1 flex items-center gap-2">
        <span className="truncate text-sm font-semibold text-ink" title={side.name}>{side.name}</span>
        {won && <span className="font-mono text-[9px] text-gold">승</span>}
      </div>
      <div className="mb-2 flex items-baseline gap-2">
        <span className="font-mono text-3xl font-bold text-gold">{side.result.total}</span>
        <span className="font-mono text-[9px] text-ink-faint">/ 100</span>
      </div>
      <div className="space-y-1.5">
        <ScoreGauge label="커버리지" value={side.result.scores.coverage} />
        <ScoreGauge label="시너지" value={side.result.scores.synergy} />
        <ScoreGauge label="균형" value={side.result.scores.balance} />
      </div>
      {/* Elo 변동 */}
      <div className="mt-2 font-mono text-[11px]">
        <span className="text-ink-faint">Elo </span>
        {typeof prev === "number" ? (
          <span className="text-ink-dim">{prev}→<span className="text-signal">{next}</span></span>
        ) : (
          <span className="text-signal">{next}</span>
        )}
        {diff !== null && diff !== 0 && (
          <span className={diff > 0 ? "ml-1 text-signal" : "ml-1 text-danger"}>
            {diff > 0 ? `+${diff}` : diff}
          </span>
        )}
      </div>
      {side.result.comment && (
        <p className="mt-2 border-t border-line pt-2 text-xs leading-relaxed text-ink-dim">
          {side.result.comment}
        </p>
      )}
    </div>
  );
}
