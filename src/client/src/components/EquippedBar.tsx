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
  // 다른 페이지에서 "현재 장착"을 한눈에 보는 글랜스 바. /loadout 에서는 숨긴다 —
  // 그 페이지 본문이 이미 전체 장착·보관 목록이라 중복이고, 하단에 배치 액션 바(z-50)가
  // 떠서 이 바(z-40)와 겹치며 바 뒤 칩 버튼이 포커스 트랩이 된다(H#3).
  // 바깥 컨테이너는 role=button 이 아니다(칩 버튼 중첩 WCAG 위반 제거) — 이동은 전용 버튼으로.
  const onLoadout = location.pathname === "/loadout";

  if (equipped.length === 0 || onLoadout) return null;

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

        {/* 바로가기 — 이 바는 /loadout 이 아닐 때만 렌더되므로 항상 표시. 전용 버튼이라 칩과 포커스가 충돌하지 않는다. */}
        <button
          onClick={() => navigate("/loadout")}
          aria-label="장착·보관 페이지 열기"
          className="shrink-0 rounded-lg border border-hairline bg-canvas px-2.5 py-1 text-xs font-medium text-body transition hover:border-primary hover:bg-primary-soft"
        >
          장착·보관 →
        </button>
      </div>
    </div>
  );
}
