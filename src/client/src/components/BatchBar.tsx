import { useStore } from "../hooks/useStore";

export function BatchBar() {
  const picked = useStore((s) => s.picked);
  const clearPicks = useStore((s) => s.clearPicks);

  if (picked.size === 0) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-zinc-700 bg-zinc-900/95 px-5 py-3 shadow-2xl backdrop-blur-xl">
      <span className="text-sm font-medium text-white">
        {picked.size}개 선택
      </span>
      <button
        className="rounded-lg bg-amber-500 px-4 py-1.5 text-sm font-semibold text-black transition hover:bg-amber-400"
        onClick={() => {
          // Will be implemented in Story 4 (image workshop)
        }}
      >
        이미지 생성
      </button>
      <button
        onClick={clearPicks}
        className="rounded-lg bg-zinc-800 px-3 py-1.5 text-sm text-zinc-400 transition hover:bg-zinc-700 hover:text-white"
      >
        선택 해제
      </button>
    </div>
  );
}
