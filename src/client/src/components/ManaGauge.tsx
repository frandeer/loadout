import { MANA_BUDGET } from "../lib/traits";
import { formatK } from "../lib/utils";

export function ManaGauge({ cost, label = "컨텍스트 부하" }: { cost: number; label?: string }) {
  const ratio = cost / MANA_BUDGET;
  const pct = Math.min(100, ratio * 100);
  const over = ratio > 1;
  const high = ratio > 0.8;
  const color = over ? "var(--color-error)" : high ? "var(--color-warning)" : "var(--color-accent-emerald)";

  return (
    <div className="w-full">
      <div className="mb-1 flex items-center justify-between text-[10px]">
        <span className="font-bold uppercase tracking-wide text-muted">{label}</span>
        <span className="font-mono font-semibold" style={{ color }}>
          {formatK(cost)} / {formatK(MANA_BUDGET)} tk
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-surface-soft">
        {/* 보조기술 시맨틱: 막대 자체가 진행률(부하)을 나타내므로 progressbar role 부여 */}
        <div
          role="progressbar"
          aria-valuenow={cost}
          aria-valuemin={0}
          aria-valuemax={MANA_BUDGET}
          aria-label={`${label} (${formatK(cost)} / ${formatK(MANA_BUDGET)} 토큰)`}
          className="h-full rounded-full stat-bar-fill"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      {over && (
        <div className="mt-1 text-[10px] font-medium text-error">
          컨텍스트 과적재 경고
        </div>
      )}
    </div>
  );
}
