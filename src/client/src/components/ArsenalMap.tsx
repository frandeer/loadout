import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../hooks/useStore";
import { api } from "../lib/api";
import { KIND_LABELS, RARITY_CONFIG, isEquippable } from "../types";
import type { Item, Kind } from "../types";
import { isActive, isAmbient, isLive, isInClaudeDir } from "../lib/itemState";
import { Icon } from "./Icon";
import type { IconName } from "./Icon";

/* ── 무기고 지도(ARSENAL MAP) ─────────────────────────────────────────
   전(前) "그래프"(force node-link) 탭을 대체하는 도메인 군집 트리맵.
   ADR 0001 · docs/09 참조. 설계 합의:
   - 모집단 = 전체 카탈로그(보관·미장착 포함) — "내 무기고를 다 펼쳐 본다".
   - 블록 = category, 블록 면적 = 자산 *개수*(무게 아님 — 무게로 하면 보관-only
     도메인이 면적 0으로 증발). 무게(상시 토큰)는 블록 주석 + 테두리 농도로 얹는다.
   - 타일 색 = 로드 상태(장착/설치 베이스/분기/보관).
   - 관계는 *군집 멤버십*으로 표현. pairwise 엣지(동반/유사)는 그리지 않는다.
   - 행동 가능(최소형): 타일 클릭 → 상세, 호버 → 즉석 켜기/끄기, 선택 모드 → 일괄. */

const KIND_ICONS: Record<Kind, IconName> = {
  skill: "puzzle-piece",
  agent: "agent-badge",
  mcp: "wrench",
  memory: "memory-card",
};

const KIND_CHIPS: { key: Kind | "all"; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "skill", label: KIND_LABELS.skill },
  { key: "agent", label: KIND_LABELS.agent },
  { key: "mcp", label: KIND_LABELS.mcp },
  { key: "memory", label: KIND_LABELS.memory },
];

// ── 로드 상태 술어 단일화(lib/itemState 기반) — 대시보드/그래프와 같은 정의 ──
type LoadState = "active" | "ambient" | "divergent" | "vault" | "none";
function loadStateOf(i: Item): LoadState {
  if (!isEquippable(i.kind)) return "none"; // memory — 장착 개념 없음
  if (i.divergent) return "divergent";
  if (isActive(i)) return "active";
  if (isAmbient(i)) return "ambient";
  return "vault"; // 보관(absent) — ~/.claude 에 없음
}
const STATE_META: Record<LoadState, { color: string; label: string }> = {
  active: { color: "var(--color-accent-emerald)", label: "장착" },
  ambient: { color: "var(--color-accent-orange)", label: "설치 베이스" },
  divergent: { color: "var(--color-accent-rose)", label: "분기" },
  vault: { color: "var(--color-muted-soft)", label: "보관" },
  none: { color: "var(--color-muted-soft)", label: "—" },
};

type StateFilter = "all" | "active" | "ambient" | "vault";

// ── 트리맵(squarified) — 의존성 없이 직접 구현. 면적 = value(개수). ──
interface Sized {
  id: string;
  value: number;
}
interface Rect {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}
function squarify(items: Sized[], x: number, y: number, w: number, h: number): Rect[] {
  const total = items.reduce((s, n) => s + n.value, 0);
  if (total <= 0 || w <= 0 || h <= 0) return [];
  const nodes = items
    .map((n) => ({ id: n.id, area: (n.value / total) * (w * h) }))
    .sort((a, b) => b.area - a.area);

  const out: Rect[] = [];
  let rx = x;
  let ry = y;
  let rw = w;
  let rh = h;
  let row: { id: string; area: number }[] = [];

  const shortest = () => Math.min(rw, rh);

  function worstRatio(r: { area: number }[], side: number): number {
    if (r.length === 0) return Infinity;
    const sum = r.reduce((s, n) => s + n.area, 0);
    let max = -Infinity;
    let min = Infinity;
    for (const n of r) {
      if (n.area > max) max = n.area;
      if (n.area < min) min = n.area;
    }
    const side2 = side * side;
    const sum2 = sum * sum;
    return Math.max((side2 * max) / sum2, sum2 / (side2 * min));
  }

  function flushRow() {
    if (row.length === 0) return;
    const sum = row.reduce((s, n) => s + n.area, 0);
    const side = shortest();
    const thick = sum / side; // 행 두께(긴 축 방향)
    if (rw >= rh) {
      // 왼쪽 가장자리에 세로로 한 줄 — side === rh
      let cy = ry;
      for (const n of row) {
        const nh = (n.area / sum) * rh;
        out.push({ id: n.id, x: rx, y: cy, w: thick, h: nh });
        cy += nh;
      }
      rx += thick;
      rw -= thick;
    } else {
      // 위쪽 가장자리에 가로로 한 줄 — side === rw
      let cx = rx;
      for (const n of row) {
        const nw = (n.area / sum) * rw;
        out.push({ id: n.id, x: cx, y: ry, w: nw, h: thick });
        cx += nw;
      }
      ry += thick;
      rh -= thick;
    }
    row = [];
  }

  for (const n of nodes) {
    const side = shortest();
    const cur = worstRatio(row, side);
    const next = worstRatio([...row, n], side);
    if (row.length > 0 && next > cur) flushRow();
    row.push(n);
  }
  flushRow();
  return out;
}

function fmtTok(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

// ── 자산 타일(칩) ──
interface TileProps {
  item: Item;
  selectMode: boolean;
  picked: boolean;
  pending: boolean;
  onOpen: (id: string) => void;
  onToggleSelect: (id: string) => void;
  onToggleLoad: (item: Item) => void;
}
function Tile({ item, selectMode, picked, pending, onOpen, onToggleSelect, onToggleLoad }: TileProps) {
  const st = loadStateOf(item);
  const meta = STATE_META[st];
  const r = RARITY_CONFIG[item.rarity];
  const name = item.nameKo || item.displayName || item.name;
  const togglable = isEquippable(item.kind);
  const on = isInClaudeDir(item);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => (selectMode && togglable ? onToggleSelect(item.id) : onOpen(item.id))}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (selectMode && togglable) onToggleSelect(item.id);
          else onOpen(item.id);
        }
      }}
      title={`${name} · ${KIND_LABELS[item.kind]} · ${meta.label}`}
      aria-label={`${name} · ${KIND_LABELS[item.kind]} · ${meta.label}`}
      className={`group/tile relative flex h-[26px] min-w-0 max-w-[180px] shrink items-center gap-1.5 rounded-md border bg-canvas pl-1.5 pr-2 text-[11px] transition hover:z-10 hover:shadow-sm ${
        picked ? "ring-2 ring-primary" : "border-hairline hover:border-hairline-strong"
      }`}
      style={{ borderLeftWidth: 3, borderLeftColor: r.color }}
    >
      {/* 선택 모드 체크 표식 */}
      {selectMode && togglable && (
        <span
          className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border ${
            picked ? "border-primary bg-primary text-white" : "border-hairline-strong bg-canvas"
          }`}
        >
          {picked && <Icon name="check" size="xs" className="text-white" />}
        </span>
      )}
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: meta.color }} />
      <Icon name={KIND_ICONS[item.kind]} size="xs" className="shrink-0 text-muted-soft" />
      <span className="truncate text-ink">{name}</span>

      {/* 호버 즉석 토글 — 선택 모드가 아닐 때만. 켜짐=끄기, 꺼짐=켜기. */}
      {!selectMode && togglable && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleLoad(item);
          }}
          disabled={pending}
          aria-label={on ? "끄기(보관)" : "켜기(장착)"}
          title={on ? "끄기 → 보관" : "켜기 → 장착"}
          className={`absolute right-0.5 top-1/2 hidden -translate-y-1/2 items-center justify-center rounded p-0.5 group-hover/tile:flex ${
            on ? "text-accent-rose hover:bg-accent-rose/10" : "text-accent-emerald hover:bg-surface-success"
          } disabled:opacity-40`}
        >
          <Icon name={pending ? "sync" : on ? "disconnected" : "check-circle"} size="xs" className={pending ? "animate-spin" : ""} />
        </button>
      )}
    </div>
  );
}

export function ArsenalMap() {
  const items = useStore((s) => s.items);
  const setSelected = useStore((s) => s.setSelected);
  const reloadData = useStore((s) => s.reloadData);

  const [kind, setKind] = useState<Kind | "all">("all");
  const [stateFilter, setStateFilter] = useState<StateFilter>("all");
  const [q, setQ] = useState("");
  const [selectMode, setSelectMode] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [batch, setBatch] = useState<{ done: number; total: number; label: string } | null>(null);

  // ── 컨테이너 치수 측정(트리맵 면적 계산용) ──
  const boxRef = useRef<HTMLDivElement>(null);
  const [dim, setDim] = useState({ w: 1200, h: 700 });
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0].contentRect;
      setDim({ w: Math.max(320, cr.width), h: Math.max(320, cr.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── 필터 적용 → 도메인별 그룹화 ──
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return items.filter((i) => {
      if (kind !== "all" && i.kind !== kind) return false;
      if (stateFilter !== "all") {
        const st = loadStateOf(i);
        if (stateFilter === "active" && st !== "active") return false;
        if (stateFilter === "ambient" && st !== "ambient") return false;
        if (stateFilter === "vault" && st !== "vault") return false;
      }
      if (s) {
        const hay = `${i.name} ${i.displayName} ${i.nameKo ?? ""} ${i.source.repo} ${i.category ?? ""}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [items, kind, stateFilter, q]);

  const blocks = useMemo(() => {
    const byCat = new Map<string, Item[]>();
    for (const i of filtered) {
      const c = i.category || "기타";
      const arr = byCat.get(c);
      if (arr) arr.push(i);
      else byCat.set(c, [i]);
    }
    const list = [...byCat.entries()].map(([cat, members]) => {
      // 도메인 내부 정렬: 켜진 것 먼저 → 점수순. "쏠림"을 위쪽에 모은다.
      const sorted = [...members].sort(
        (a, b) => Number(isLive(b)) - Number(isLive(a)) || (b.score || 0) - (a.score || 0),
      );
      const liveWeight = members.reduce((s, m) => (isLive(m) ? s + (m.descCost ?? 0) : s), 0);
      const liveCount = members.filter(isLive).length;
      return { cat, members: sorted, count: members.length, liveWeight, liveCount };
    });
    // 면적 = 개수. 결정적 정렬(개수 desc → 이름)로 레이아웃 안정.
    list.sort((a, b) => b.count - a.count || a.cat.localeCompare(b.cat, "ko"));
    return list;
  }, [filtered]);

  const maxLiveWeight = useMemo(
    () => blocks.reduce((m, b) => Math.max(m, b.liveWeight), 0),
    [blocks],
  );

  const rects = useMemo(() => {
    const layout = squarify(
      blocks.map((b) => ({ id: b.cat, value: b.count })),
      0,
      0,
      dim.w,
      dim.h,
    );
    const map = new Map(layout.map((r) => [r.id, r]));
    return map;
  }, [blocks, dim]);

  // ── 행동 ──
  const openDetail = useCallback((id: string) => setSelected(id), [setSelected]);
  const toggleSelect = useCallback((id: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // 단일 토글 — isInClaudeDir 기준으로 켜기/끄기. 기존 그래프 일괄 로직과 동일한 분기.
  const toggleLoad = useCallback(
    async (item: Item) => {
      if (pending.has(item.id)) return;
      setPending((p) => new Set(p).add(item.id));
      try {
        const on = isInClaudeDir(item);
        const vaultToggleable = item.managed || item.claudeState === "resident";
        if (on) {
          if (vaultToggleable) await api.activateVault(item.id, false);
          else if (item.equipped) await api.unequip(item.id);
        } else {
          if (vaultToggleable) await api.activateVault(item.id, true);
          else if (!item.equipped) await api.equip(item.id);
        }
        await reloadData();
      } catch {
        /* 개별 실패는 조용히 — 다음 reload 에서 실제 상태로 복원. */
      } finally {
        setPending((p) => {
          const next = new Set(p);
          next.delete(item.id);
          return next;
        });
      }
    },
    [pending, reloadData],
  );

  const runBatch = useCallback(
    async (mode: "equip" | "unequip") => {
      const targets = items.filter((i) => picked.has(i.id) && isEquippable(i.kind));
      if (targets.length === 0) return;
      setBatch({ done: 0, total: targets.length, label: mode === "equip" ? "장착" : "해제" });
      let done = 0;
      for (const it of targets) {
        try {
          const vaultToggleable = it.managed || it.claudeState === "resident";
          if (mode === "equip") {
            if (vaultToggleable) await api.activateVault(it.id, true);
            else if (!it.equipped) await api.equip(it.id);
          } else {
            if (vaultToggleable) await api.activateVault(it.id, false);
            else if (it.equipped) await api.unequip(it.id);
          }
        } catch {
          /* skip */
        }
        done++;
        setBatch((b) => (b ? { ...b, done } : b));
      }
      await reloadData();
      setPicked(new Set());
      setBatch(null);
    },
    [items, picked, reloadData],
  );

  // 빈 카탈로그.
  if (items.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-6">
        <div className="flex flex-col items-center gap-3 rounded-xl border border-hairline bg-canvas px-10 py-12 text-center">
          <Icon name="app-grid" size="xl" className="text-muted-soft" />
          <h2 className="text-base font-bold text-ink">무기고 지도</h2>
          <p className="text-sm text-muted">표시할 자산이 없습니다. 먼저 자산을 스캔하세요.</p>
        </div>
      </div>
    );
  }

  return (
    <main className="flex h-[calc(100vh-3.5rem)] flex-col">
      {/* ── 툴바 ── */}
      <div className="flex flex-wrap items-center gap-2 border-b border-hairline bg-canvas px-5 py-2.5">
        <div className="flex items-center gap-2 rounded-lg border border-hairline bg-surface-soft px-2.5 py-1.5">
          <Icon name="search" size="xs" className="text-muted-soft" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="자산 검색…"
            className="w-40 bg-transparent text-xs text-body outline-none placeholder:text-muted-soft"
          />
          {q && (
            <button onClick={() => setQ("")} aria-label="검색 지우기" className="text-muted-soft hover:text-body">
              <Icon name="close" size="xs" />
            </button>
          )}
        </div>

        {/* 종류 필터 */}
        <div className="flex flex-wrap gap-1">
          {KIND_CHIPS.map((c) => (
            <button
              key={c.key}
              onClick={() => setKind(c.key)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                kind === c.key
                  ? "bg-primary text-white"
                  : "border border-hairline bg-canvas text-muted hover:bg-surface-soft hover:text-body"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* 상태 필터 */}
        <div className="flex flex-wrap gap-1">
          {([
            { key: "all", label: "전체" },
            { key: "active", label: "장착" },
            { key: "ambient", label: "설치 베이스" },
            { key: "vault", label: "보관" },
          ] as { key: StateFilter; label: string }[]).map((s) => (
            <button
              key={s.key}
              onClick={() => setStateFilter(s.key)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                stateFilter === s.key
                  ? "bg-ink text-canvas"
                  : "border border-hairline bg-canvas text-muted hover:bg-surface-soft hover:text-body"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => {
              setSelectMode((v) => !v);
              setPicked(new Set());
            }}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              selectMode ? "bg-primary text-white" : "border border-hairline text-body hover:bg-surface-soft"
            }`}
            title="선택 모드 — 타일을 골라 일괄 장착/해제"
          >
            <Icon name="check-circle" size="xs" /> 선택
          </button>
          <span className="font-mono text-[11px] text-muted-soft">
            {filtered.length}개 · {blocks.length}도메인
          </span>
        </div>
      </div>

      {/* ── 트리맵 캔버스 ── */}
      <div className="relative flex-1 overflow-hidden bg-surface-app">
        <div ref={boxRef} className="absolute inset-2.5">
          {blocks.map((b) => {
            const r = rects.get(b.cat);
            if (!r || r.w < 1 || r.h < 1) return null;
            const intensity = maxLiveWeight > 0 ? b.liveWeight / maxLiveWeight : 0;
            return (
              <div
                key={b.cat}
                className="absolute overflow-hidden rounded-lg border bg-canvas"
                style={{
                  left: r.x + 3,
                  top: r.y + 3,
                  width: Math.max(0, r.w - 6),
                  height: Math.max(0, r.h - 6),
                  // 켜진 무게가 클수록 진한 테두리(primary 톤).
                  borderColor:
                    intensity > 0.05
                      ? `color-mix(in srgb, var(--color-primary) ${Math.round(20 + intensity * 60)}%, var(--color-hairline))`
                      : "var(--color-hairline)",
                  borderWidth: intensity > 0.05 ? 1.5 : 1,
                }}
              >
                {/* 블록 헤더 */}
                <div className="flex items-baseline justify-between gap-2 border-b border-hairline bg-surface-soft/60 px-2.5 py-1.5">
                  <span className="truncate text-xs font-bold text-ink">{b.cat}</span>
                  <span className="shrink-0 font-mono text-[10px] text-muted">
                    {b.count}개
                    {b.liveWeight > 0 && (
                      <span className="text-primary"> · 켜짐 ~{fmtTok(b.liveWeight)} tok</span>
                    )}
                  </span>
                </div>
                {/* 타일 */}
                <div className="flex flex-wrap content-start gap-1 overflow-hidden p-2">
                  {b.members.map((it) => (
                    <Tile
                      key={it.id}
                      item={it}
                      selectMode={selectMode}
                      picked={picked.has(it.id)}
                      pending={pending.has(it.id)}
                      onOpen={openDetail}
                      onToggleSelect={toggleSelect}
                      onToggleLoad={toggleLoad}
                    />
                  ))}
                </div>
              </div>
            );
          })}

          {blocks.length === 0 && (
            <div className="flex h-full items-center justify-center">
              <div className="rounded-xl border border-hairline bg-canvas px-6 py-4 text-center text-sm text-muted shadow-sm">
                조건에 맞는 자산이 없습니다. 필터를 조정하세요.
              </div>
            </div>
          )}
        </div>

        {/* ── 범례 (좌하단) ── */}
        <div className="pointer-events-none absolute bottom-3 left-3 flex flex-col gap-1 rounded-lg border border-hairline bg-canvas/95 p-2.5 text-[10px] shadow-sm backdrop-blur-xl">
          <div className="flex items-center gap-2.5">
            {(["active", "ambient", "vault"] as LoadState[]).map((s) => (
              <span key={s} className="flex items-center gap-1 text-muted">
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: STATE_META[s].color }} />
                {STATE_META[s].label}
              </span>
            ))}
          </div>
          <div className="text-muted-soft">블록 크기 = 개수 · 테두리 농도 = 켜진 무게(추정)</div>
        </div>

        {/* ── 일괄 바 (우상단, 선택 ≥1) ── */}
        {selectMode && picked.size >= 1 && (
          <div className="absolute right-3 top-3 flex flex-col gap-2 rounded-xl border border-hairline bg-canvas/95 p-3 shadow-md backdrop-blur-xl">
            <span className="text-xs font-bold text-body">
              선택 <span className="text-primary">{picked.size}</span>개
            </span>
            {batch ? (
              <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                {batch.label} 중 ({batch.done}/{batch.total})
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <button
                  onClick={() => runBatch("equip")}
                  className="flex items-center justify-center gap-1.5 rounded-lg bg-accent-emerald px-3 py-1.5 text-xs font-bold text-white transition hover:opacity-90"
                >
                  <Icon name="check-circle" size="xs" className="text-white" /> 일괄 켜기
                </button>
                <button
                  onClick={() => runBatch("unequip")}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-accent-rose/40 px-3 py-1.5 text-xs font-semibold text-accent-rose transition hover:bg-accent-rose/10"
                >
                  <Icon name="disconnected" size="xs" /> 일괄 끄기
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
