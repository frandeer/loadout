import { useState, useEffect } from "react";
import { Modal } from "./Modal";
import { api } from "../lib/api";
import { useStore } from "../hooks/useStore";

interface SourceManagerProps {
  open: boolean;
  onClose: () => void;
}

interface SourceRoot {
  path: string;
  exists: boolean;
  count: number;
  claude?: boolean;
}

export function SourceManager({ open, onClose }: SourceManagerProps) {
  const [roots, setRoots] = useState<SourceRoot[]>([]);
  const [cloneUrl, setCloneUrl] = useState("");
  const [addPath, setAddPath] = useState("");
  const [loading, setLoading] = useState(false);
  const reloadData = useStore((s) => s.reloadData);

  const fetchSources = async () => {
    try {
      const data = await api.getSources();
      setRoots(data.roots || []);
    } catch {}
  };

  useEffect(() => {
    if (open) fetchSources();
  }, [open]);

  const handleClone = async () => {
    if (!cloneUrl.trim()) return;
    setLoading(true);
    try {
      await api.clone(cloneUrl.trim());
      setCloneUrl("");
      await fetchSources();
      await reloadData();
    } catch {}
    setLoading(false);
  };

  const handleAddSource = async () => {
    if (!addPath.trim()) return;
    setLoading(true);
    try {
      await api.addSource(addPath.trim());
      setAddPath("");
      await fetchSources();
      await reloadData();
    } catch {}
    setLoading(false);
  };

  const handleRemove = async (path: string) => {
    setLoading(true);
    try {
      await api.removeSource(path);
      await fetchSources();
      await reloadData();
    } catch {}
    setLoading(false);
  };

  const handleRescan = async () => {
    setLoading(true);
    try {
      await api.rescan();
      await reloadData();
    } catch {}
    setLoading(false);
  };

  return (
    <Modal open={open} onClose={onClose} title="소스 관리" wide>
      <div className="space-y-4">
        {/* GitHub clone */}
        <div>
          <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-ink-faint">
            GitHub URL로 Clone
          </label>
          <div className="flex gap-2">
            <input
              type="url"
              placeholder="https://github.com/owner/repo"
              value={cloneUrl}
              onChange={(e) => setCloneUrl(e.target.value)}
              className="flex-1 border border-line bg-panel2 px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-signal-dim focus:outline-none"
            />
            <button
              onClick={handleClone}
              disabled={loading}
              className="bg-signal/15 px-4 py-2 text-sm font-semibold text-signal transition hover:bg-signal/25 disabled:opacity-50"
            >
              Clone
            </button>
          </div>
        </div>

        {/* 로컬 경로 */}
        <div>
          <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-ink-faint">
            로컬 경로 추가
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="/path/to/skills"
              value={addPath}
              onChange={(e) => setAddPath(e.target.value)}
              className="flex-1 border border-line bg-panel2 px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-signal-dim focus:outline-none"
            />
            <button
              onClick={handleAddSource}
              disabled={loading}
              className="border border-line bg-panel2 px-4 py-2 text-sm text-ink-dim transition hover:text-ink disabled:opacity-50"
            >
              추가
            </button>
          </div>
        </div>

        {/* 소스 목록 */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h4 className="font-mono text-[10px] uppercase tracking-widest text-ink-faint">등록된 소스</h4>
            <button
              onClick={handleRescan}
              disabled={loading}
              className="border border-line bg-panel2 px-3 py-1 text-xs text-ink-dim transition hover:text-ink disabled:opacity-50"
            >
              {loading ? "작업 중..." : "전체 재스캔"}
            </button>
          </div>
          <div className="space-y-2">
            {roots.length === 0 ? (
              <p className="text-sm text-ink-faint">등록된 소스가 없습니다.</p>
            ) : (
              roots.map((r) => (
                <div
                  key={r.path}
                  className={`flex items-center justify-between border p-3 ${
                    r.exists ? "border-line bg-panel2/60" : "border-danger/30 bg-danger/5"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="truncate font-mono text-sm text-ink">{r.path}</div>
                    <div className="font-mono text-[11px] text-ink-faint">
                      {r.claude && "~/.claude · "}
                      {r.exists ? `${r.count.toLocaleString()}개 자산` : "경로 없음"}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemove(r.path)}
                    disabled={loading}
                    className="ml-3 shrink-0 border border-line bg-panel2 px-3 py-1 text-xs text-ink-dim transition hover:border-danger hover:text-danger disabled:opacity-50"
                  >
                    제거
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
