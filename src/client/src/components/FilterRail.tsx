import { useMemo, useState, useCallback } from "react";
import { useStore } from "../hooks/useStore";
import { api } from "../lib/api";
import { RARITY_CONFIG, SORT_OPTIONS, KIND_LABELS } from "../types";
import type { Kind, Rarity, SortKey } from "../types";
import { Icon } from "./Icon";
import type { IconName } from "./Icon";

// 라벨은 KIND_LABELS 단일 출처(Skill/Agent/MCP/Memory). 아이콘만 레일 전용.
const KIND_FILTERS: { key: Kind | "all"; label: string; icon: IconName }[] = [
  { key: "skill", label: KIND_LABELS.skill, icon: "bolt-logo" },
  { key: "agent", label: KIND_LABELS.agent, icon: "agent-badge" },
  { key: "mcp", label: KIND_LABELS.mcp, icon: "wrench" },
  { key: "memory", label: KIND_LABELS.memory, icon: "memory-chip" },
];

export function FilterRail() {
  const { filters, setFilter, meta, items } = useStore();
  const reloadData = useStore((s) => s.reloadData);
  const visibleCount = useStore((s) => s.filtered().length);
  const [rescanning, setRescanning] = useState(false);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [showAllTags, setShowAllTags] = useState(false);

  const handleRescan = useCallback(async () => {
    setRescanning(true);
    try { await api.rescan(); await reloadData(); } finally { setRescanning(false); }
  }, [reloadData]);

  const kindCounts: Record<string, number> = { all: items.length };
  for (const it of items) kindCounts[it.kind] = (kindCounts[it.kind] || 0) + 1;

  const rarityCounts: Record<string, number> = {};
  for (const it of items) rarityCounts[it.rarity] = (rarityCounts[it.rarity] || 0) + 1;

  const equippedCount = items.filter((i) => i.equipped).length;
  const installedCount = items.filter((i) => i.installed).length;

  const tagCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of items) for (const t of it.tags ?? []) m.set(t, (m.get(t) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [items]);

  const categoryCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of items) {
      const cat = it.category ?? "기타";
      m.set(cat, (m.get(cat) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [items]);

  return (
    <aside className="w-[220px] shrink-0 border-r border-hairline bg-canvas overflow-y-auto h-full">
      <div className="p-4 space-y-5">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-ink">필터</h3>
          <button
            onClick={() => {
              // group·sort 포함 전체 필터 초기화 — 일부 키 누락 시 배너/정렬이 잔류하는 버그 방지.
              setFilter("kind", "all");
              setFilter("rarity", "all");
              setFilter("category", "all");
              setFilter("equipOnly", false);
              setFilter("favOnly", false);
              setFilter("dupOnly", false);
              setFilter("q", "");
              setFilter("group", undefined);
              setFilter("sort", "score");
            }}
            className="text-[11px] font-medium text-primary hover:underline"
          >
            초기화
          </button>
        </div>
        <p className="-mt-3 text-[11px] text-muted">표시 {visibleCount}개</p>

        {/* 유형 */}
        <section>
          <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted">유형</h4>
          <div className="space-y-0.5">
            <button
              onClick={() => setFilter("kind", "all")}
              className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] transition-colors ${
                filters.kind === "all"
                  ? "bg-primary-soft text-primary font-semibold"
                  : "text-body hover:bg-surface-soft"
              }`}
            >
              <Icon name="app-grid" size="sm" />
              <span className="flex-1 text-left">전체</span>
              <span className={`font-mono text-[11px] ${filters.kind === "all" ? "text-primary" : "text-muted-soft"}`}>
                {items.length}
              </span>
            </button>
            {KIND_FILTERS.map((t) => {
              const active = filters.kind === t.key;
              const count = kindCounts[t.key] ?? 0;
              return (
                <button
                  key={t.key}
                  onClick={() => setFilter("kind", active ? "all" : t.key)}
                  className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] transition-colors ${
                    active
                      ? "bg-primary-soft text-primary font-semibold"
                      : "text-body hover:bg-surface-soft"
                  }`}
                >
                  <Icon name={t.icon} size="sm" />
                  <span className="flex-1 text-left">{t.label}</span>
                  <span className={`font-mono text-[11px] ${active ? "text-primary" : "text-muted-soft"}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <div className="h-px bg-hairline" />

        {/* 등급 */}
        <section>
          <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted">등급</h4>
          <div className="space-y-0.5">
            {(Object.entries(RARITY_CONFIG) as [Rarity, typeof RARITY_CONFIG[Rarity]][])
              .filter(([k]) => k !== "common")
              .map(([key, cfg]) => {
                const active = filters.rarity === key;
                const count = rarityCounts[key] ?? 0;
                return (
                  <button
                    key={key}
                    onClick={() => setFilter("rarity", active ? "all" : key)}
                    className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] transition-colors ${
                      active ? "font-semibold" : "text-body hover:bg-surface-soft"
                    }`}
                    style={active ? { backgroundColor: cfg.bg, color: cfg.color } : undefined}
                  >
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: cfg.color }}
                    />
                    <span className="flex-1 text-left">{cfg.ko}</span>
                    <span className={`font-mono text-[11px] ${active ? "" : "text-muted-soft"}`}>{count}</span>
                  </button>
                );
              })}
          </div>
        </section>

        <div className="h-px bg-hairline" />

        {/* 카테고리 */}
        <section>
          <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted">카테고리</h4>
          <div className="space-y-0.5">
            {(() => {
              // 접힌 상태에서도 활성 카테고리가 top-8 밖이면 항상 상단에 고정 노출해
              // 토글-오프 수단을 잃지 않도록 한다.
              const slice = showAllCategories ? categoryCounts : categoryCounts.slice(0, 8);
              const activeOutside =
                filters.category &&
                filters.category !== "all" &&
                !showAllCategories &&
                !categoryCounts.slice(0, 8).some(([c]) => c === filters.category);
              const pinnedEntry: [string, number] | undefined = activeOutside
                ? categoryCounts.find(([c]) => c === filters.category)
                : undefined;
              const renderList: [string, number][] = pinnedEntry
                ? [pinnedEntry, ...slice.filter(([c]) => c !== filters.category)]
                : slice;
              return renderList.map(([cat, count]) => {
                const active = filters.category === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setFilter("category", active ? "all" : cat)}
                    className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] transition-colors ${
                      active ? "bg-primary-soft text-primary font-semibold" : "text-body hover:bg-surface-soft"
                    }`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-soft" />
                    <span className="flex-1 text-left truncate">{cat}</span>
                    <span className="font-mono text-[11px] text-muted-soft">{count}</span>
                  </button>
                );
              });
            })()}
          </div>
          {categoryCounts.length > 8 && (
            <button
              onClick={() => setShowAllCategories((v) => !v)}
              className="mt-1 px-2.5 text-[11px] font-medium text-primary hover:underline"
            >
              {showAllCategories ? "접기" : `+${categoryCounts.length - 8}개 더`}
            </button>
          )}
        </section>

        <div className="h-px bg-hairline" />

        {/* 상태 필터 */}
        <section>
          <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted">상태</h4>
          <div className="space-y-0.5">
            <FilterToggle
              active={filters.equipOnly}
              onClick={() => setFilter("equipOnly", !filters.equipOnly)}
              label="장착 중"
              icon="check-circle"
              color="var(--color-accent-emerald)"
              count={equippedCount}
            />
            <FilterToggle
              active={filters.favOnly}
              onClick={() => setFilter("favOnly", !filters.favOnly)}
              label="즐겨찾기"
              icon="favorite-star"
              color="var(--color-accent-orange)"
            />
            <FilterToggle
              active={filters.dupOnly}
              onClick={() => setFilter("dupOnly", !filters.dupOnly)}
              label="중복 그룹"
              icon="duplicate"
              color="var(--color-accent-violet)"
            />
          </div>
          {/* 설치됨/미설치 — 정보 요약 행(필터 아님). FilterToggle과 레이아웃을 의도적으로 구분해 클릭 가능처럼 보이지 않도록 함. */}
          <div className="mt-3 border-t border-hairline pt-2 text-[11px] text-muted-soft">
            <span className="flex items-center justify-between px-2.5 py-0.5">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "var(--color-accent-emerald)" }} />
                설치됨
              </span>
              <span className="font-mono">{installedCount}</span>
            </span>
            <span className="flex items-center justify-between px-2.5 py-0.5">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-muted-soft" />
                미설치
              </span>
              <span className="font-mono">{items.length - installedCount}</span>
            </span>
          </div>
        </section>

        <div className="h-px bg-hairline" />

        {/* 태그 */}
        {tagCounts.length > 0 && (
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted">태그</h4>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(showAllTags ? tagCounts : tagCounts.slice(0, 10)).map(([tag, count]) => (
                <button
                  key={tag}
                  onClick={() => setFilter("q", filters.q === tag ? "" : tag)}
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium transition-colors ${
                    filters.q === tag
                      ? "bg-primary-soft text-primary"
                      : "bg-surface-soft text-body hover:bg-hairline"
                  }`}
                >
                  {tag}
                  <span className="font-mono text-muted-soft">{count}</span>
                </button>
              ))}
            </div>
            {tagCounts.length > 10 && (
              <button
                onClick={() => setShowAllTags((v) => !v)}
                className="mt-2 text-[11px] font-medium text-primary hover:underline"
              >
                {showAllTags ? "접기" : `+${tagCounts.length - 10}개 더`}
              </button>
            )}
          </section>
        )}

        {/* 정렬 */}
        <section>
          <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted">정렬</h4>
          <select
            value={filters.sort}
            onChange={(e) => setFilter("sort", e.target.value as SortKey)}
            className="w-full rounded-lg border border-hairline bg-canvas px-2.5 py-1.5 text-[13px] text-body focus:border-primary focus:outline-none"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>
        </section>

        {/* 스캔 정보 */}
        {meta && (
          <div className="rounded-lg bg-surface-soft p-2.5 text-[11px] text-muted space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1"><Icon name="sync" size="xs" /> 마지막 스캔</span>
              <span className="font-mono text-muted-soft">
                {/* meta.scanned 누락·invalid 방어 — 서버가 값을 전달 못한 경우 "—" 표시 */}
                {meta.scanned && !isNaN(new Date(meta.scanned).getTime())
                  ? new Date(meta.scanned).toLocaleDateString("ko")
                  : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1"><Icon name="dependency-nodes" size="xs" /> 중복 그룹</span>
              <span className="font-mono text-muted-soft">{meta.dupGroups}</span>
            </div>
            <button
              onClick={handleRescan}
              disabled={rescanning}
              className="flex w-full items-center justify-center gap-1.5 rounded-md bg-canvas px-2 py-1.5 text-[11px] font-medium text-body hover:bg-hairline transition-colors disabled:opacity-50"
            >
              <Icon name="refresh" size="xs" className={rescanning ? "animate-spin" : ""} />
              {rescanning ? "스캔 중..." : "재스캔"}
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

function FilterToggle({ active, onClick, label, icon, color, count }: {
  active: boolean; onClick: () => void; label: string; icon: IconName; color: string; count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] transition-colors ${
        active ? "font-semibold" : "text-body hover:bg-surface-soft"
      }`}
      style={active ? { backgroundColor: `${color}10`, color } : undefined}
    >
      <Icon name={icon} size="sm" />
      <span className="flex-1 text-left">{label}</span>
      {count != null && <span className={`font-mono text-[11px] ${active ? "" : "text-muted-soft"}`}>{count}</span>}
      {active && <Icon name="check" size="xs" />}
    </button>
  );
}
