import { useStore } from "../hooks/useStore";
import type { AppView } from "../App";

const VIEW_TABS: { key: AppView; label: string; code: string }[] = [
  { key: "deck", label: "덱", code: "01" },
  { key: "ops", label: "작전 준비", code: "02" },
  { key: "inventory", label: "인벤토리", code: "03" },
  { key: "forge", label: "포지", code: "04" },
];

interface HeaderProps {
  view: AppView;
  onSetView: (v: AppView) => void;
  onOpenSources: () => void;
}

export function Header({ view, onSetView, onOpenSources }: HeaderProps) {
  const { meta, lang, setLang, items } = useStore();
  const equippedCount = items.filter((i) => i.equipped).length;

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-void/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1800px] items-stretch gap-6 px-5">
        {/* 마크 */}
        <div className="flex items-center gap-3 py-3">
          <div className="hud-frame flex h-9 w-9 items-center justify-center bg-panel2 font-mono text-sm font-semibold text-signal" style={{ "--hud-c": "var(--color-signal-dim)" } as React.CSSProperties}>
            L
          </div>
          <div className="leading-tight">
            <div className="text-sm font-bold tracking-[0.18em] text-ink">LOADOUT</div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-ink-faint">
              black-orchid console
            </div>
          </div>
        </div>

        {/* 뷰 탭 */}
        <nav className="flex flex-1 items-stretch gap-1">
          {VIEW_TABS.map((t) => {
            const active = view === t.key;
            return (
              <button
                key={t.key}
                onClick={() => onSetView(t.key)}
                className={`relative flex items-center gap-2 px-4 text-sm transition ${
                  active ? "text-signal" : "text-ink-dim hover:text-ink"
                }`}
              >
                <span className="font-mono text-[10px] text-ink-faint">{t.code}</span>
                <span className={active ? "font-semibold" : "font-medium"}>{t.label}</span>
                {active && (
                  <span className="absolute inset-x-3 bottom-0 h-0.5 bg-signal shadow-[0_0_8px_rgba(61,245,165,0.6)]" />
                )}
              </button>
            );
          })}
        </nav>

        {/* 상태 + 유틸 */}
        <div className="flex items-center gap-4 py-3">
          <div className="hidden items-center gap-4 font-mono text-[11px] text-ink-dim md:flex">
            <span>
              <span className="text-ink-faint">자산 </span>
              <span className="text-ink">{meta ? meta.total.toLocaleString() : "—"}</span>
            </span>
            <span>
              <span className="text-ink-faint">투입 </span>
              <span className="text-signal">{equippedCount}</span>
            </span>
            <span className="flex items-center gap-1.5 text-signal-dim">
              <span className="blink inline-block h-1.5 w-1.5 rounded-full bg-signal" />
              ONLINE
            </span>
          </div>
          <button
            onClick={onOpenSources}
            className="hud-frame bg-panel2 px-3 py-1.5 text-xs text-ink-dim transition hover:text-ink"
          >
            소스 관리
          </button>
          <button
            onClick={() => setLang(lang === "ko" ? "en" : "ko")}
            className="font-mono text-[11px] text-ink-faint transition hover:text-ink"
            title="표시 언어 전환"
          >
            {lang === "ko" ? "KO" : "EN"}
          </button>
        </div>
      </div>
    </header>
  );
}
