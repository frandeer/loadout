import { useNavigate } from "react-router-dom";
import { useStore } from "../hooks/useStore";
import { RARITY_CONFIG } from "../types";

export function EquippedBar() {
  const navigate = useNavigate();
  const items = useStore((s) => s.items);
  const setSelected = useStore((s) => s.setSelected);

  const equipped = items.filter((i) => i.equipped);
  const shown = equipped.slice(0, 5);
  const overflow = equipped.length - shown.length;

  if (equipped.length === 0) return null;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => navigate("/loadout")}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") navigate("/loadout"); }}
      title="장착·보관 보기"
      className="fixed inset-x-0 bottom-0 z-40 cursor-pointer border-t border-hairline bg-canvas/95 backdrop-blur-xl transition-colors hover:bg-surface-soft/95"
    >
      <div className="mx-auto flex max-w-[1800px] items-center gap-4 px-5 h-12">
        <span className="shrink-0 text-sm font-semibold text-ink">
          현재 장착 <span className="font-mono">{equipped.length}</span>개
        </span>

        {/* 장착 칩 */}
        <div className="flex flex-1 items-center gap-2 overflow-x-auto">
          {shown.map((item) => {
            const r = RARITY_CONFIG[item.rarity];
            return (
              <button
                key={item.id}
                onClick={(e) => { e.stopPropagation(); setSelected(item.id); }}
                className="flex items-center gap-1.5 rounded-lg border border-hairline bg-canvas px-2.5 py-1 text-xs font-medium text-body transition hover:border-primary hover:bg-primary-soft shrink-0"
              >
                <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: r.color }} />
                <span className="max-w-[90px] truncate">{item.displayName}</span>
                <span className="rounded bg-surface-soft px-1 py-0.5 text-[8px] font-semibold uppercase text-muted">
                  {item.kind}
                </span>
              </button>
            );
          })}
          {overflow > 0 && (
            <span className="rounded-lg bg-surface-soft px-2 py-1 text-xs font-medium text-muted shrink-0">
              +{overflow}개 더
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
