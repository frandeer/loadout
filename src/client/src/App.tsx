import { useEffect, useState } from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { useStore } from "./hooks/useStore";
import { Header } from "./components/Header";
import { FilterRail } from "./components/FilterRail";
import { CardGrid } from "./components/CardGrid";
import { DetailPanel } from "./components/DetailPanel";
import { BatchBar } from "./components/BatchBar";
import { EquippedBar } from "./components/EquippedBar";
import { Dashboard } from "./components/Dashboard";
import { GraphView } from "./components/GraphView";
import { Inventory } from "./components/Inventory";
import { SourceManager } from "./components/SourceManager";
import { Forge } from "./components/Forge";
import { HelpPage } from "./components/HelpPage";

export type AppView = "dashboard" | "assets" | "graph" | "loadout" | "forge" | "help";

/** 자산(컬렉션) 레이아웃 — "/assets" 라우트 전용 */
function AssetsView() {
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

/** 자산 외 탭(대시보드/그래프/장착·보관/포지/도움말) 공통 래퍼.
 *  카드 선택 시 우측 인스펙터가 본문을 "덮지" 않고 "밀어내도록" — 넓은 화면(xl)에서는
 *  본문에 패널 폭만큼 우측 패딩을 줘 도킹 효과를 낸다(/assets 의 도킹과 동일한 결과).
 *  좁은 화면에서는 패딩 없이 오버레이가 본문 위를 덮는다(/assets 모바일과 동일). */
function PageView({ children }: { children: React.ReactNode }) {
  const selected = useStore((s) => s.selected);
  return (
    <>
      <div className={selected ? "with-detail-panel" : undefined}>{children}</div>
      {selected && <DetailPanel variant="overlay" />}
    </>
  );
}

export default function App() {
  const loadData = useStore((s) => s.loadData);
  const error = useStore((s) => s.error);
  const dismissError = useStore((s) => s.dismissError);
  const [sourceOpen, setSourceOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  return (
    <HashRouter>
      <div className="min-h-screen bg-surface-app text-body">
        <Header onOpenSources={() => setSourceOpen(true)} />

        {/* 서버 연결 실패 등 데이터 로드 오류 배너 — 닫기·재시도 제공 */}
        {error && (
          <div
            role="alert"
            className="flex items-center gap-3 bg-amber-50 border-b border-amber-200 px-4 py-2 text-sm text-amber-900"
          >
            <span className="flex-1">{error}</span>
            <button
              type="button"
              onClick={() => loadData()}
              className="shrink-0 rounded px-2.5 py-1 text-xs font-medium bg-amber-100 hover:bg-amber-200 transition-colors"
            >
              다시 시도
            </button>
            <button
              type="button"
              aria-label="오류 배너 닫기"
              onClick={dismissError}
              className="shrink-0 rounded px-1.5 py-1 text-xs text-amber-700 hover:bg-amber-200 transition-colors"
            >
              ✕
            </button>
          </div>
        )}

        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<PageView><Dashboard /></PageView>} />
          <Route path="/assets" element={<AssetsView />} />
          <Route path="/graph" element={<PageView><GraphView /></PageView>} />
          <Route path="/loadout" element={<PageView><Inventory /></PageView>} />
          <Route path="/forge" element={<PageView><Forge /></PageView>} />
          <Route path="/help" element={<PageView><HelpPage /></PageView>} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>

        <EquippedBar />
        <BatchBar />
        <SourceManager open={sourceOpen} onClose={() => setSourceOpen(false)} />
      </div>
    </HashRouter>
  );
}
