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
        {/* Clone from URL */}
        <div>
          <label className="mb-1 block text-xs font-semibold text-zinc-400">
            GitHub URL로 Clone
          </label>
          <div className="flex gap-2">
            <input
              type="url"
              placeholder="https://github.com/owner/repo"
              value={cloneUrl}
              onChange={(e) => setCloneUrl(e.target.value)}
              className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none"
            />
            <button
              onClick={handleClone}
              disabled={loading}
              className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-amber-400 disabled:opacity-50"
            >
              Clone
            </button>
          </div>
        </div>

        {/* Add source path */}
        <div>
          <label className="mb-1 block text-xs font-semibold text-zinc-400">
            로컬 경로 추가
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="D:/path/to/skills"
              value={addPath}
              onChange={(e) => setAddPath(e.target.value)}
              className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none"
            />
            <button
              onClick={handleAddSource}
              disabled={loading}
              className="rounded-lg bg-zinc-800 px-4 py-2 text-sm text-zinc-300 transition hover:bg-zinc-700 disabled:opacity-50"
            >
              추가
            </button>
          </div>
        </div>

        {/* Source list */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-xs font-semibold text-zinc-400">등록된 소스</h4>
            <button
              onClick={handleRescan}
              disabled={loading}
              className="rounded bg-zinc-800 px-3 py-1 text-xs text-zinc-400 transition hover:bg-zinc-700 hover:text-white disabled:opacity-50"
            >
              전체 재스캔
            </button>
          </div>
          <div className="space-y-2">
            {roots.length === 0 ? (
              <p className="text-sm text-zinc-500">등록된 소스가 없습니다.</p>
            ) : (
              roots.map((r) => (
                <div
                  key={r.path}
                  className={`flex items-center justify-between rounded-lg border p-3 ${
                    r.exists
                      ? "border-zinc-800 bg-zinc-900/50"
                      : "border-red-500/20 bg-red-500/5"
                  }`}
                >
                  <div>
                    <div className="text-sm font-medium text-white">{r.path}</div>
                    <div className="text-xs text-zinc-500">
                      {r.claude && "~/.claude · "}
                      {r.exists ? `${r.count.toLocaleString()}개 자산` : "경로 없음"}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemove(r.path)}
                    disabled={loading}
                    className="rounded bg-zinc-800 px-3 py-1 text-xs text-zinc-400 transition hover:bg-red-500/20 hover:text-red-400 disabled:opacity-50"
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
