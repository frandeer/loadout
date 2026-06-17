import { useEffect, useState } from "react";
import { useStore } from "./hooks/useStore";
import { Header } from "./components/Header";
import { FilterBar } from "./components/FilterBar";
import { CardGrid } from "./components/CardGrid";
import { DetailPanel } from "./components/DetailPanel";
import { BatchBar } from "./components/BatchBar";
import { OpsRoom } from "./components/OpsRoom";
import { Inventory } from "./components/Inventory";
import { SourceManager } from "./components/SourceManager";
import { Forge } from "./components/Forge";

export type AppView = "deck" | "ops" | "inventory" | "forge";

export default function App() {
  const loadData = useStore((s) => s.loadData);
  const selected = useStore((s) => s.selected);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [view, setView] = useState<AppView>("deck");

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="min-h-screen text-ink">
      <Header view={view} onSetView={setView} onOpenSources={() => setSourceOpen(true)} />

      {view === "deck" && (
        <>
          <FilterBar />
          <main className="mx-auto max-w-[1800px] px-5 py-4">
            {/* 마스터-디테일: 그리드 + 우측 고정 인텔 패널(데스크톱 ≥1280px) */}
            <div className="flex gap-5">
              <div className="min-w-0 flex-1">
                <CardGrid />
              </div>
              <aside className="sticky top-4 hidden h-[calc(100vh-6.5rem)] w-[360px] shrink-0 self-start xl:block 2xl:w-[400px]">
                <DetailPanel variant="docked" />
              </aside>
            </div>
          </main>
          {/* 좁은 화면(<1280px)에서는 기존 오버레이 동작 유지 */}
          {selected && (
            <div className="xl:hidden">
              <DetailPanel variant="overlay" />
            </div>
          )}
        </>
      )}
      {view === "ops" && <OpsRoom />}
      {view === "inventory" && <Inventory />}
      {view === "forge" && <Forge />}

      {/* 덱 외 탭은 오버레이 유지 */}
      {view !== "deck" && selected && <DetailPanel variant="overlay" />}
      <BatchBar />
      <SourceManager open={sourceOpen} onClose={() => setSourceOpen(false)} />
    </div>
  );
}
