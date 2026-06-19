import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useStore } from "../hooks/useStore";
import { RARITY_CONFIG, KIND_LABELS } from "../types";
import type { Item, Kind, Rarity } from "../types";
import { neededTraitKeys } from "../lib/traits";
import { computeLevel, summarize, pickDesc, rarityFrame } from "../lib/utils";
import { Card } from "./Card";
import { Icon } from "./Icon";

const PAGE_SIZE = 60;

export function CardGrid() {
  const filtered = useStore((s) => s.filtered);
  const filters = useStore((s) => s.filters);
  const favorites = useStore((s) => s.favorites);
  const loading = useStore((s) => s.loading);
  const slots = useStore((s) => s.slots);
  const allItems = useStore((s) => s.items);
  const setSelected = useStore((s) => s.setSelected);
  const setFilter = useStore((s) => s.setFilter);
  const lang = useStore((s) => s.lang);
  // filters/favorites 변경 시 리렌더링을 위해 deps에 포함
  const items = useMemo(() => filtered(), [filtered, filters, favorites, allItems]);

  const needKeys = useMemo(() => {
    const ids = new Set(Object.values(slots).filter(Boolean) as string[]);
    const members = allItems.filter((i) => ids.has(i.id));
    return members.length ? neededTraitKeys(members) : undefined;
  }, [slots, allItems]);

  const [shown, setShown] = useState(PAGE_SIZE);
  const loaderRef = useRef<HTMLDivElement>(null);

  const recentItems = useMemo(
    () => [...allItems].sort((a, b) => (b.stats?.freshness ?? 0) - (a.stats?.freshness ?? 0)).slice(0, 5),
    [allItems],
  );

  const favoriteItems = useMemo(
    () => allItems.filter((i) => favorites.has(i.id)),
    [allItems, favorites],
  );

  const skillItems = useMemo(
    () => allItems.filter((i) => i.kind === "skill").sort((a, b) => b.score - a.score).slice(0, 8),
    [allItems],
  );

  const mcpItems = useMemo(
    () => allItems.filter((i) => i.kind === "mcp").sort((a, b) => b.score - a.score),
    [allItems],
  );

  const agentItems = useMemo(
    () => allItems.filter((i) => i.kind === "agent").sort((a, b) => b.score - a.score).slice(0, 5),
    [allItems],
  );

  const memoryItems = useMemo(() => {
    const mems = allItems.filter((i) => i.kind === "memory" && i.layer === "index");
    return mems.length ? mems.slice(0, 4) : allItems.filter((i) => i.kind === "memory").slice(0, 4);
  }, [allItems]);

  useEffect(() => { setShown(PAGE_SIZE); }, [items.length]);

  const loadMore = useCallback(() => {
    setShown((prev) => Math.min(prev + PAGE_SIZE, items.length));
  }, [items.length]);

  useEffect(() => {
    const el = loaderRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMore(); },
      { rootMargin: "200px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [loadMore]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-muted">
        <Icon name="search" size="xl" className="opacity-20" />
        <p className="text-sm">검색 결과 없음</p>
        <p className="text-xs text-muted-soft">조건에 맞는 자산이 없습니다</p>
      </div>
    );
  }

  const isHome =
    filters.kind === "all" &&
    filters.rarity === "all" &&
    !filters.q &&
    !filters.equipOnly &&
    !filters.favOnly &&
    !filters.dupOnly;

  const getLibraryTitle = () => {
    if (isHome) return "라이브러리";
    const parts: string[] = [];
    if (filters.kind !== "all") parts.push(KIND_LABELS[filters.kind as Kind] || filters.kind);
    if (filters.rarity !== "all") {
      const rarityKo = RARITY_CONFIG[filters.rarity as Rarity]?.ko || filters.rarity;
      parts.push(rarityKo);
    }
    if (filters.equipOnly) parts.push("장착 중");
    if (filters.favOnly) parts.push("즐겨찾기");
    if (filters.dupOnly) parts.push("중복 그룹");
    if (filters.q) parts.push(`'${filters.q}'`);
    return parts.length > 0 ? parts.join(" · ") : "라이브러리";
  };

  const visible = items.slice(0, shown);

  return (
    <div className="space-y-8">
      {isHome && (
        <>
          {/* ─── 즐겨찾기 ─── */}
          {favoriteItems.length > 0 && (
            <section>
              <SectionHeader
                title="즐겨찾기"
                onAction={() => setFilter("favOnly", true)}
              />
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
                {favoriteItems.slice(0, 5).map((item) => (
                  <CompactCard key={item.id} item={item} lang={lang} onClick={() => setSelected(item.id)} />
                ))}
              </div>
            </section>
          )}

          {/* ─── 최근 추가 ─── */}
          {recentItems.length > 0 && (
            <section>
              <SectionHeader
                title="최근 추가"
                onAction={() => setFilter("sort", "freshness")}
              />
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
                {recentItems.map((item) => (
                  <CompactCard key={item.id} item={item} lang={lang} onClick={() => setSelected(item.id)} />
                ))}
              </div>
            </section>
          )}

          {/* ─── 스킬 / MCP / 팀 로스터 ─── */}
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            <ListSection
              title="스킬 라이브러리"
              badge={`${allItems.filter((i) => i.kind === "skill").length}`}
              onViewAll={() => setFilter("kind", "skill")}
            >
              {skillItems.map((item) => (
                <ListRow key={item.id} item={item} onClick={() => setSelected(item.id)} />
              ))}
            </ListSection>

            <ListSection
              title="MCP 장비"
              badge={`${mcpItems.length}`}
              onViewAll={() => setFilter("kind", "mcp")}
            >
              {mcpItems.slice(0, 7).map((item) => (
                <McpRow key={item.id} item={item} onClick={() => setSelected(item.id)} />
              ))}
            </ListSection>

            <ListSection
              title="팀 로스터"
              badge={`${allItems.filter((i) => i.kind === "agent").length}`}
              onViewAll={() => setFilter("kind", "agent")}
            >
              {agentItems.map((item) => (
                <AgentRow key={item.id} item={item} onClick={() => setSelected(item.id)} />
              ))}
            </ListSection>
          </div>

          {/* ─── 메모리 보관함 ─── */}
          {memoryItems.length > 0 && (
            <section>
              <SectionHeader
                title="메모리 보관함"
                onAction={() => setFilter("kind", "memory")}
              />
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {memoryItems.map((item) => (
                  <MemoryCard key={item.id} item={item} onClick={() => setSelected(item.id)} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* ─── 전체 라이브러리 ─── */}
      <section>
        <SectionHeader title={getLibraryTitle()} subtitle={`${items.length.toLocaleString()}개 자산`} actionLabel="" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {visible.map((item, i) => (
            <Card key={item.id} item={item} index={i % 60} needKeys={needKeys} />
          ))}
        </div>
        {shown < items.length && (
          <div ref={loaderRef} className="flex justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}
      </section>
    </div>
  );
}

/* ── 공통 섹션 헤더 ── */
function SectionHeader({ title, subtitle, actionLabel, onAction }: {
  title: string; subtitle?: string; actionLabel?: string; onAction?: () => void;
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <div className="flex items-baseline gap-2">
        <h2 className="text-base font-bold text-ink">{title}</h2>
        {subtitle && <span className="text-xs text-muted">{subtitle}</span>}
      </div>
      {actionLabel !== "" && onAction && (
        <button onClick={onAction} className="text-xs font-medium text-primary hover:underline">
          {actionLabel ?? "모두 보기 →"}
        </button>
      )}
    </div>
  );
}

/* ── 최근 추가용 컴팩트 카드 ── */
function CompactCard({ item, lang, onClick }: { item: Item; lang: string; onClick: () => void }) {
  const r = RARITY_CONFIG[item.rarity];
  const lvl = computeLevel(item.stats?.power ?? 50, item.uses);
  const name = item.displayName;
  const desc = pickDesc(item, lang);
  // 조밀 뷰 — 레어도는 테두리 색으로만(글로우는 끔: 인접 카드와 번지지 않게).
  const frame = rarityFrame(item.rarity, r.color, { glow: false });

  return (
    <button
      onClick={onClick}
      className={`flex flex-col rounded-xl border bg-surface-card p-3 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${
        frame.borderColor ? "" : "border-hairline hover:border-hairline-strong"
      }`}
      style={frame.borderColor ? frame : undefined}
    >
      <div className="mb-2 flex items-center gap-1.5">
        <span className="inline-flex h-[18px] items-center rounded px-1.5 text-[9px] font-bold text-white" style={{ backgroundColor: r.color }}>
          {r.ko.charAt(0)}
        </span>
        <span className="truncate text-[13px] font-semibold text-ink">{name}</span>
      </div>
      <span className="mb-1 rounded bg-surface-soft px-1 py-0.5 text-[9px] font-medium uppercase text-muted w-fit">{item.kind}</span>
      <p className="line-clamp-2 text-[11px] leading-relaxed text-muted">{summarize(desc)}</p>
      <div className="mt-auto flex items-center gap-2 pt-2">
        <span className="font-mono text-[10px] font-bold text-body">Lv.{lvl}</span>
        <div className="h-1 flex-1 rounded-full bg-surface-soft">
          <div className="h-full rounded-full" style={{ width: `${Math.min(item.score, 100)}%`, backgroundColor: r.color }} />
        </div>
        <span className="font-mono text-[10px] text-muted-soft">{item.score}pt</span>
      </div>
    </button>
  );
}

/* ── 리스트 카드 래퍼 ── */
function ListSection({ title, badge, children, onViewAll }: {
  title: string; badge?: string; children: React.ReactNode; onViewAll?: () => void;
}) {
  return (
    <div className="rounded-xl border border-hairline bg-surface-card p-3.5">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-ink">{title}</h3>
          {badge && <span className="font-mono text-xs text-muted">{badge}</span>}
        </div>
        {onViewAll && (
          <button onClick={onViewAll} className="text-[11px] font-medium text-primary hover:underline">
            모두 보기 →
          </button>
        )}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

/* ── 스킬 리스트 행 ── */
function ListRow({ item, onClick }: { item: Item; onClick: () => void }) {
  const lvl = computeLevel(item.stats?.power ?? 50, item.uses);
  const name = item.displayName;

  return (
    <button onClick={onClick} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition hover:bg-surface-soft">
      <span className="flex-1 truncate text-xs font-medium text-ink">{name}</span>
      <span className="font-mono text-[10px] text-muted">Lv.{lvl}</span>
      <span className="font-mono text-[10px] font-semibold text-body">{item.score}pt</span>
    </button>
  );
}

/* ── MCP 행 ── */
function McpRow({ item, onClick }: { item: Item; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition hover:bg-surface-soft">
      <span className={`h-2 w-2 rounded-full ${item.equipped ? "bg-accent-emerald" : item.installed ? "bg-accent-blue" : "bg-muted-soft"}`} />
      <span className="flex-1 truncate text-xs font-medium text-ink">{item.displayName}</span>
      <span className="rounded bg-surface-soft px-1 py-0.5 text-[8px] font-semibold text-muted">MCP</span>
      <span className={`text-[10px] font-medium ${item.equipped ? "text-accent-emerald" : "text-muted"}`}>
        {item.equipped ? "장착 중" : item.installed ? "상주" : "대기"}
      </span>
    </button>
  );
}

/* ── 에이전트 행 ── */
function AgentRow({ item, onClick }: { item: Item; onClick: () => void }) {
  const name = item.displayName;

  return (
    <button onClick={onClick} className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition hover:bg-surface-soft">
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-soft">
        <Icon name="agent-badge" size="sm" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="truncate text-xs font-semibold text-ink">{name}</div>
        <div className="truncate text-[10px] text-muted">{item.description?.slice(0, 30)}</div>
      </div>
      <span className={`h-1.5 w-1.5 rounded-full ${item.equipped ? "bg-accent-emerald" : "bg-muted-soft"}`} />
    </button>
  );
}

/* ── 메모리 보관함 카드 ── */
function MemoryCard({ item, onClick }: { item: Item; onClick: () => void }) {
  const name = item.displayName || "메모리";
  const repo = typeof item.source.repo === "string" ? item.source.repo : "";
  const path = item.source.path;
  const tags = item.tags?.slice(0, 4) ?? [];

  return (
    <button onClick={onClick} className="flex flex-col rounded-xl border border-hairline bg-surface-card p-3.5 text-left transition hover:border-hairline-strong hover:-translate-y-0.5 w-full">
      <div className="mb-2 flex items-center gap-1.5 text-muted">
        <Icon name="memory-card" size="sm" />
        <span className="text-[10px] uppercase font-bold text-muted-soft">Memory</span>
      </div>
      <h4 className="mb-0.5 text-sm font-bold text-ink truncate w-full">{repo}</h4>
      <div className="text-[10px] text-muted-soft mb-2.5 truncate w-full" title={`${repo}/${path}`}>{name}</div>
      <p className="mb-2 line-clamp-2 text-[11px] leading-relaxed text-muted min-h-[32px]">{item.description}</p>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-auto">
          {tags.map((t) => (
            <span key={t} className="rounded bg-primary-soft px-1.5 py-0.5 text-[9px] font-medium text-primary">
              #{t}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}
