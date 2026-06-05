import { useStore } from "../hooks/useStore";
import { RARITY_CONFIG, SORT_OPTIONS } from "../types";
import type { Kind, Rarity, SortKey } from "../types";

const KIND_TABS: { key: Kind | "all"; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "skill", label: "Skill" },
  { key: "agent", label: "Agent" },
  { key: "mcp", label: "MCP" },
];

const RARITY_TABS: { key: Rarity | "all"; label: string }[] = [
  { key: "all", label: "ALL" },
  ...Object.entries(RARITY_CONFIG).map(([k, v]) => ({
    key: k as Rarity,
    label: v.ko,
  })),
];

interface HeaderProps {
  onOpenSources: () => void;
  onToggleFormation: () => void;
  showFormation: boolean;
}

export function Header({ onOpenSources, onToggleFormation, showFormation }: HeaderProps) {
  const { meta, filters, setFilter, theme, setTheme, lang, setLang } = useStore();

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-zinc-950/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1800px] items-center gap-4 px-4 py-3">
        <h1 className="shrink-0 text-lg font-bold tracking-tight text-white">
          <span className="text-amber-400">LOADOUT</span>
          <span className="ml-1.5 text-xs font-normal text-zinc-500">
            {meta ? `${meta.total.toLocaleString()} assets` : ""}
          </span>
        </h1>

        <div className="flex flex-1 items-center gap-2">
          <input
            type="search"
            placeholder="검색..."
            value={filters.q}
            onChange={(e) => setFilter("q", e.target.value)}
            className="h-8 w-48 rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm text-white placeholder:text-zinc-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500/30 lg:w-64"
          />

          <div className="flex gap-0.5 rounded-lg bg-zinc-900 p-0.5">
            {KIND_TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setFilter("kind", t.key)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  filters.kind === t.key
                    ? "bg-amber-500/20 text-amber-400"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <select
            value={filters.rarity}
            onChange={(e) => setFilter("rarity", e.target.value as Rarity | "all")}
            className="h-8 rounded-md border border-zinc-700 bg-zinc-900 px-2 text-xs text-white"
          >
            {RARITY_TABS.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>

          <select
            value={filters.sort}
            onChange={(e) => setFilter("sort", e.target.value as SortKey)}
            className="h-8 rounded-md border border-zinc-700 bg-zinc-900 px-2 text-xs text-white"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <ToggleBtn
            active={filters.dupOnly}
            onClick={() => setFilter("dupOnly", !filters.dupOnly)}
            label="중복"
          />
          <ToggleBtn
            active={filters.equipOnly}
            onClick={() => setFilter("equipOnly", !filters.equipOnly)}
            label="장착"
          />
          <ToggleBtn
            active={filters.favOnly}
            onClick={() => setFilter("favOnly", !filters.favOnly)}
            label="★"
          />

          <button
            onClick={onToggleFormation}
            className={`h-8 rounded-md border px-2.5 text-xs font-medium transition ${
              showFormation
                ? "border-amber-500/50 bg-amber-500/20 text-amber-400"
                : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            포메이션
          </button>
          <button
            onClick={onOpenSources}
            className="h-8 rounded-md border border-zinc-700 bg-zinc-900 px-2.5 text-xs text-zinc-400 hover:text-white"
          >
            소스
          </button>
          <button
            onClick={() => setLang(lang === "ko" ? "en" : "ko")}
            className="h-8 rounded-md border border-zinc-700 bg-zinc-900 px-2.5 text-xs text-zinc-400 hover:text-white"
          >
            {lang === "ko" ? "한국어" : "EN"}
          </button>
          <button
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            className="h-8 rounded-md border border-zinc-700 bg-zinc-900 px-2.5 text-xs text-zinc-400 hover:text-white"
          >
            {theme === "dark" ? "☀" : "☾"}
          </button>
        </div>
      </div>
    </header>
  );
}

function ToggleBtn({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`h-8 rounded-md border px-2.5 text-xs font-medium transition ${
        active
          ? "border-amber-500/50 bg-amber-500/20 text-amber-400"
          : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:text-zinc-200"
      }`}
    >
      {label}
    </button>
  );
}
