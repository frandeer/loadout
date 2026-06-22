import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../hooks/useStore";
import { api } from "../lib/api";
import { KIND_LABELS } from "../types";
import type { Item, Kind } from "../types";
import { isActive, isAmbient, isLive } from "../lib/itemState";
import { Icon } from "./Icon";
import type { IconName } from "./Icon";

/* ── 관제탑(CONTROL TOWER) ─────────────────────────────────────
   "지금 내 Claude 상태"(착지 의도 A) 다이제스트 — 3초 스캔용.
   ① 컨텍스트 무게(헤드라인, 토큰 추정) ② 개수(보조) ③ 정리=환수형만
   ④ 헬스. 가짜·이력 패널 금지. 무게는 바이트/4 근사라 항상 "추정" 표기.
   docs/09 · CONTEXT.md 참조.

   활성/설치 베이스/라이브 판정은 lib/itemState 로 단일화(지도·인벤토리와 동일 정의). */

const KIND_ICONS: Record<Kind, IconName> = {
  skill: "puzzle-piece",
  agent: "agent-badge",
  mcp: "wrench",
  memory: "memory-card",
};

// ── 통계 카드(보조 — 개수) ──
interface StatCardProps {
  label: string;
  value: number;
  icon: IconName;
  accent?: boolean;
  title?: string;
  onClick?: () => void;
}
function StatCard({ label, value, icon, accent, title, onClick }: StatCardProps) {
  const base = `rounded-xl border border-hairline bg-canvas p-3.5 ${
    accent ? "ring-1 ring-primary/20" : ""
  }`;
  const inner = (
    <>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted">{label}</span>
        <Icon name={icon} size="sm" className={accent ? "text-primary" : "text-muted-soft"} />
      </div>
      <div className="mt-1.5 font-mono text-2xl font-bold text-ink">{value}</div>
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

function fmtTok(n: number): string {
  return n.toLocaleString();
}

// 컨텍스트 창 기준선 — 표준 Claude 200k. 상시 무게가 이 중 몇 %를 늘 차지하는지 가늠용.
const CONTEXT_WINDOW = 200_000;

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

    const kindCounts: Record<Kind, number> = { skill: 0, agent: 0, mcp: 0, memory: 0 };
    for (const i of items) kindCounts[i.kind]++;

    const active = items.filter(isActive);
    const ambient = items.filter(isAmbient);
    const live = items.filter(isLive); // 실제 로드(활성+설치 베이스) — 무게 모집단.

    // ── 컨텍스트 무게(추정, 바이트/4) ──
    const sumDesc = (xs: Item[]) => xs.reduce((s, i) => s + (i.descCost ?? 0), 0);
    const sumBody = (xs: Item[]) => xs.reduce((s, i) => s + (i.cost ?? 0), 0);
    const alwaysOn = sumDesc(live);           // 상시 — 켜져 있기만 해도 매 턴 부하.
    const activeAlwaysOn = sumDesc(active);
    const ambientAlwaysOn = sumDesc(ambient);
    const onDemandReserve = sumBody(live);    // 호출 시 — 실제 부를 때 본문.

    // ── 정리(환수형) — 켜진 거대 자산. 보관 시 본문 비용만큼 환수. ──
    const oversizedLive = live
      .filter((i) => i.oversized)
      .sort((a, b) => (b.cost ?? 0) - (a.cost ?? 0));
    const reclaimable = sumBody(oversizedLive);

    // ── 헬스 신호 ──
    const groupMap = new Map<string, number>();
    for (const i of items) {
      if (!i.group) continue;
      groupMap.set(i.group, (groupMap.get(i.group) ?? 0) + 1);
    }
    const dupGroupCount = [...groupMap.values()].filter((n) => n > 1).length;
    const divergentCount = items.filter((i) => i.divergent).length;
    const oversizedTotal = items.filter((i) => i.oversized).length;
    const mcpCount = kindCounts.mcp;

    return {
      total,
      kindCounts,
      activeCount: active.length,
      ambientCount: ambient.length,
      alwaysOn,
      activeAlwaysOn,
      ambientAlwaysOn,
      onDemandReserve,
      oversizedLive,
      reclaimable,
      dupGroupCount,
      divergentCount,
      oversizedTotal,
      mcpCount,
    };
  }, [items]);

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
            지금 무엇이 켜져 있고 · 컨텍스트를 얼마나 먹고 · 뭘 꺼야 하나.
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

      {/* ── 1b. 첫 실행 온보딩 ── */}
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

      {/* ── 2. 헤드라인 — 컨텍스트 무게(추정) ── */}
      <section className="rounded-2xl border border-hairline bg-canvas p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted">
              <Icon name="gauge" size="sm" className="text-primary" />
              상시 컨텍스트 무게
              <span
                className="rounded-full bg-surface-soft px-1.5 py-0.5 text-[10px] font-medium text-muted-soft"
                title="비용은 바이트 기반 근사(바이트÷4) — 실제 토크나이저 토큰과 다를 수 있습니다."
              >
                추정
              </span>
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-mono text-4xl font-bold text-ink">~{fmtTok(m.alwaysOn)}</span>
              <span className="text-sm font-medium text-muted">tok</span>
              <span className="text-xs font-medium text-muted-soft">/ {fmtTok(CONTEXT_WINDOW / 1000)}k</span>
            </div>

            {/* ── 예산 대비 게이지 — 200k 컨텍스트 창 중 상시 차지분(추정) ── */}
            {(() => {
              const pct = (m.alwaysOn / CONTEXT_WINDOW) * 100;
              const activePct = (m.activeAlwaysOn / CONTEXT_WINDOW) * 100;
              const ambientPct = (m.ambientAlwaysOn / CONTEXT_WINDOW) * 100;
              const fmtPct = (p: number) => (p < 0.1 ? "<0.1" : p < 10 ? p.toFixed(1) : Math.round(p));
              return (
                <div
                  className="mt-2 max-w-[420px]"
                  title={`200k 컨텍스트 창 대비 상시 무게 추정 ${fmtPct(pct)}%`}
                >
                  <div className="flex h-2 w-full overflow-hidden rounded-full bg-surface-soft">
                    <div
                      className="h-full bg-[var(--color-accent-emerald)]"
                      style={{ width: `${Math.min(activePct, 100)}%` }}
                    />
                    <div
                      className="h-full bg-[var(--color-accent-orange)]"
                      style={{ width: `${Math.min(ambientPct, 100 - Math.min(activePct, 100))}%` }}
                    />
                  </div>
                  <div className="mt-1 text-[10px] font-medium text-muted-soft">
                    컨텍스트 창의 ~{fmtPct(pct)}% 상시 점유 (추정)
                  </div>
                </div>
              );
            })()}

            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent-emerald)]" />
                장착 ~{fmtTok(m.activeAlwaysOn)}
              </span>
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent-orange)]" />
                설치 베이스 ~{fmtTok(m.ambientAlwaysOn)}
              </span>
              <span className="text-muted-soft">·</span>
              <span title="실제 호출(로드) 시 본문이 추가로 드는 비용 추정">
                호출 시 예비 ~{fmtTok(m.onDemandReserve)} tok
              </span>
            </div>
          </div>

          {m.oversizedLive.length > 0 && (
            <button
              onClick={() => navigate("/loadout")}
              className="rounded-xl border border-[var(--color-accent-orange)]/30 bg-[var(--color-accent-orange-soft)] px-4 py-3 text-left transition hover:border-[var(--color-accent-orange)]/50"
              title="거대 자산을 보관(vault)으로 옮기면 환수됩니다"
            >
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-accent-orange">
                <Icon name="package" size="sm" /> 거대 자산 {m.oversizedLive.length}개 켜짐
              </div>
              <div className="mt-0.5 font-mono text-lg font-bold text-accent-orange">
                ~{fmtTok(m.reclaimable)} tok 환수 가능
              </div>
            </button>
          )}
        </div>
      </section>

      {/* ── 3. 개수(보조) ── */}
      <div className="mt-4 flex items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted">카탈로그</span>
        <div className="h-px flex-1 bg-hairline" />
      </div>
      <div className="mt-2 grid grid-cols-3 gap-3 sm:grid-cols-6">
        {(Object.keys(KIND_LABELS) as Kind[]).map((k) => (
          <StatCard
            key={k}
            label={KIND_LABELS[k]}
            value={m.kindCounts[k]}
            icon={KIND_ICONS[k]}
            onClick={() => { setFilters({ kind: k, group: undefined, dupOnly: false, rarity: "all", category: "all", q: "", tag: null, equipOnly: false, favOnly: false, sort: "score" }); navigate("/assets"); }}
          />
        ))}
        <StatCard
          label="로드아웃 장착"
          value={m.activeCount}
          icon="backpack"
          accent
          title="Loadout으로 의도적으로 장착(링크)한 자산."
          onClick={() => navigate("/loadout")}
        />
        <StatCard
          label="설치 베이스"
          value={m.ambientCount}
          icon="package"
          title="플러그인·직접 설치로 ~/.claude에 이미 있는 자산(앰비언트)."
          onClick={() => navigate("/loadout")}
        />
      </div>

      <div className="mt-6 space-y-6">
        {/* ── 4. 정리 후보(환수형만) ── */}
        <section className="rounded-xl border border-hairline bg-canvas p-5">
          <PanelHead
            icon="package"
            title="정리 후보"
            note="끄면 컨텍스트가 실제로 줄어드는 것만 — 중복 정리는 자산 탭"
          />
          {m.oversizedLive.length === 0 ? (
            <div className="flex items-center gap-2 rounded-lg bg-surface-soft px-4 py-3 text-sm text-muted">
              <Icon name="check-circle" size="sm" className="text-accent-emerald" />
              켜진 거대 자산이 없습니다 ✓
            </div>
          ) : (
            <div>
              <p className="mb-2 text-[11px] text-muted-soft">
                켜진 거대 자산 — 보관(vault)으로 옮기면 호출 시 본문 비용을 환수합니다.
              </p>
              <ul className="divide-y divide-hairline overflow-hidden rounded-lg border border-hairline">
                {m.oversizedLive.slice(0, 8).map((i) => (
                  <li key={i.id}>
                    <button
                      onClick={() => navigate("/loadout")}
                      title="장착·보관에서 보관 처리"
                      className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition hover:bg-surface-soft"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <Icon name={KIND_ICONS[i.kind]} size="sm" className="shrink-0 text-muted-soft" />
                        <span className="truncate text-sm text-ink">
                          {i.nameKo || i.displayName || i.name}
                        </span>
                      </span>
                      {typeof i.cost === "number" && (
                        <span
                          className="shrink-0 rounded-full bg-[var(--color-accent-orange-soft)] px-2 py-0.5 font-mono text-[11px] font-semibold text-accent-orange"
                          title="호출 시 본문 비용 — 보관 시 환수되는 양(추정)"
                        >
                          본문 ~{fmtTok(i.cost)} tok
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
              {m.oversizedLive.length > 8 && (
                <p className="mt-2 text-[11px] text-muted-soft">
                  외 <span className="font-mono">{m.oversizedLive.length - 8}</span>개 더 — 장착·보관 탭에서 전체 확인.
                </p>
              )}
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
              icon="duplicate"
              label="중복 그룹"
              value={m.dupGroupCount}
              onClick={() => { setFilters({ dupOnly: true, group: undefined, kind: "all", rarity: "all", category: "all", q: "", equipOnly: false, favOnly: false, sort: "score" }); navigate("/assets"); }}
            />
            <HealthChip icon="network" label="MCP (기록 전용)" value={m.mcpCount} />
          </div>
          {m.divergentCount > 0 && (
            <p className="mt-3 text-[11px] text-accent-rose">
              분기된 자산이 있습니다 — 장착·보관에서 pull/push 로 해소하세요.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
