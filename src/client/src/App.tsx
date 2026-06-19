import { useEffect, useState } from "react";
import { useStore } from "./hooks/useStore";
import { ensureAtlas } from "./lib/iconAtlas";
import { Header } from "./components/Header";
import { FilterRail } from "./components/FilterRail";
import { CardGrid } from "./components/CardGrid";
import { DetailPanel } from "./components/DetailPanel";
import { BatchBar } from "./components/BatchBar";
import { EquippedBar } from "./components/EquippedBar";
import { OpsRoom } from "./components/OpsRoom";
import { Inventory } from "./components/Inventory";
import { SourceManager } from "./components/SourceManager";
import { Forge } from "./components/Forge";

export type AppView = "deck" | "ops" | "inventory" | "forge";

export default function App() {
  const loadData = useStore((s) => s.loadData);
  const selected = useStore((s) => s.selected);
  const panelWidth = useStore((s) => s.panelWidth);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [view, setView] = useState<AppView>("deck");

  useEffect(() => {
    loadData();
    ensureAtlas();
  }, []);

  return (
    <div className="min-h-screen bg-surface-app text-body">
      <Header view={view} onSetView={setView} onOpenSources={() => setSourceOpen(true)} />

      {view === "deck" && (
        <div className="flex h-[calc(100vh-3.5rem)]">
          {/* 좌측 필터 레일 — 데스크톱만 */}
          <div className="hidden lg:block">
            <FilterRail />
          </div>

          {/* 중앙 대시보드 */}
          <main className="flex-1 overflow-y-auto px-6 py-6 pb-24">
            <CardGrid />
          </main>

          {/* 우측 인스펙터 — 카드 선택 시에만 표시(닫으면 카드 영역이 flex-1로 그 공간을 채움) */}
          {selected && (
            <aside
              style={{ width: `${panelWidth}px` }}
              className="hidden shrink-0 overflow-y-auto border-l border-hairline bg-canvas xl:block"
            >
              <DetailPanel variant="docked" />
            </aside>
          )}
        </div>
      )}

      {view === "ops" && <OpsRoom />}
      {view === "inventory" && <Inventory />}
      {view === "forge" && <Forge />}

      {/* 좁은 화면에서 카드 선택 시 오버레이 */}
      {view === "deck" && selected && (
        <div className="xl:hidden">
          <DetailPanel variant="overlay" />
        </div>
      )}
      {/* 덱 외 탭 오버레이 */}
      {view !== "deck" && selected && <DetailPanel variant="overlay" />}

      <EquippedBar />
      <BatchBar />
      <SourceManager open={sourceOpen} onClose={() => setSourceOpen(false)} />
    </div>
  );
}
