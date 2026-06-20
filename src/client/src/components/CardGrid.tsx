import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useStore } from "../hooks/useStore";
import { RARITY_CONFIG, KIND_LABELS } from "../types";
import type { Item, Kind, Rarity } from "../types";
import { computeLevel, summarize, pickDesc, rarityFrame } from "../lib/utils";
import { Card } from "./Card";
import { Icon } from "./Icon";

const PAGE_SIZE = 60;

export function CardGrid() {
  const filtered = useStore((s) => s.filtered);
  const filters = useStore((s) => s.filters);
  const favorites = useStore((s) => s.favorites);
  const loading = useStore((s) => s.loading);
  const allItems = useStore((s) => s.items);
  const setSelected = useStore((s) => s.setSelected);
  const setFilter = useStore((s) => s.setFilter);
  const lang = useStore((s) => s.lang);
  // filters/favorites 변경 시 리렌더링을 위해 deps에 포함
  const items = useMemo(() => filtered(), [filtered, filters, favorites, allItems]);

  const [shown, setShown] = useState(PAGE_SIZE);
  const loaderRef = useRef<HTMLDivElement>(null);

  // 라이브러리 뷰 설정 — 그리드/리스트 + 그리드 열 개수(3·4). localStorage에 기억.
  const [view, setView] = useState<"grid" | "list">(
    () => (localStorage.getItem("lib.view") as "grid" | "list") || "grid",
  );
  const [cols, setCols] = useState<3 | 4>(
    () => (localStorage.getItem("lib.cols") === "3" ? 3 : 4),
  );
  const setViewPref = (v: "grid" | "list") => { setView(v); localStorage.setItem("lib.view", v); };
  const setColsPref = (c: 3 | 4) => { setCols(c); localStorage.setItem("lib.cols", String(c)); };

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
    // lg 미만 너비에서 FilterRail이 숨겨지므로, 빈 상태에서 어떤 필터가 걸려 있든
    // 항상 전체 초기화 버튼을 제공한다 — 사용자가 "갇히는" 상황 방지.
    const resetAllFilters = () => {
      setFilter("kind", "all");
      setFilter("rarity", "all");
      setFilter("category", "all");
      setFilter("equipOnly", false);
      setFilter("favOnly", false);
      setFilter("dupOnly", false);
      setFilter("q", "");
      setFilter("group", undefined);
      setFilter("sort", "score");
    };
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-muted">
        <Icon name="search" size="xl" className="opacity-20" />
        <p className="text-sm">검색 결과 없음</p>
        <p className="text-xs text-muted-soft">조건에 맞는 자산이 없습니다</p>
        <button
          onClick={resetAllFilters}
          className="mt-1 rounded-lg border border-hairline px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-surface-soft"
        >
          필터 초기화 — 전체 보기
        </button>
      </div>
    );
  }

  // 홈 뷰 조건 — 정렬이 기본값(score)을 벗어나면 홈을 나가 전체 라이브러리 정렬 결과를 보여준다.
  // "최근 추가 →" 액션이 sort=freshness를 set하면 이 조건이 false가 되어 큐레이션 섹션 대신
  // 신선도순 라이브러리 뷰가 노출된다.
  const isHome =
    filters.kind === "all" &&
    filters.rarity === "all" &&
    !filters.q &&
    !filters.equipOnly &&
    !filters.favOnly &&
    !filters.dupOnly &&
    !filters.group &&
    filters.sort === "score";

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
      {/* 동일 계열(중복) 필터 배너 — 대시보드에서 그룹 클릭 진입. 비교 후 전체 보기로 해제. */}
      {filters.group && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-accent-orange/30 bg-accent-orange-soft px-4 py-2.5">
          <span className="flex min-w-0 items-center gap-2 text-sm text-body">
            <Icon name="duplicate" size="sm" className="shrink-0 text-accent-orange" />
            <span className="truncate">
              동일 계열 <b className="text-ink">{items[0]?.displayName || items[0]?.name || ""}</b> · {items.length}개 — 비교 후 하나만 두고 정리하세요.
            </span>
          </span>
          <button
            onClick={() => setFilter("group", undefined)}
            className="shrink-0 whitespace-nowrap text-xs font-semibold text-primary hover:underline"
          >
            전체 보기
          </button>
        </div>
      )}
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
        <SectionHeader
          title={getLibraryTitle()}
          subtitle={`${items.length.toLocaleString()}개 자산`}
          actionLabel=""
          actions={
            <LibraryControls
              view={view}
              cols={cols}
              onView={setViewPref}
              onCols={setColsPref}
            />
          }
        />
        {view === "list" ? (
          <div className="overflow-hidden rounded-xl border border-hairline bg-surface-card">
            {visible.map((item) => (
              <LibraryRow key={item.id} item={item} onClick={() => setSelected(item.id)} />
            ))}
          </div>
        ) : (
          <div className={cols === 3 ? "grid grid-cols-2 gap-3 md:grid-cols-3" : "grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4"}>
            {visible.map((item, i) => (
              <Card key={item.id} item={item} index={i % 60} />
            ))}
          </div>
        )}
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
function SectionHeader({ title, subtitle, actionLabel, onAction, actions }: {
  title: string; subtitle?: string; actionLabel?: string; onAction?: () => void; actions?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="flex items-baseline gap-2">
        <h2 className="text-base font-bold text-ink">{title}</h2>
        {subtitle && <span className="text-xs text-muted">{subtitle}</span>}
      </div>
      {actions ? actions : (
        actionLabel !== "" && onAction && (
          <button onClick={onAction} className="text-xs font-medium text-primary hover:underline">
            {actionLabel ?? "모두 보기 →"}
          </button>
        )
      )}
    </div>
  );
}

/* ── 라이브러리 뷰 컨트롤 — 그리드/리스트 토글 + 그리드 열 개수(3·4) ── */
function LibraryControls({ view, cols, onView, onCols }: {
  view: "grid" | "list"; cols: 3 | 4; onView: (v: "grid" | "list") => void; onCols: (c: 3 | 4) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      {/* 그리드 모드에서만 열 개수 선택 노출 */}
      {view === "grid" && (
        <div className="flex items-center rounded-lg border border-hairline p-0.5">
          {([3, 4] as const).map((c) => (
            <button
              key={c}
              onClick={() => onCols(c)}
              className={`h-6 w-6 rounded-md text-[11px] font-semibold transition ${
                cols === c ? "bg-primary text-white" : "text-muted hover:text-ink"
              }`}
              title={`${c}열 그리드`}
            >
              {c}
            </button>
          ))}
        </div>
      )}
      {/* 그리드 / 리스트 토글 */}
      <div className="flex items-center rounded-lg border border-hairline p-0.5">
        <button
          onClick={() => onView("grid")}
          className={`flex h-6 w-6 items-center justify-center rounded-md transition ${
            view === "grid" ? "bg-primary text-white" : "text-muted hover:text-ink"
          }`}
          title="그리드 보기"
          aria-pressed={view === "grid"}
        >
          <Icon name="app-grid" size="xs" />
        </button>
        <button
          onClick={() => onView("list")}
          className={`flex h-6 w-6 items-center justify-center rounded-md transition ${
            view === "list" ? "bg-primary text-white" : "text-muted hover:text-ink"
          }`}
          title="리스트 보기"
          aria-pressed={view === "list"}
        >
          <Icon name="list-bullets" size="xs" />
        </button>
      </div>
    </div>
  );
}

/* ── 라이브러리 리스트 행 — 한 줄에 등급·이름·타입·레벨·점수·상태 ── */
function LibraryRow({ item, onClick }: { item: Item; onClick: () => void }) {
  const r = RARITY_CONFIG[item.rarity];
  const lvl = computeLevel(item.uses); // uses>0 일 때만 LV(실사용 기반), 없으면 null → 숨김
  const name = item.displayName;
  // 상주는 claudeState==="resident"로만 — installed(소스가 ~/.claude 하위)는 카탈로그 대부분이라
  // "상주"로 라벨하면 Inventory 상주 섹션과 어긋난다(정직 모델 동기).
  const status = item.equipped ? "장착 중" : item.claudeState === "resident" ? "상주" : null;

  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 border-b border-hairline px-3 py-2.5 text-left transition last:border-b-0 hover:bg-surface-soft"
    >
      <span
        className="inline-flex w-[58px] shrink-0 items-center justify-center rounded-md px-1.5 py-0.5 text-[10px] font-bold text-white"
        style={{ backgroundColor: r.color }}
      >
        {r.ko}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{name}</span>
      <span className="hidden shrink-0 rounded bg-surface-soft px-1.5 py-0.5 text-[10px] font-medium uppercase text-muted sm:inline">
        {KIND_LABELS[item.kind]}
      </span>
      <span className="hidden w-12 shrink-0 text-right font-mono text-[11px] font-bold text-body md:inline">{lvl !== null ? `Lv.${lvl}` : ""}</span>
      <span className="w-12 shrink-0 text-right font-mono text-xs font-semibold text-ink">{item.score}pt</span>
      <span className={`w-14 shrink-0 text-right text-[11px] font-medium ${item.equipped ? "text-accent-emerald" : "text-accent-orange"}`}>
        {status ?? ""}
      </span>
    </button>
  );
}

/* ── 최근 추가용 컴팩트 카드 ── */
function CompactCard({ item, lang, onClick }: { item: Item; lang: string; onClick: () => void }) {
  const r = RARITY_CONFIG[item.rarity];
  const lvl = computeLevel(item.uses); // 실사용(uses>0) 있을 때만 LV
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
      {/* KIND_LABELS 단일 출처 사용 — 원시 kind를 uppercase로 노출하면 'SKILL'/'MEMORY'가 되어 메인 카드·리스트 행의 'Skill'/'Memory'와 어긋난다. */}
      <span className="mb-1 rounded bg-surface-soft px-1 py-0.5 text-[9px] font-medium text-muted w-fit">{KIND_LABELS[item.kind]}</span>
      <p className="line-clamp-2 text-[11px] leading-relaxed text-muted">{summarize(desc)}</p>
      <div className="mt-auto flex items-center gap-2 pt-2">
        {lvl !== null && <span className="font-mono text-[10px] font-bold text-body">Lv.{lvl}</span>}
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
  const lvl = computeLevel(item.uses); // 실사용(uses>0) 있을 때만 LV
  const name = item.displayName;

  return (
    <button onClick={onClick} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition hover:bg-surface-soft">
      <span className="flex-1 truncate text-xs font-medium text-ink">{name}</span>
      {lvl !== null && <span className="font-mono text-[10px] text-muted">Lv.{lvl}</span>}
      <span className="font-mono text-[10px] font-semibold text-body">{item.score}pt</span>
    </button>
  );
}

/* ── MCP 행 — 조작된 스탯 대신 실제 신호(인자/env/위험)를 노출 ── */
function McpRow({ item, onClick }: { item: Item; onClick: () => void }) {
  const argc = item.meta?.args?.length ?? 0;
  const envc = item.meta?.env?.length ?? 0;
  const riskc = item.risks?.length ?? 0;
  return (
    <button onClick={onClick} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition hover:bg-surface-soft">
      <span className={`h-2 w-2 rounded-full ${item.equipped ? "bg-accent-emerald" : item.claudeState === "resident" ? "bg-accent-blue" : "bg-muted-soft"}`} />
      <span className="min-w-0 flex-1 truncate text-xs font-medium text-ink">{item.displayName}</span>
      <span className="hidden shrink-0 font-mono text-[9px] text-muted-soft sm:inline" title={`명령 인자 ${argc} · env ${envc}`}>
        {argc}a·{envc}e
      </span>
      {riskc > 0 && (
        <span className="shrink-0 font-mono text-[9px] font-semibold text-accent-rose" title="위험 신호">⚠{riskc}</span>
      )}
      <span className={`shrink-0 text-[10px] font-medium ${item.equipped ? "text-accent-emerald" : "text-muted"}`}>
        {item.equipped ? "장착 중" : item.claudeState === "resident" ? "상주" : "대기"}
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
