import { MANA_BUDGET } from "../lib/traits";
import { formatK } from "../lib/utils";

/* 마나 게이지 — 컨텍스트 토큰 코스트 / MANA_BUDGET.
   80% 초과 시 골드, 100% 초과 시 danger + 과적재 경고. */
export function ManaGauge({ cost, label = "컨텍스트 부하" }: { cost: number; label?: string }) {
  const ratio = cost / MANA_BUDGET;
  const pct = Math.min(100, ratio * 100);
  const over = ratio > 1;
  const high = ratio > 0.8;
  const color = over ? "var(--color-danger)" : high ? "var(--color-gold)" : "var(--color-signal)";

  return (
    <div className="w-full">
      <div className="mb-1 flex items-center justify-between font-mono text-[10px]">
        <span className="uppercase tracking-widest text-ink-faint">{label}</span>
        <span style={{ color }}>
          {formatK(cost)} / {formatK(MANA_BUDGET)} tk
        </span>
      </div>
      <div className="h-1.5 w-full bg-panel3">
        <div
          className="h-full transition-all duration-300"
          style={{ width: `${pct}%`, backgroundColor: color, boxShadow: `0 0 6px ${color}66` }}
        />
      </div>
      {over && (
        <div className="mt-1 font-mono text-[10px] text-danger">
          덱 비대화 — 컨텍스트 과적재 경고
        </div>
      )}
    </div>
  );
}
