import { useLocation, useNavigate } from "react-router-dom";
import { useStore } from "../hooks/useStore";
import { RARITY_CONFIG } from "../types";

export function EquippedBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const items = useStore((s) => s.items);
  const setSelected = useStore((s) => s.setSelected);

  const equipped = items.filter((i) => i.equipped);
  const shown = equipped.slice(0, 5);
  const overflow = equipped.length - shown.length;
  // 전 페이지에 걸친 "현재 장착" 글랜스 바(원래 동작 유지). /loadout 에서는 본문이 이미
  // 전체 목록이라 바로가기 버튼만 숨긴다. 바깥 컨테이너는 더 이상 role=button 이 아니다
  // (칩 버튼을 role=button 안에 중첩하던 WCAG 위반 제거) — 이동은 전용 버튼으로 한다.
  const onLoadout = location.pathname === "/loadout";

  if (equipped.length === 0) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-canvas/95 backdrop-blur-xl"
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
                aria-label={`${item.displayName} (${item.kind}) 카드 열기`}
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

        {/* 바로가기 — /loadout 이 아닐 때만(이미 그 페이지면 불필요). 전용 버튼이라 칩과 포커스가 충돌하지 않는다. */}
        {!onLoadout && (
          <button
            onClick={() => navigate("/loadout")}
            aria-label="장착·보관 페이지 열기"
            className="shrink-0 rounded-lg border border-hairline bg-canvas px-2.5 py-1 text-xs font-medium text-body transition hover:border-primary hover:bg-primary-soft"
          >
            장착·보관 →
          </button>
        )}
      </div>
    </div>
  );
}
