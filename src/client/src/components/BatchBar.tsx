import { useState, useEffect } from "react";
import { useStore } from "../hooks/useStore";
import { Icon } from "./Icon";
import { api } from "../lib/api";
import { promptFor, doodlePrompt } from "../lib/utils";

export function BatchBar() {
  const picked = useStore((s) => s.picked);
  const items = useStore((s) => s.items);
  const lang = useStore((s) => s.lang);
  const clearPicks = useStore((s) => s.clearPicks);
  const reloadData = useStore((s) => s.reloadData);
  // 엔진은 설정(서버 영속)과 동기화 — 여기서 바꿔도 설정에 반영되고, 설정에서 바꿔도 여기 반영된다.
  const engine = useStore((s) => s.imageEngine);
  const setImageEngine = useStore((s) => s.setImageEngine);

  const [generating, setGenerating] = useState(false);
  const [current, setCurrent] = useState(0);
  const [total, setTotal] = useState(0);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [statusFailed, setStatusFailed] = useState(false);

  const CONCURRENCY = 2;

  useEffect(() => {
    setStatusMsg(null);
  }, [picked.size]);

  if (picked.size === 0) return null;

  const handleGenerate = async () => {
    if (generating) return;

    const pickedItems = items.filter((item) => picked.has(item.id));
    if (pickedItems.length === 0) return;

    setGenerating(true);
    setTotal(pickedItems.length);
    setStatusMsg(null);

    let okCount = 0;
    let failCount = 0;
    let lastError = "";
    let done = 0;
    setCurrent(0);

    const runOne = async (it: (typeof pickedItems)[number]) => {
      const displayName = lang === "ko" && it.nameKo ? it.nameKo : it.displayName || it.name;
      try {
        const prompt = (engine === "codex" || engine === "codex-api") ? doodlePrompt(it, lang) : promptFor("card", it, lang);
        const res = await api.generate(prompt, {
          itemId: it.id,
          imageEngine: engine,
          expectedCount: 1,
        });
        if (res.ok && res.images?.length) {
          okCount++;
        } else {
          failCount++;
          lastError = res.error || "알 수 없는 오류";
          console.error(`Failed to generate for ${displayName}:`, res.error);
        }
      } catch (err: any) {
        failCount++;
        lastError = err?.message || "요청 실패 — 서버 상태를 확인하세요";
        console.error(`Error generating for ${displayName}:`, err);
      } finally {
        done++;
        setCurrent(done);
        // reloadData는 개별 항목마다 호출하지 않음 — N회 전체 refetch·그리드 thrash 방지.
        // 전체 완료 후 한 번만 호출한다(아래 Promise.all 이후).
      }
    };

    const queue = [...pickedItems];
    const worker = async () => {
      for (let it = queue.shift(); it; it = queue.shift()) {
        await runOne(it);
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, pickedItems.length) }, () => worker()),
    );

    // 모든 항목이 완료(성공·실패 불문)된 후 단 한 번만 인덱스를 다시 로드한다.
    await reloadData();

    setGenerating(false);
    const icon = failCount === 0 ? "✅" : okCount === 0 ? "❌" : "⚠️";
    const shortErr = lastError.length > 240 ? lastError.slice(0, 240) + "…" : lastError;
    setStatusFailed(failCount > 0);
    setStatusMsg(
      `${icon} 완료 (성공: ${okCount}, 실패: ${failCount})` +
        (failCount > 0 && lastError ? ` — ${shortErr}` : ""),
    );
  };

  return (
    <div className="fixed bottom-20 left-1/2 z-50 flex w-[min(92vw,720px)] -translate-x-1/2 flex-col gap-2 rounded-xl border border-hairline bg-canvas/95 px-5 py-3 shadow-md backdrop-blur-xl">
      {/* 상태/에러 — 컨트롤 위 별도 줄. 길어도 줄바꿈+최대 3줄로 잘라 바 레이아웃을 깨지 않는다(전체는 hover title). */}
      {!generating && statusMsg && (
        <div
          className={`flex items-start gap-1.5 rounded-lg px-2.5 py-1.5 text-xs ${
            statusFailed ? "bg-accent-rose/5 text-accent-rose" : "bg-surface-soft text-muted"
          }`}
          title={statusMsg}
        >
          <span className="line-clamp-3 break-words break-all">{statusMsg}</span>
          <button
            onClick={() => setStatusMsg(null)}
            className="ml-auto shrink-0 opacity-60 transition hover:opacity-100"
            aria-label="알림 닫기"
          >
            <Icon name="close" size="xs" />
          </button>
        </div>
      )}

      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <span className="whitespace-nowrap text-sm text-body">
            <span className="font-bold text-primary">{picked.size}</span>개 선택됨
          </span>

          {/* 엔진 선택 — 설정과 동기화(영속) */}
          {!generating && (
            <select
              value={engine}
              onChange={(e) => setImageEngine(e.target.value)}
              className="rounded-lg border border-hairline bg-surface-soft px-2 py-1 text-xs text-body outline-none transition focus:border-primary"
            >
              <option value="codex-api">Codex API (추천)</option>
              <option value="codex">Codex CLI (로컬)</option>
              <option value="chatgpt">ChatGPT (브라우저)</option>
            </select>
          )}
        </div>

        <div className="flex items-center gap-2">
          {generating ? (
            <div className="flex items-center gap-2 text-xs font-semibold text-primary">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span className="whitespace-nowrap">
                생성 중 ({current}/{total} 완료)
              </span>
            </div>
          ) : (
            <>
              <button
                onClick={handleGenerate}
                className="flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-primary px-4 py-1.5 text-sm font-bold text-white transition hover:bg-primary-active"
              >
                <Icon name="rocket" size="sm" className="text-white" /> 이미지 생성
              </button>
              <button
                onClick={clearPicks}
                className="flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-hairline px-3 py-1.5 text-sm text-muted transition hover:bg-surface-soft hover:text-body"
              >
                <Icon name="close" size="xs" /> 선택 해제
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

