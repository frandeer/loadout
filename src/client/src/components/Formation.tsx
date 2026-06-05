import { useStore } from "../hooks/useStore";
import { RARITY_CONFIG } from "../types";

export function Formation() {
  const items = useStore((s) => s.items);
  const lang = useStore((s) => s.lang);
  const setSelected = useStore((s) => s.setSelected);

  const equipped = items.filter((i) => i.equipped);
  const byKind = {
    skill: equipped.filter((i) => i.kind === "skill"),
    agent: equipped.filter((i) => i.kind === "agent"),
    mcp: equipped.filter((i) => i.kind === "mcp"),
  };

  if (equipped.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-zinc-500">
        장착된 자산이 없습니다
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h3 className="text-sm font-bold text-white">포메이션</h3>
        <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-400">
          {equipped.length}개 장착
        </span>
      </div>

      {(["skill", "agent", "mcp"] as const).map((kind) => {
        const list = byKind[kind];
        if (list.length === 0) return null;
        return (
          <div key={kind}>
            <h4 className="mb-1.5 text-xs font-semibold uppercase text-zinc-500">
              {kind} ({list.length})
            </h4>
            <div className="space-y-1">
              {list.map((item) => {
                const r = RARITY_CONFIG[item.rarity];
                const name = lang === "ko" && item.nameKo ? item.nameKo : item.displayName;
                return (
                  <button
                    key={item.id}
                    onClick={() => setSelected(item.id)}
                    className="flex w-full items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-left transition hover:border-zinc-600"
                  >
                    <div
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: r.color }}
                    />
                    <span className="flex-1 truncate text-xs text-white">{name}</span>
                    <span className="text-[10px] font-mono text-zinc-500">
                      {item.score}pt
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
