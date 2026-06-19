import { useEffect, useState } from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
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
import { HelpPage } from "./components/HelpPage";

export type AppView = "deck" | "ops" | "inventory" | "forge" | "help";

/** 덱(컬렉션) 레이아웃 — "/deck" 라우트 전용 */
function DeckView() {
  const selected = useStore((s) => s.selected);
  const panelWidth = useStore((s) => s.panelWidth);

  return (
    <>
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

      {/* 좁은 화면에서 카드 선택 시 오버레이 */}
      {selected && (
        <div className="xl:hidden">
          <DetailPanel variant="overlay" />
        </div>
      )}
    </>
  );
}

/** 덱 외 탭(작전 준비/인벤토리/포지/도움말) 공통 래퍼 — 카드 선택 시 오버레이 유지 */
function PageView({ children }: { children: React.ReactNode }) {
  const selected = useStore((s) => s.selected);
  return (
    <>
      {children}
      {selected && <DetailPanel variant="overlay" />}
    </>
  );
}

export default function App() {
  const loadData = useStore((s) => s.loadData);
  const [sourceOpen, setSourceOpen] = useState(false);

  useEffect(() => {
    loadData();
    ensureAtlas();
  }, []);

  return (
    <HashRouter>
      <div className="min-h-screen bg-surface-app text-body">
        <Header onOpenSources={() => setSourceOpen(true)} />

        <Routes>
          <Route path="/" element={<Navigate to="/deck" replace />} />
          <Route path="/deck" element={<DeckView />} />
          <Route path="/ops" element={<PageView><OpsRoom /></PageView>} />
          <Route path="/inventory" element={<PageView><Inventory /></PageView>} />
          <Route path="/forge" element={<PageView><Forge /></PageView>} />
          <Route path="/help" element={<PageView><HelpPage /></PageView>} />
          <Route path="*" element={<Navigate to="/deck" replace />} />
        </Routes>

        <EquippedBar />
        <BatchBar />
        <SourceManager open={sourceOpen} onClose={() => setSourceOpen(false)} />
      </div>
    </HashRouter>
  );
}
