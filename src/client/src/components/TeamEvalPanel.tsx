import { useState } from "react";
import { api } from "../lib/api";
import type { TeamEvalResult } from "../types";

/* 팀 단위 AI 평가 — 현재 편성을 시나리오에 대해 채점.
   POST /api/team/verify {teamId?, slots?, scenario?, engine?} → {ok, result}.
   결과는 BLACK-ORCHID 테마 패널: total 큰 숫자 + 3게이지 + 한국어 총평 + engine 뱃지. */
export function TeamEvalPanel({
  slots,
  engines,
  teamId,
}: {
  slots: Record<string, string | null>; // 역할명 → itemId (서버 평가 프롬프트가 역할명 사용)
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
        <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">팀 AI 평가</h3>
        {result && (
          <span className="border border-line bg-panel2 px-2 py-0.5 font-mono text-[9px] text-signal-dim">
            {result.engine}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={scenario}
          onChange={(e) => setScenario(e.target.value)}
          placeholder="시나리오 — 예: 대규모 리팩토링 작전"
          className="h-9 w-64 border border-line bg-panel2 px-3 text-sm text-ink placeholder:text-ink-faint focus:border-signal-dim focus:outline-none"
        />
        <select
          value={engine}
          onChange={(e) => setEngine(e.target.value)}
          aria-label="평가 엔진"
          className="h-9 border border-line bg-panel2 px-2 font-mono text-xs text-ink-dim focus:border-signal-dim focus:outline-none"
        >
          {engines.map((e) => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>
        <button
          onClick={evaluate}
          disabled={!hasMembers || loading}
          className="hud-frame bg-signal/10 px-5 py-2 text-sm font-semibold text-signal transition hover:bg-signal/20 disabled:opacity-40"
          style={{ "--hud-c": "var(--color-signal-dim)" } as React.CSSProperties}
        >
          {loading ? "평가 중... (~25s)" : "팀 평가"}
        </button>
        {error && <span className="font-mono text-xs text-danger">{error}</span>}
      </div>

      {result && (
        <div
          className="hud-frame mt-3 border border-line bg-panel p-4"
          style={{ "--hud-c": "var(--color-gold)" } as React.CSSProperties}
          data-testid="team-eval-result"
        >
          <div className="flex flex-wrap items-center gap-6">
            <div className="text-center">
              <div className="font-mono text-[10px] uppercase tracking-widest text-ink-faint">종합 점수</div>
              <div className="font-mono text-4xl font-bold text-gold">{result.total}</div>
              <div className="font-mono text-[9px] text-ink-faint">/ 100</div>
            </div>
            <div className="flex-1 space-y-2">
              <ScoreGauge label="커버리지" value={result.scores.coverage} />
              <ScoreGauge label="시너지" value={result.scores.synergy} />
              <ScoreGauge label="균형" value={result.scores.balance} />
            </div>
          </div>
          {result.comment && (
            <p className="mt-3 border-t border-line pt-3 text-sm leading-relaxed text-ink-dim">
              {result.comment}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

/* 단일 스탯 게이지 — 0-100. 80↑ 골드, 50↑ 시그널, 그 외 dim. */
export function ScoreGauge({ label, value }: { label: string; value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  const color = pct >= 80 ? "var(--color-gold)" : pct >= 50 ? "var(--color-signal)" : "var(--color-signal-dim)";
  return (
    <div className="w-full">
      <div className="mb-1 flex items-center justify-between font-mono text-[10px]">
        <span className="uppercase tracking-widest text-ink-faint">{label}</span>
        <span style={{ color }}>{value}</span>
      </div>
      <div className="h-1.5 w-full bg-panel3">
        <div
          className="h-full transition-all duration-300"
          style={{ width: `${pct}%`, backgroundColor: color, boxShadow: `0 0 6px ${color}66` }}
        />
      </div>
    </div>
  );
}
