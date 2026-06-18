import { useState, useEffect } from "react";
import { Modal } from "./Modal";
import { api } from "../lib/api";
import { useStore } from "../hooks/useStore";
import { Icon } from "./Icon";

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
      <div className="space-y-5">
        {/* GitHub clone */}
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">
            GitHub URL로 Clone
          </label>
          <div className="flex gap-2">
            <input
              type="url"
              placeholder="https://github.com/owner/repo"
              value={cloneUrl}
              onChange={(e) => setCloneUrl(e.target.value)}
              className="flex-1 rounded-lg border border-hairline bg-canvas px-3 py-2 text-sm text-ink placeholder:text-muted-soft focus:border-primary focus:outline-none"
            />
            <button
              onClick={handleClone}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white transition hover:bg-primary-active disabled:opacity-50"
            >
              <Icon name="download" size="sm" className="text-white" /> Clone
            </button>
          </div>
        </div>

        {/* 로컬 경로 */}
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">
            로컬 경로 추가
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="/path/to/skills"
              value={addPath}
              onChange={(e) => setAddPath(e.target.value)}
              className="flex-1 rounded-lg border border-hairline bg-canvas px-3 py-2 text-sm text-ink placeholder:text-muted-soft focus:border-primary focus:outline-none"
            />
            <button
              onClick={handleAddSource}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-lg border border-hairline px-4 py-2 text-sm font-medium text-body transition hover:bg-surface-soft disabled:opacity-50"
            >
              <Icon name="add" size="sm" /> 추가
            </button>
          </div>
        </div>

        {/* 소스 목록 */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wide text-muted">등록된 소스</h4>
            <button
              onClick={handleRescan}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-lg border border-hairline px-3 py-1.5 text-xs font-medium text-body transition hover:bg-surface-soft disabled:opacity-50"
            >
              <Icon name="refresh" size="xs" /> {loading ? "작업 중..." : "전체 재스캔"}
            </button>
          </div>
          <div className="space-y-2">
            {roots.length === 0 ? (
              <p className="text-sm text-muted">등록된 소스가 없습니다.</p>
            ) : (
              roots.map((r) => (
                <div
                  key={r.path}
                  className={`flex items-center justify-between rounded-lg border p-3 ${
                    r.exists ? "border-hairline bg-surface-soft" : "border-accent-rose/30 bg-accent-rose/5"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="truncate font-mono text-sm text-ink">{r.path}</div>
                    <div className="text-xs text-muted">
                      {r.claude && "~/.claude · "}
                      {r.exists ? `${r.count.toLocaleString()}개 자산` : "경로 없음"}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemove(r.path)}
                    disabled={loading}
                    className="ml-3 flex shrink-0 items-center gap-1 rounded-lg border border-hairline px-3 py-1.5 text-xs text-muted transition hover:border-accent-rose hover:text-accent-rose disabled:opacity-50"
                  >
                    <Icon name="delete" size="xs" /> 제거
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
