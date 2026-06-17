import { useStore } from "../hooks/useStore";

export function BatchBar() {
  const picked = useStore((s) => s.picked);
  const clearPicks = useStore((s) => s.clearPicks);

  if (picked.size === 0) return null;

  return (
    <div
      className="hud-frame fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 border border-line bg-panel/95 px-5 py-3 backdrop-blur-xl"
      style={{ "--hud-c": "var(--color-signal-dim)" } as React.CSSProperties}
    >
      <span className="font-mono text-sm text-ink">
        <span className="text-signal">{picked.size}</span>개 선택
      </span>
      <button
        className="bg-signal/15 px-4 py-1.5 text-sm font-semibold text-signal transition hover:bg-signal/25"
        onClick={() => {
          // 일괄 카드 아트 생성 — 이미지 워크숍 연동 예정
        }}
      >
        이미지 생성
      </button>
      <button
        onClick={clearPicks}
        className="border border-line bg-panel2 px-3 py-1.5 text-sm text-ink-dim transition hover:text-ink"
      >
        선택 해제
      </button>
    </div>
  );
}
