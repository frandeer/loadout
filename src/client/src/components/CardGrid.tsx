import { useState, useCallback, useEffect, useRef } from "react";
import { useStore } from "../hooks/useStore";
import { Card } from "./Card";

const PAGE_SIZE = 60;

export function CardGrid() {
  const filtered = useStore((s) => s.filtered);
  const loading = useStore((s) => s.loading);
  const items = filtered();
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
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-zinc-500">
        일치하는 항목이 없습니다
      </div>
    );
  }

  const visible = items.slice(0, shown);

  return (
    <>
      <div className="mb-3 text-xs text-zinc-500">
        {items.length.toLocaleString()}개 표시
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
        {visible.map((item) => (
          <Card key={item.id} item={item} />
        ))}
      </div>
      {shown < items.length && (
        <div ref={loaderRef} className="flex justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
        </div>
      )}
    </>
  );
}
