import { useRef, useEffect, useCallback, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useStore } from "../hooks/useStore";
import { api } from "../lib/api";
import { Icon } from "./Icon";
import { SettingsPanel } from "./SettingsPanel";
import logoImg from "../assets/bolt-logo.png";
import type { AppView } from "../App";
import type { IconName } from "./Icon";

const VIEW_TABS: { key: AppView; path: string; label: string; icon: IconName }[] = [
  { key: "dashboard", path: "/dashboard", label: "대시보드", icon: "dashboard-grid" },
  { key: "assets", path: "/assets", label: "자산", icon: "library-books" },
  { key: "graph", path: "/graph", label: "그래프", icon: "network" },
  { key: "loadout", path: "/loadout", label: "장착·보관", icon: "backpack" },
];

interface HeaderProps {
  onOpenSources: () => void;
}

export function Header({ onOpenSources }: HeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { filters, setFilter } = useStore();
  const reloadData = useStore((s) => s.reloadData);
  const searchRef = useRef<HTMLInputElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const [rescanning, setRescanning] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsPanelOpen, setSettingsPanelOpen] = useState(false);

  const handleRescan = useCallback(async () => {
    setRescanning(true);
    try {
      await api.rescan();
      await reloadData();
    } finally {
      setRescanning(false);
    }
  }, [reloadData]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
      if (e.key === "Escape") setSettingsOpen(false);
    };
    const onClickOutside = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClickOutside);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClickOutside);
    };
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-hairline bg-canvas/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1800px] items-center gap-4 px-5 h-14">
        {/* 로고 */}
        <div className="flex items-center gap-2 shrink-0">
          <img src={logoImg} alt="LOADOUT Logo" className="h-8 w-8 object-contain" />
          <span className="text-base font-black tracking-wide text-ink" style={{ fontFamily: "var(--font-display)" }}>
            LOADOUT
          </span>
        </div>

        {/* 글로벌 검색 */}
        <div className="relative flex-1 max-w-xs">
          <Icon name="search" size="sm" className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" />
          <input
            ref={searchRef}
            type="search"
            placeholder="에셋, 스킬, MCP 검색..."
            value={filters.q}
            onChange={(e) => setFilter("q", e.target.value)}
            className="h-9 w-full rounded-[10px] bg-surface-soft pl-9 pr-12 text-sm text-ink placeholder:text-muted-soft focus:bg-canvas focus:ring-2 focus:ring-primary/10 focus:outline-none transition-colors"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 rounded border border-hairline bg-canvas px-1.5 py-0.5 font-mono text-[10px] text-muted-soft">
            ⌘K
          </kbd>
        </div>

        {/* 메인 탭 */}
        <nav className="flex items-center">
          {VIEW_TABS.map((t) => {
            const path = location.pathname === "/" ? "/dashboard" : location.pathname;
            const active = path === t.path;
            return (
              <button
                key={t.key}
                onClick={() => navigate(t.path)}
                className={`relative flex items-center gap-1.5 px-3.5 py-1.5 text-sm font-semibold rounded-lg transition-colors ${
                  active
                    ? "bg-primary-soft text-primary"
                    : "text-muted hover:text-ink hover:bg-surface-soft"
                }`}
              >
                <Icon name={t.icon} size="sm" />
                {t.label}
              </button>
            );
          })}
        </nav>

        {/* 유틸리티 액션 */}
        <div className="flex items-center gap-2 ml-auto shrink-0">
          <button
            onClick={onOpenSources}
            className="flex items-center gap-1.5 rounded-lg bg-surface-soft px-3 py-2 text-xs font-semibold text-body hover:bg-hairline transition-colors"
          >
            <Icon name="add" size="sm" /> 새로 추가
          </button>
          <button
            onClick={handleRescan}
            disabled={rescanning}
            className="flex items-center gap-1.5 rounded-lg bg-surface-soft px-3 py-2 text-xs font-semibold text-body hover:bg-hairline transition-colors disabled:opacity-50"
          >
            <Icon name="sync" size="sm" className={rescanning ? "animate-spin" : ""} />
            {rescanning ? "스캔 중..." : "가져오기"}
          </button>

          {/* 설정 */}
          <div className="relative" ref={settingsRef}>
            <button
              onClick={() => setSettingsOpen(!settingsOpen)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-surface-soft transition-colors"
              title="설정"
            >
              <Icon name="settings" size="md" />
            </button>
            {settingsOpen && (
              <div className="absolute right-0 top-full mt-1 w-48 rounded-lg border border-hairline bg-canvas py-1.5 shadow-lg z-50">
                <button
                  onClick={() => { setSettingsPanelOpen(true); setSettingsOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-body hover:bg-surface-soft"
                >
                  <Icon name="gear-alt" size="sm" /> 이미지 엔진 설정
                </button>
                <button
                  onClick={() => { handleRescan(); setSettingsOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-body hover:bg-surface-soft"
                >
                  <Icon name="sync" size="sm" /> 다시 스캔
                </button>
                <button
                  onClick={() => { onOpenSources(); setSettingsOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-body hover:bg-surface-soft"
                >
                  <Icon name="folder" size="sm" /> 소스 관리
                </button>
                <div className="my-1 border-t border-hairline" />
                <button
                  onClick={() => { navigate("/forge"); setSettingsOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-body hover:bg-surface-soft"
                >
                  <Icon name="wrench" size="sm" /> 포지
                </button>
                <button
                  onClick={() => { navigate("/help"); setSettingsOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-body hover:bg-surface-soft"
                >
                  <Icon name="help" size="sm" /> 도움말
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <SettingsPanel open={settingsPanelOpen} onClose={() => setSettingsPanelOpen(false)} />
    </header>
  );
}
