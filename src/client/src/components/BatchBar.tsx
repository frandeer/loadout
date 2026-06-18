import { useState, useEffect } from "react";
import { useStore } from "../hooks/useStore";
import { Icon } from "./Icon";
import { api } from "../lib/api";
import { promptFor } from "../lib/utils";

export function BatchBar() {
  const picked = useStore((s) => s.picked);
  const items = useStore((s) => s.items);
  const lang = useStore((s) => s.lang);
  const clearPicks = useStore((s) => s.clearPicks);
  const reloadData = useStore((s) => s.reloadData);

  const [generating, setGenerating] = useState(false);
  const [current, setCurrent] = useState(0);
  const [total, setTotal] = useState(0);
  const [currentItemName, setCurrentItemName] = useState("");
  const [engine, setEngine] = useState<"auto" | "image-farm" | "chatgpt" | "grok">("auto");
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Clear status message when selection changes
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

    for (let i = 0; i < pickedItems.length; i++) {
      const it = pickedItems[i];
      setCurrent(i + 1);
      const displayName = lang === "ko" && it.nameKo ? it.nameKo : it.displayName || it.name;
      setCurrentItemName(displayName);

      try {
        const prompt = promptFor("card", it, lang);
        const res = await api.generate(prompt, {
          itemId: it.id,
          imageEngine: engine,
          expectedCount: 1,
        });

        if (res.ok && res.images?.length) {
          okCount++;
        } else {
          failCount++;
          console.error(`Failed to generate for ${displayName}:`, res.error);
        }
      } catch (err: any) {
        failCount++;
        console.error(`Error generating for ${displayName}:`, err);
      }
    }

    setGenerating(false);
    await reloadData();
    setStatusMsg(`✅ 완료 (성공: ${okCount}, 실패: ${failCount})`);
  };

  return (
    <div className="fixed bottom-20 left-1/2 z-50 flex -translate-x-1/2 flex-col gap-2 rounded-xl border border-hairline bg-canvas/95 px-5 py-3 shadow-md backdrop-blur-xl md:flex-row md:items-center">
      <div className="flex items-center gap-3">
        <span className="text-sm text-body">
          <span className="font-bold text-primary">{picked.size}</span>개 선택됨
        </span>

        {/* 엔진 선택 */}
        {!generating && (
          <select
            value={engine}
            onChange={(e) => setEngine(e.target.value as any)}
            className="rounded-lg border border-hairline bg-surface-soft px-2 py-1 text-xs text-body outline-none transition focus:border-primary"
          >
            <option value="auto">자동 감지 (image-farm &gt; ChatGPT)</option>
            <option value="image-farm">image-farm (추천)</option>
            <option value="chatgpt">ChatGPT (브라우저)</option>
            <option value="grok">Grok (브라우저)</option>
          </select>
        )}
      </div>

      <div className="flex items-center gap-2">
        {generating ? (
          <div className="flex items-center gap-2 text-xs font-semibold text-primary">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span>
              생성 중 ({current}/{total}): <span className="text-body font-normal">{currentItemName}</span>
            </span>
          </div>
        ) : (
          <>
            {statusMsg && <span className="text-xs text-muted mr-2">{statusMsg}</span>}
            <button
              onClick={handleGenerate}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-sm font-bold text-white transition hover:bg-primary-active"
            >
              <Icon name="rocket" size="sm" className="text-white" /> 이미지 생성
            </button>
            <button
              onClick={clearPicks}
              className="flex items-center gap-1.5 rounded-lg border border-hairline px-3 py-1.5 text-sm text-muted transition hover:bg-surface-soft hover:text-body"
            >
              <Icon name="close" size="xs" /> 선택 해제
            </button>
          </>
        )}
      </div>
    </div>
  );
}

