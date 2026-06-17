import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useStore } from "../hooks/useStore";
import { neededTraitKeys } from "../lib/traits";
import { Card } from "./Card";

const PAGE_SIZE = 60;

export function CardGrid() {
  const filtered = useStore((s) => s.filtered);
  const loading = useStore((s) => s.loading);
  const slots = useStore((s) => s.slots);
  const allItems = useStore((s) => s.items);
  const items = filtered();

  // 현재 편성 기준으로 "1개 더 배치하면 링크 발동"인 특성 — 카드 추천 뱃지에 사용.
  const needKeys = useMemo(() => {
    const ids = new Set(Object.values(slots).filter(Boolean) as string[]);
    const members = allItems.filter((i) => ids.has(i.id));
    return members.length ? neededTraitKeys(members) : undefined;
  }, [slots, allItems]);
  const [shown, setShown] = useState(PAGE_SIZE);
  const loaderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setShown(PAGE_SIZE);
  }, [items.length]);

  const loadMore = useCallback(() => {
    setShown((prev) => Math.min(prev + PAGE_SIZE, items.length));
  }, [items.length]);

  useEffect(() => {
    const el = loaderRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-signal border-t-transparent" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center font-mono text-sm text-ink-faint">
        NO MATCH — 일치하는 자산 없음
      </div>
    );
  }

  const visible = items.slice(0, shown);

  return (
    <>
      <div className="mb-3 font-mono text-[11px] text-ink-faint">
        {items.length.toLocaleString()} ASSETS
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
        {visible.map((item, i) => (
          <Card key={item.id} item={item} index={i % 60} needKeys={needKeys} />
        ))}
      </div>
      {shown < items.length && (
        <div ref={loaderRef} className="flex justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-signal border-t-transparent" />
        </div>
      )}
    </>
  );
}
