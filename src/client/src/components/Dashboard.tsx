import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../hooks/useStore";
import { api } from "../lib/api";
import { KIND_LABELS } from "../types";
import type { Item, Kind } from "../types";
import { Icon } from "./Icon";
import type { IconName } from "./Icon";

/* ── 관제탑(CONTROL TOWER) ─────────────────────────────────────
   "내 손바닥 안의 컨트롤 타워" — 무엇이 있고, 무엇이 켜져 있고,
   무엇을 정리할지 한눈에. 가짜 지표(파워/Elo/시너지) 금지,
   세션 로그 기반 사용량은 희소하므로 항상 "기록 없음 ≠ 미사용" 단서를 붙인다. */

// 활성(의도적 장착) 판정 — Loadout으로 링크(claudeState==="link")했거나 장착(equipped)한 자산.
// 앰비언트(ambient: 플러그인·직접 설치로 ~/.claude에 그냥 있는 설치 베이스)와 분기는 제외 —
// 활성 KPI는 "내가 의도적으로 켠 로드아웃"만 센다. 앰비언트는 별도 '설치 베이스' 지표로 분리(정직한 2지표).
function isActive(i: Item): boolean {
  return (!!i.equipped || i.claudeState === "link") && !i.divergent && !i.ambient;
}
// 앰비언트(설치 베이스) — ~/.claude에 물리적으로 있으나 Loadout이 의도적으로 장착한 게 아닌 항목.
function isAmbient(i: Item): boolean {
  return !!i.ambient && !i.divergent;
}

const KIND_ICONS: Record<Kind, IconName> = {
  skill: "puzzle",
  agent: "agent-badge",
  mcp: "wrench",
  memory: "memory-card",
};

// ── 통계 카드 ──
interface StatCardProps {
  label: string;
  value: number;
  icon: IconName;
  accent?: boolean;
  title?: string;
  onClick?: () => void;
}
function StatCard({ label, value, icon, accent, title, onClick }: StatCardProps) {
  const base = `rounded-xl border border-hairline bg-canvas p-4 ${
    accent ? "ring-1 ring-primary/20" : ""
  }`;
  const inner = (
    <>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted">{label}</span>
        <Icon name={icon} size="sm" className={accent ? "text-primary" : "text-muted-soft"} />
      </div>
      <div className="mt-2 font-mono text-3xl font-bold text-ink">{value}</div>
    </>
  );
  if (onClick) {
    return (
      <button
        onClick={onClick}
        title={title}
        className={`${base} text-left transition hover:border-hairline-strong hover:shadow-sm`}
      >
        {inner}
      </button>
    );
  }
  return <div className={base} title={title}>{inner}</div>;
}

// ── 패널 헤더 ──
function PanelHead({ icon, title, note }: { icon: IconName; title: string; note?: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <div className="flex items-center gap-2 text-ink">
        <Icon name={icon} size="sm" className="text-muted" />
        <h2 className="text-sm font-bold">{title}</h2>
      </div>
      {note && <span className="text-[11px] text-muted-soft">{note}</span>}
    </div>
  );
}

// ── 헬스 칩 ──
interface HealthChipProps {
  icon: IconName;
  label: string;
  value: number;
  danger?: boolean;
  onClick?: () => void;
}
function HealthChip({ icon, label, value, danger, onClick }: HealthChipProps) {
  const on = value > 0 && danger;
  const cls = on
    ? "border-accent-rose/30 bg-[var(--color-accent-orange-soft)] text-accent-rose"
    : "border-hairline bg-surface-soft text-muted";
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${cls} ${
        onClick ? "transition hover:border-hairline-strong" : ""
      }`}
    >
      <Icon name={icon} size="sm" className={on ? "text-accent-rose" : "text-muted-soft"} />
      <span className="font-medium">{label}</span>
      <span className="font-mono font-bold text-ink">{value}</span>
    </Tag>
  );
}

export function Dashboard() {
  const items = useStore((s) => s.items);
  const loading = useStore((s) => s.loading);
  const reloadData = useStore((s) => s.reloadData);
  const setFilters = useStore((s) => s.setFilters);
  const navigate = useNavigate();

  const [rescanning, setRescanning] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function doRescan() {
    if (rescanning) return;
    setRescanning(true);
    setActionError(null);
    try {
      await api.rescan();
      await reloadData();
    } catch {
      setActionError("다시 스캔에 실패했습니다 — 서버 연결을 확인하세요.");
    } finally {
      setRescanning(false);
    }
  }
  async function doRefreshUsage() {
    if (syncing) return;
    setSyncing(true);
    setActionError(null);
    try {
      await api.refreshUsage();
      await reloadData();
    } catch {
      setActionError("사용량 동기화에 실패했습니다 — 서버 연결을 확인하세요.");
    } finally {
      setSyncing(false);
    }
  }

  // ── 집계 (모두 실제 데이터에서 파생) ──
  const m = useMemo(() => {
    const total = items.length;

    // kind별 개수
    const kindCounts: Record<Kind, number> = { skill: 0, agent: 0, mcp: 0, memory: 0 };
    for (const i of items) kindCounts[i.kind]++;

    const active = items.filter(isActive);
    const activeCount = active.length;
    // 앰비언트(설치 베이스) — 활성과 별도로 집계. 컨텍스트엔 로드되지만 의도적 로드아웃은 아님.
    const ambient = items.filter(isAmbient);
    const ambientCount = ambient.length;
    // 실제로 컨텍스트에 로드되는 자산(활성 + 앰비언트) — 거대 자산 패널의 모집단.
    const live = [...active, ...ambient];

    // (3a) 중복 자산 — item.group 이 같은 묶음 = 동일 이름 N개.
    const groupMap = new Map<string, Item[]>();
    for (const i of items) {
      if (!i.group) continue;
      const arr = groupMap.get(i.group);
      if (arr) arr.push(i);
      else groupMap.set(i.group, [i]);
    }
    const dupGroups = [...groupMap.entries()]
      .map(([group, members]) => {
        // 표시 이름: nameKo 우선, 없으면 name. 출처 repo 유니크 목록.
        // 대표 멤버는 안정 키(id)로 고정 — 스캔 순서가 바뀌어도 라벨/아이콘이 흔들리지 않게.
        const lead = [...members].sort((a, b) => a.id.localeCompare(b.id))[0];
        const repos = [...new Set(members.map((x) => x.source.repo))].sort();
        const label = lead.nameKo || lead.displayName || lead.name;
        return { group, members, lead, count: members.length, repos, label };
      })
      .filter((g) => g.count > 1) // 실제로 여러 벌인 것만
      .sort((a, b) => b.count - a.count);
    const dupGroupCount = dupGroups.length;
    const dupItemTotal = dupGroups.reduce((s, g) => s + g.count, 0);

    // (3b) 거대 자산 — 실제 로드되는 자산(활성+앰비언트) 중 oversized. 설치 베이스의 거대 번들(gstack 등)도 포함.
    const oversizedActive = live.filter((i) => i.oversized);

    // (4) 사용 현황 — 전체 자산 중 uses>0 vs 기록 없음.
    //     활성 자산만 스코프하면 "기록 있음 0"이 되는 경우가 있어 혼란을 줌.
    //     uses 는 세션 로그 기반이라 희소 → "기록 없음"이지 "미사용"이 아니다.
    const usedAll = items
      .filter((i) => (i.uses ?? 0) > 0)
      .sort((a, b) => (b.uses ?? 0) - (a.uses ?? 0));
    const usedCount = usedAll.length;
    const noRecordCount = total - usedCount;
    const topUsed = usedAll.slice(0, 6);

    // (5) 헬스 — 분기 / 거대 / 중복그룹 / MCP(기록 전용).
    const divergentCount = items.filter((i) => i.divergent).length;
    const oversizedTotal = items.filter((i) => i.oversized).length;
    const mcpCount = kindCounts.mcp;

    return {
      total,
      kindCounts,
      activeCount,
      ambientCount,
      dupGroups,
      dupGroupCount,
      dupItemTotal,
      oversizedActive,
      usedCount,
      noRecordCount,
      topUsed,
      divergentCount,
      oversizedTotal,
      mcpCount,
    };
  }, [items]);

  const cleanupEmpty = m.dupGroupCount === 0 && m.oversizedActive.length === 0;

  return (
    <main className="mx-auto max-w-[1800px] px-6 py-6 pb-24">
      {/* ── 1. 헤더 + 빠른 작업 ── */}
      <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1
            className="text-lg font-black tracking-wide text-ink"
            style={{ fontFamily: "var(--font-display)" }}
          >
            관제탑
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Skill·Agent·MCP·Memory — 무엇이 있고, 무엇이 켜져 있고, 무엇을 정리할지 한눈에.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={doRescan}
            disabled={rescanning}
            aria-busy={rescanning}
            className="flex items-center gap-1.5 rounded-lg border border-hairline px-4 py-2 text-xs font-medium text-body transition hover:bg-surface-soft disabled:opacity-50"
            title="소스를 다시 스캔해 카탈로그를 갱신합니다"
          >
            <Icon name="refresh" size="sm" className={rescanning ? "animate-spin" : ""} />
            {rescanning ? "스캔 중..." : "다시 스캔"}
          </button>
          <button
            onClick={doRefreshUsage}
            disabled={syncing}
            aria-busy={syncing}
            className="flex items-center gap-1.5 rounded-lg border border-hairline px-4 py-2 text-xs font-medium text-body transition hover:bg-surface-soft disabled:opacity-50"
            title="세션 로그를 다시 스캔해 사용량을 갱신합니다"
          >
            <Icon name="sync" size="sm" className={syncing ? "animate-spin" : ""} />
            {syncing ? "동기화 중..." : "사용량 동기화"}
          </button>
          <button
            onClick={() => navigate("/assets")}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white transition hover:bg-primary-active"
            title="자산 탭에서 새 Skill·Agent·MCP를 가져옵니다"
          >
            <Icon name="upload" size="sm" /> 가져오기
          </button>
        </div>
        {actionError && (
          <p
            role="alert"
            aria-live="assertive"
            className="flex w-full items-center gap-1.5 rounded-lg bg-accent-rose/10 px-3 py-2 text-xs font-medium text-accent-rose"
          >
            <Icon name="warning" size="sm" className="shrink-0" />
            {actionError}
          </p>
        )}
      </header>

      {/* ── 1b. 첫 실행 온보딩 패널 — 카탈로그가 진짜 비어 있을 때만(로딩 중·오류 아님) ── */}
      {/* 필터로 결과가 0개인 경우와 구별: 이 패널은 items 배열 자체가 0개인 경우에만 표시. */}
      {!loading && items.length === 0 && (
        <section
          role="region"
          aria-label="첫 실행 안내"
          className="mb-6 rounded-xl border border-primary/20 bg-primary-soft p-6 text-center"
        >
          <div className="mb-3 flex justify-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Icon name="backpack" size="lg" className="text-primary" />
            </span>
          </div>
          <h2 className="mb-1.5 text-base font-bold text-ink">아직 자산이 없습니다</h2>
          <p className="mb-4 text-sm text-muted">
            Skill·Agent·MCP·Memory를 추가하면 이 대시보드에서 한눈에 관리할 수 있습니다.
            <br />
            소스를 등록하거나 다시 스캔해 카탈로그를 채워보세요.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              onClick={() => navigate("/assets")}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-active"
            >
              <Icon name="upload" size="sm" /> 소스 추가
            </button>
            <button
              onClick={doRescan}
              disabled={rescanning}
              aria-busy={rescanning}
              className="flex items-center gap-1.5 rounded-lg border border-hairline px-4 py-2 text-sm font-medium text-body transition hover:bg-surface-soft disabled:opacity-50"
            >
              <Icon name="refresh" size="sm" className={rescanning ? "animate-spin" : ""} />
              {rescanning ? "스캔 중..." : "다시 스캔"}
            </button>
          </div>
        </section>
      )}

      {/* ── 2. 통계 카드 ── */}
      {/* 정직한 2지표: '로드아웃 장착'(Loadout으로 의도적으로 켠 것) ≠ '설치 베이스'(~/.claude에 그냥 있는 설치물). */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {(Object.keys(KIND_LABELS) as Kind[]).map((k) => (
          <StatCard
            key={k}
            label={KIND_LABELS[k]}
            value={m.kindCounts[k]}
            icon={KIND_ICONS[k]}
            onClick={() => { setFilters({ kind: k, group: undefined, dupOnly: false, rarity: "all", category: "all", q: "", equipOnly: false, favOnly: false, sort: "score" }); navigate("/assets"); }}
          />
        ))}
        <StatCard
          label="로드아웃 장착"
          value={m.activeCount}
          icon="backpack"
          accent
          title="Loadout으로 의도적으로 장착(링크)한 자산. 자산 탭에서 장착하면 늘어납니다."
          onClick={() => navigate("/loadout")}
        />
        <StatCard
          label="설치 베이스"
          value={m.ambientCount}
          icon="package"
          title="플러그인·직접 설치로 ~/.claude에 이미 있는 자산(앰비언트). 장착과 별개로 컨텍스트에 로드됩니다."
          onClick={() => navigate("/loadout")}
        />
      </div>

      <div className="mt-6 space-y-6">
        {/* ── 3. 정리 후보 ── */}
        <section className="rounded-xl border border-hairline bg-canvas p-5">
          <PanelHead
            icon="copy"
            title="정리 후보"
            note="실제 중복·거대 자산만 — 가짜 '미사용' 목록이 아닙니다"
          />

          {cleanupEmpty ? (
            <div className="flex items-center gap-2 rounded-lg bg-surface-soft px-4 py-3 text-sm text-muted">
              <Icon name="check-circle" size="sm" className="text-accent-emerald" />
              정리할 중복·거대 자산이 없습니다 ✓
            </div>
          ) : (
            <div className="space-y-5">
              {/* 3a. 중복 자산 */}
              {m.dupGroupCount > 0 && (
                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-body">
                      <Icon name="duplicate" size="sm" className="text-accent-orange" />
                      중복 자산
                      <span className="font-mono text-muted">
                        그룹 {m.dupGroupCount} · 총 {m.dupItemTotal}개
                      </span>
                    </div>
                    <button
                      onClick={() => { setFilters({ dupOnly: true, group: undefined, kind: "all", rarity: "all", category: "all", q: "", equipOnly: false, favOnly: false, sort: "score" }); navigate("/assets"); }}
                      className="text-[11px] font-medium text-primary hover:underline"
                    >
                      자산에서 정리 →
                    </button>
                  </div>
                  <p className="mb-2 text-[11px] text-muted-soft">
                    같은 이름의 자산이 여러 벌 — 하나만 두고 정리 가능.
                  </p>
                  <ul className="divide-y divide-hairline overflow-hidden rounded-lg border border-hairline">
                    {m.dupGroups.slice(0, 6).map((g) => (
                      <li key={g.group}>
                        <button
                          onClick={() => { setFilters({ group: g.group, dupOnly: false, kind: "all", rarity: "all", category: "all", q: "", equipOnly: false, favOnly: false, sort: "score" }); navigate("/assets"); }}
                          title="이 동일 계열만 자산에서 비교"
                          className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition hover:bg-surface-soft"
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <Icon
                              name={KIND_ICONS[g.lead.kind]}
                              size="sm"
                              className="shrink-0 text-muted-soft"
                            />
                            <span className="truncate text-sm text-ink">{g.label}</span>
                          </span>
                          <span className="flex shrink-0 items-center gap-2 text-[11px] text-muted">
                            <span className="truncate max-w-[260px]">
                              {g.repos.slice(0, 3).join(" · ")}
                              {g.repos.length > 3 ? ` +${g.repos.length - 3}` : ""}
                            </span>
                            <span className="rounded-full bg-surface-soft px-2 py-0.5 font-mono font-semibold text-body">
                              동일 이름 {g.count}개
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  {m.dupGroupCount > 6 && (
                    <p className="mt-2 text-[11px] text-muted-soft">
                      외 <span className="font-mono">{m.dupGroupCount - 6}</span>개 그룹 더 —
                      자산 탭에서 전체 확인.
                    </p>
                  )}
                </div>
              )}

              {/* 3b. 거대 자산 */}
              {m.oversizedActive.length > 0 && (
                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-body">
                      <Icon name="package" size="sm" className="text-accent-orange" />
                      거대 자산
                      <span className="font-mono text-muted">{m.oversizedActive.length}개 켜짐</span>
                    </div>
                    <button
                      onClick={() => navigate("/loadout")}
                      className="text-[11px] font-medium text-primary hover:underline"
                    >
                      인벤토리에서 보관 →
                    </button>
                  </div>
                  <p className="mb-2 text-[11px] text-muted-soft">
                    보관(vault)으로 옮기면 컨텍스트를 절약할 수 있습니다.
                  </p>
                  <ul className="divide-y divide-hairline overflow-hidden rounded-lg border border-hairline">
                    {m.oversizedActive.slice(0, 6).map((i) => (
                      <li key={i.id}>
                        <button
                          onClick={() => navigate("/loadout")}
                          title="장착·보관에서 보기"
                          className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition hover:bg-surface-soft"
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <Icon
                              name={KIND_ICONS[i.kind]}
                              size="sm"
                              className="shrink-0 text-muted-soft"
                            />
                            <span className="truncate text-sm text-ink">
                              {i.nameKo || i.displayName || i.name}
                            </span>
                          </span>
                          {/* 거대 자산의 본질은 "큰 본문" — oversized 판정 기준인 호출 시(on-demand) 본문 비용을
                              보여준다(이게 vault 로 옮겼을 때 절약되는 양). 상시(descCost)는 작아서 여기선 무의미. */}
                          {typeof i.cost === "number" ? (
                            <span
                              className="shrink-0 rounded-full bg-[var(--color-accent-orange-soft)] px-2 py-0.5 font-mono text-[11px] font-semibold text-accent-orange"
                              title="호출 시 본문 비용 (on-demand) — vault 로 옮기면 절약되는 양"
                            >
                              본문 ~{i.cost.toLocaleString()} tok
                            </span>
                          ) : typeof i.descCost === "number" ? (
                            <span
                              className="shrink-0 rounded-full bg-[var(--color-accent-orange-soft)] px-2 py-0.5 font-mono text-[11px] font-semibold text-accent-orange"
                              title="상시 컨텍스트 비용 (always-on)"
                            >
                              상시 ~{i.descCost.toLocaleString()} tok
                            </span>
                          ) : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>

        {/* ── 4. 사용 현황 (정직) ── */}
        <section className="rounded-xl border border-hairline bg-canvas p-5">
          <PanelHead icon="activity" title="사용 현황" note="전체 자산 기준" />

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-hairline bg-surface-soft p-3">
              <div className="text-[11px] font-semibold text-muted">기록 있음 (uses &gt; 0)</div>
              <div className="mt-1 font-mono text-2xl font-bold text-accent-emerald">
                {m.usedCount}
              </div>
            </div>
            <div className="rounded-lg border border-hairline bg-surface-soft p-3">
              <div className="text-[11px] font-semibold text-muted">사용 기록 없음</div>
              <div className="mt-1 font-mono text-2xl font-bold text-muted">{m.noRecordCount}</div>
            </div>
            <div className="rounded-lg border border-hairline bg-surface-soft p-3">
              <div className="text-[11px] font-semibold text-muted">전체 합계</div>
              <div className="mt-1 font-mono text-2xl font-bold text-ink">{m.total}</div>
            </div>
          </div>

          <p className="mt-3 flex items-start gap-1.5 text-[11px] text-muted-soft">
            <Icon name="info" size="xs" className="mt-0.5 shrink-0" />
            사용 기록은 세션 로그 기반이라 일부만 집계됩니다 — 기록이 없다고 안 쓰는 건 아닙니다.
          </p>

          {m.topUsed.length > 0 && (
            <div className="mt-4">
              <div className="mb-2 text-xs font-semibold text-body">최근 많이 쓴 자산</div>
              <ul className="divide-y divide-hairline overflow-hidden rounded-lg border border-hairline">
                {m.topUsed.map((i) => (
                  <li key={i.id}>
                    <button
                      onClick={() => navigate("/loadout")}
                      title="장착·보관에서 보기"
                      className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition hover:bg-surface-soft"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <Icon
                          name={KIND_ICONS[i.kind]}
                          size="sm"
                          className="shrink-0 text-muted-soft"
                        />
                        <span className="truncate text-sm text-ink">
                          {i.nameKo || i.displayName || i.name}
                        </span>
                      </span>
                      <span className="shrink-0 rounded-full bg-surface-success px-2 py-0.5 font-mono text-[11px] font-semibold text-accent-emerald">
                        {(i.uses ?? 0).toLocaleString()}회
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* ── 5. 헬스 ── */}
        <section className="rounded-xl border border-hairline bg-canvas p-5">
          <PanelHead icon="gauge" title="헬스" note="무결성·정리 신호" />
          <div className="flex flex-wrap gap-2">
            <HealthChip
              icon="warning"
              label="분기 (divergent)"
              value={m.divergentCount}
              danger
              onClick={() => navigate("/loadout")}
            />
            <HealthChip
              icon="package"
              label="거대 자산(전체)"
              value={m.oversizedTotal}
              onClick={() => navigate("/loadout")}
            />
            <HealthChip
              icon="copy"
              label="중복 그룹"
              value={m.dupGroupCount}
              onClick={() => { setFilters({ dupOnly: true, group: undefined, kind: "all", rarity: "all", category: "all", q: "", equipOnly: false, favOnly: false, sort: "score" }); navigate("/assets"); }}
            />
            <HealthChip icon="network" label="MCP (기록 전용)" value={m.mcpCount} />
          </div>
          {m.divergentCount > 0 && (
            <p className="mt-3 text-[11px] text-accent-rose">
              분기된 자산이 있습니다 — 인벤토리에서 pull/push 로 해소하세요.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
