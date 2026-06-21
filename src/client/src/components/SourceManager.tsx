import { useState, useEffect } from "react";
import { Modal } from "./Modal";
import { api } from "../lib/api";
import { useStore } from "../hooks/useStore";
import { Icon } from "./Icon";
import { CardDrop } from "./CardDrop";

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
  const [sourcesError, setSourcesError] = useState<string | null>(null);
  const [cloneUrl, setCloneUrl] = useState("");
  const [addPath, setAddPath] = useState("");
  // 작업별 로딩 상태 — 전역 단일 플래그 대신 각 동작을 독립적으로 관리
  const [cloneLoading, setCloneLoading] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [removeLoading, setRemoveLoading] = useState<string | null>(null); // 제거 중인 경로
  const [rescanLoading, setRescanLoading] = useState(false);
  // 작업 오류 — 각 섹션에 인접하게 표시
  const [cloneError, setCloneError] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [rescanError, setRescanError] = useState<string | null>(null);
  const reloadData = useStore((s) => s.reloadData);

  const fetchSources = async () => {
    setSourcesError(null);
    try {
      const data = await api.getSources();
      setRoots(data.roots || []);
    } catch (err) {
      // 조회 실패를 "등록된 소스 없음"으로 오해하지 않도록 별도 오류 상태로 구분.
      setSourcesError(err instanceof Error ? err.message : "소스 목록을 불러오지 못했습니다 — 서버 연결을 확인하세요.");
    }
  };

  useEffect(() => {
    if (open) fetchSources();
  }, [open]);

  const handleClone = async () => {
    if (!cloneUrl.trim()) return;
    setCloneError(null);
    setCloneLoading(true);
    try {
      // api.ts 래퍼만 사용 — 실패 시 서버 error 메시지를 담아 throw 하므로 catch 에서 표시.
      await api.clone(cloneUrl.trim());
      setCloneUrl("");
      await fetchSources();
      await reloadData();
    } catch (err) {
      setCloneError(err instanceof Error ? err.message : String(err));
    }
    setCloneLoading(false);
  };

  const handleAddSource = async () => {
    if (!addPath.trim()) return;
    setAddError(null);
    setAddLoading(true);
    try {
      // api.ts 래퍼만 사용 — 실패 시 서버 error 메시지를 담아 throw 하므로 catch 에서 표시.
      await api.addSource(addPath.trim());
      setAddPath("");
      await fetchSources();
      await reloadData();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : String(err));
    }
    setAddLoading(false);
  };

  const handleRemove = async (path: string) => {
    setRemoveError(null);
    setRemoveLoading(path);
    try {
      // api.ts 래퍼만 사용 — 실패 시 서버 error 메시지를 담아 throw 하므로 catch 에서 표시.
      await api.removeSource(path);
      await fetchSources();
      await reloadData();
    } catch (err) {
      setRemoveError(err instanceof Error ? err.message : String(err));
    }
    setRemoveLoading(null);
  };

  const handleRescan = async () => {
    setRescanError(null);
    setRescanLoading(true);
    try {
      // api.ts 래퍼만 사용 — 실패 시 서버 error 메시지를 담아 throw 하므로 catch 에서 표시.
      await api.rescan();
      await reloadData();
    } catch (err) {
      setRescanError(err instanceof Error ? err.message : String(err));
    }
    setRescanLoading(false);
  };

  // 공통 오류 알림 컴포넌트 — 인라인 사용
  const ErrorNote = ({ msg }: { msg: string | null }) =>
    msg ? (
      <p className="mt-1.5 text-xs text-accent-rose">{msg}</p>
    ) : null;

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
              onChange={(e) => { setCloneUrl(e.target.value); setCloneError(null); }}
              onKeyDown={(e) => e.key === "Enter" && handleClone()}
              className="flex-1 rounded-lg border border-hairline bg-canvas px-3 py-2 text-sm text-ink placeholder:text-muted-soft focus:border-primary focus:outline-none"
            />
            <button
              onClick={handleClone}
              disabled={cloneLoading}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white transition hover:bg-primary-active disabled:opacity-50"
            >
              <Icon name="download" size="sm" className="text-white" /> {cloneLoading ? "Clone 중…" : "Clone"}
            </button>
          </div>
          <ErrorNote msg={cloneError} />
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
              onChange={(e) => { setAddPath(e.target.value); setAddError(null); }}
              onKeyDown={(e) => e.key === "Enter" && handleAddSource()}
              className="flex-1 rounded-lg border border-hairline bg-canvas px-3 py-2 text-sm text-ink placeholder:text-muted-soft focus:border-primary focus:outline-none"
            />
            <button
              onClick={handleAddSource}
              disabled={addLoading}
              className="flex items-center gap-1.5 rounded-lg border border-hairline px-4 py-2 text-sm font-medium text-body transition hover:bg-surface-soft disabled:opacity-50"
            >
              <Icon name="add" size="sm" /> {addLoading ? "추가 중…" : "추가"}
            </button>
          </div>
          <ErrorNote msg={addError} />
        </div>

        {/* 세션에서 스킬 추출 (카드 드랍) */}
        <div className="rounded-xl border border-hairline bg-canvas p-4">
          <div className="mb-1.5 flex items-center gap-1.5">
            <Icon name="lightning" size="xs" className="text-accent-orange" />
            <span className="text-xs font-bold uppercase tracking-wide text-muted">세션에서 스킬 추출</span>
          </div>
          <p className="mb-3 text-xs text-muted-soft">
            최근 세션에서 자주 쓴 해결 패턴을 새 스킬 카드로 추출합니다.
          </p>
          <CardDrop onReveal={onClose} />
        </div>

        {/* 소스 목록 */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wide text-muted">등록된 소스</h4>
            <button
              onClick={handleRescan}
              disabled={rescanLoading}
              className="flex items-center gap-1.5 rounded-lg border border-hairline px-3 py-1.5 text-xs font-medium text-body transition hover:bg-surface-soft disabled:opacity-50"
            >
              <Icon name="refresh" size="xs" /> {rescanLoading ? "재스캔 중..." : "전체 재스캔"}
            </button>
          </div>
          <ErrorNote msg={rescanError} />
          <ErrorNote msg={removeError} />
          {/* 소스 조회 실패 — 빈 목록(등록 없음)과 오류를 명확히 구분 */}
          {sourcesError && (
            <div
              role="alert"
              className="flex items-center justify-between gap-2 rounded-lg bg-accent-rose/5 px-3 py-2.5 text-xs text-accent-rose"
            >
              <span className="flex items-center gap-1.5">
                <Icon name="warning" size="xs" className="shrink-0" />
                {sourcesError}
              </span>
              <button
                onClick={fetchSources}
                className="shrink-0 font-semibold underline hover:no-underline"
              >
                다시 시도
              </button>
            </div>
          )}
          <div className="space-y-2">
            {!sourcesError && roots.length === 0 ? (
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
                    disabled={removeLoading === r.path}
                    className="ml-3 flex shrink-0 items-center gap-1 rounded-lg border border-hairline px-3 py-1.5 text-xs text-muted transition hover:border-accent-rose hover:text-accent-rose disabled:opacity-50"
                  >
                    <Icon name="delete" size="xs" /> {removeLoading === r.path ? "제거 중…" : "제거"}
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
