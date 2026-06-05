import { useEffect, useState } from "react";
import { useStore } from "./hooks/useStore";
import { Header } from "./components/Header";
import { CardGrid } from "./components/CardGrid";
import { DetailPanel } from "./components/DetailPanel";
import { BatchBar } from "./components/BatchBar";
import { Formation } from "./components/Formation";
import { SourceManager } from "./components/SourceManager";

export default function App() {
  const loadData = useStore((s) => s.loadData);
  const selected = useStore((s) => s.selected);
  const theme = useStore((s) => s.theme);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [showFormation, setShowFormation] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    loadData();
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <Header
        onOpenSources={() => setSourceOpen(true)}
        onToggleFormation={() => setShowFormation((p) => !p)}
        showFormation={showFormation}
      />
      <div className="flex">
        <main className="mx-auto max-w-[1800px] flex-1 p-4">
          <CardGrid />
        </main>
        {showFormation && (
          <aside className="hidden w-72 shrink-0 border-l border-zinc-800 p-4 lg:block">
            <Formation />
          </aside>
        )}
      </div>
      {selected && <DetailPanel />}
      <BatchBar />
      <SourceManager open={sourceOpen} onClose={() => setSourceOpen(false)} />
    </div>
  );
}
