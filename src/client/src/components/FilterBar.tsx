import { useStore } from "../hooks/useStore";
import { RARITY_CONFIG, SORT_OPTIONS } from "../types";
import type { Kind, Rarity, SortKey } from "../types";

const KIND_TABS: { key: Kind | "all"; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "skill", label: "스킬" },
  { key: "agent", label: "요원" },
  { key: "mcp", label: "장비" },
  { key: "memory", label: "메모리" },
];

/** 덱(컬렉션) 전용 필터 보조 바 — 헤더에서 분리해 한 줄로 정리 */
export function FilterBar() {
  const { filters, setFilter } = useStore();

  return (
    <div className="border-b border-line bg-panel/60">
      <div className="mx-auto flex max-w-[1800px] flex-wrap items-center gap-3 px-5 py-2.5">
        <input
          type="search"
          placeholder="자산명·설명·저장소 검색"
          value={filters.q}
          onChange={(e) => setFilter("q", e.target.value)}
          className="h-8 w-56 border border-line bg-panel2 px-3 text-sm text-ink placeholder:text-ink-faint focus:border-signal-dim focus:outline-none lg:w-72"
        />

        <div className="flex gap-px bg-line p-px">
          {KIND_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setFilter("kind", t.key)}
              className={`px-3 py-1 text-xs font-medium transition ${
                filters.kind === t.key
                  ? "bg-panel3 text-signal"
                  : "bg-panel2 text-ink-dim hover:text-ink"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <select
          value={filters.rarity}
          onChange={(e) => setFilter("rarity", e.target.value as Rarity | "all")}
          className="h-8 border border-line bg-panel2 px-2 font-mono text-xs text-ink-dim focus:outline-none"
        >
          <option value="all">CLASS — 전체</option>
          {Object.entries(RARITY_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.ko}</option>
          ))}
        </select>

        <select
          value={filters.sort}
          onChange={(e) => setFilter("sort", e.target.value as SortKey)}
          className="h-8 border border-line bg-panel2 px-2 font-mono text-xs text-ink-dim focus:outline-none"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.key} value={o.key}>정렬 — {o.label}</option>
          ))}
        </select>

        <div className="ml-auto flex items-center gap-2">
          <Toggle active={filters.dupOnly} onClick={() => setFilter("dupOnly", !filters.dupOnly)} label="중복만" />
          <Toggle active={filters.equipOnly} onClick={() => setFilter("equipOnly", !filters.equipOnly)} label="투입만" />
          <Toggle active={filters.favOnly} onClick={() => setFilter("favOnly", !filters.favOnly)} label="★" />
        </div>
      </div>
    </div>
  );
}

function Toggle({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`border px-2.5 py-1 text-xs font-medium transition ${
        active
          ? "border-signal-dim bg-signal/10 text-signal"
          : "border-line bg-panel2 text-ink-dim hover:text-ink"
      }`}
    >
      {label}
    </button>
  );
}
