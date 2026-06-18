import { useState } from "react";
import { api } from "../lib/api";
import type { TeamEvalResult } from "../types";
import { Icon } from "./Icon";

export function TeamEvalPanel({
  slots,
  engines,
  teamId,
}: {
  slots: Record<string, string | null>;
  engines: string[];
  teamId?: string;
}) {
  const [scenario, setScenario] = useState("");
  const [engine, setEngine] = useState(engines[0] ?? "heuristic");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<TeamEvalResult | null>(null);

  const hasMembers = Object.values(slots).some(Boolean);

  const evaluate = async () => {
    if (!hasMembers || loading) return;
    setLoading(true);
    setError("");
    try {
      const resp = await api.teamVerify({
        teamId,
        slots,
        scenario: scenario.trim() || "범용 코딩 작업",
        engine,
      });
      if (resp.ok && resp.result) setResult(resp.result);
      else setError(resp.error || "평가에 실패했습니다");
    } catch {
      setError("평가 요청이 실패했습니다 — 서버 연결을 확인하세요");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mt-5">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wide text-muted">팀 AI 평가</h3>
        {result && (
          <span className="rounded-full bg-surface-soft px-2 py-0.5 text-[9px] font-medium text-muted">
            {result.engine}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={scenario}
          onChange={(e) => setScenario(e.target.value)}
          placeholder="시나리오 — 예: 대규모 리팩토링 작전"
          className="h-9 w-64 rounded-lg border border-hairline bg-canvas px-3 text-sm text-ink placeholder:text-muted-soft focus:border-primary focus:outline-none"
        />
        <select
          value={engine}
          onChange={(e) => setEngine(e.target.value)}
          aria-label="평가 엔진"
          className="h-9 rounded-lg border border-hairline bg-canvas px-2 font-mono text-xs text-body focus:border-primary focus:outline-none"
        >
          {engines.map((e) => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>
        <button
          onClick={evaluate}
          disabled={!hasMembers || loading}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2 text-sm font-bold text-white transition hover:bg-primary-active disabled:opacity-40"
        >
          <Icon name="bar-chart" size="sm" className="text-white" />
          {loading ? "평가 중... (~25s)" : "팀 평가"}
        </button>
        {error && <span className="text-xs text-accent-rose">{error}</span>}
      </div>

      {result && (
        <div
          className="mt-3 rounded-xl border border-hairline bg-canvas p-4"
          data-testid="team-eval-result"
        >
          <div className="flex flex-wrap items-center gap-6">
            <div className="text-center">
              <div className="text-[10px] font-bold uppercase tracking-wide text-muted">종합 점수</div>
              <div className="font-mono text-4xl font-bold text-accent-orange">{result.total}</div>
              <div className="text-[9px] text-muted-soft">/ 100</div>
            </div>
            <div className="flex-1 space-y-2">
              <ScoreGauge label="커버리지" value={result.scores.coverage} />
              <ScoreGauge label="시너지" value={result.scores.synergy} />
              <ScoreGauge label="균형" value={result.scores.balance} />
            </div>
          </div>
          {result.comment && (
            <p className="mt-3 border-t border-hairline pt-3 text-sm leading-relaxed text-muted">
              {result.comment}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

export function ScoreGauge({ label, value }: { label: string; value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  const color = pct >= 80 ? "var(--color-accent-orange)" : pct >= 50 ? "var(--color-primary)" : "var(--color-muted)";
  return (
    <div className="w-full">
      <div className="mb-1 flex items-center justify-between text-[10px]">
        <span className="font-bold uppercase tracking-wide text-muted">{label}</span>
        <span className="font-mono font-semibold" style={{ color }}>{value}</span>
      </div>
      <div className="h-2 w-full rounded-full bg-surface-soft">
        <div
          className="h-full rounded-full stat-bar-fill"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
