import { useState } from "react";
import { useStore } from "../hooks/useStore";
import { RARITY_CONFIG } from "../types";
import type { Item, Kind } from "../types";
import { api } from "../lib/api";
import { teamCost } from "../lib/traits";
import { ManaGauge } from "./ManaGauge";
import { CardDrop } from "./CardDrop";
import { Icon } from "./Icon";

const KIND_LABEL: Record<Kind, { label: string; note: string }> = {
  skill: { label: "스킬", note: "~/.claude/skills 정션" },
  agent: { label: "에이전트", note: "~/.claude/agents 복사" },
  mcp: { label: "MCP 장비", note: "기록만 — 수동 설정 권장" },
  memory: { label: "메모리", note: "읽기 전용 — 장착 없음" },
};

export function Inventory() {
  const { items, reloadData, setSelected } = useStore();
  const [busy, setBusy] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const equipped = items.filter((i) => i.equipped);
  // 꺼짐·보관됨 — vault 관리 자산 중 ~/.claude 에 없는(absent) 것.
  const stored = items.filter((i) => i.managed && i.claudeState === "absent");
  const totalCost = teamCost(equipped);
  const displayName = (i: Item) => i.displayName;

  const withdraw = async (item: Item) => {
    if (item.oversized && !window.confirm(`${item.displayName}는 거대 자산입니다. 끄면 vault로 이동(보관)됩니다. 진행할까요?`)) return;
    setBusy(item.id);
    try {
      // vault 관리/상주 자산은 끄기(보관 — 상주는 vault로 lazy 이동) — 그 외는 기존 해제 경로.
      if (item.managed || item.claudeState === "resident") await api.activateVault(item.id, false);
      else await api.unequip(item.id);
      await reloadData();
    } catch {}
    setBusy(null);
  };

  // 켜기 — 보관된 vault 자산을 다시 ~/.claude 에 활성화.
  const activate = async (id: string) => {
    setBusy(id);
    try {
      await api.activateVault(id, true);
      await reloadData();
    } catch {}
    setBusy(null);
  };

  // 분기 해소 — pull(vault→라이브) / push(라이브→vault).
  const resolve = async (id: string, choice: "pull" | "push") => {
    setBusy(id);
    try {
      await api.resolveDivergence(id, choice);
      await reloadData();
    } catch {}
    setBusy(null);
  };

  // 행 상태 칩 — 거대·지연 / 분기(해소 버튼). busy 중에는 버튼 비활성.
  const rowBadges = (item: Item) => (
    <>
      {item.oversized && (
        <span
          className="rounded-full bg-accent-orange-soft px-2 py-0.5 text-[10px] font-semibold text-accent-orange"
          title="끄면 vault로 이동 보관"
        >
          거대·지연
        </span>
      )}
      {item.divergent && (
        <>
          <span className="rounded-full bg-accent-rose/10 px-2 py-0.5 text-[10px] font-semibold text-accent-rose">
            ⚠ 분기
          </span>
          <button
            onClick={() => resolve(item.id, "pull")}
            disabled={busy === item.id}
            className="rounded-md border border-hairline px-2 py-0.5 text-[10px] font-medium text-muted transition hover:border-primary hover:text-primary disabled:opacity-40"
            title="vault → 라이브 사본 덮어쓰기"
          >
            당기기(pull)
          </button>
          <button
            onClick={() => resolve(item.id, "push")}
            disabled={busy === item.id}
            className="rounded-md border border-hairline px-2 py-0.5 text-[10px] font-medium text-muted transition hover:border-primary hover:text-primary disabled:opacity-40"
            title="라이브 → vault 덮어쓰기"
          >
            밀기(push)
          </button>
        </>
      )}
    </>
  );

  const syncUsage = async () => {
    setSyncing(true);
    try {
      await api.refreshUsage();
      await reloadData();
    } catch {}
    setSyncing(false);
  };

  return (
    <main className="mx-auto max-w-[1200px] px-5 py-5">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-wide text-muted">인벤토리</div>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-ink">장착 자산 현황</h2>
          <p className="mt-1 text-sm text-muted">
            지금 <span className="font-mono text-primary">~/.claude</span>에 장착되어 활성인 자산입니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CardDrop />
          <button
            onClick={syncUsage}
            disabled={syncing}
            className="flex items-center gap-1.5 rounded-lg border border-hairline px-4 py-2 text-xs font-medium text-body transition hover:bg-surface-soft disabled:opacity-50"
            title="세션 로그를 다시 스캔해 사용량(경험치)을 갱신합니다"
          >
            <Icon name="sync" size="sm" /> {syncing ? "동기화 중..." : "사용량 동기화"}
          </button>
        </div>
      </div>

      {equipped.length > 0 && (
        <div className="mb-5 rounded-xl border border-hairline bg-canvas px-4 py-3">
          <ManaGauge cost={totalCost} label="장착 컨텍스트 부하" />
        </div>
      )}

      {equipped.length === 0 && stored.length === 0 ? (
        <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-xl border border-hairline bg-canvas text-sm text-muted">
          <Icon name="backpack" size="xl" className="opacity-20" />
          장착된 자산 없음 — 홈에서 자산을 선택해 장착하세요
        </div>
      ) : equipped.length > 0 ? (
        <div className="space-y-6">
          {(["skill", "agent", "mcp"] as const).map((kind) => {
            const list = equipped.filter((i) => i.kind === kind);
            if (!list.length) return null;
            const k = KIND_LABEL[kind];
            return (
              <section key={kind}>
                <div className="mb-2 flex items-baseline gap-3">
                  <h3 className="text-sm font-bold text-ink">{k.label}</h3>
                  <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-semibold text-primary">{list.length}</span>
                  <span className="text-[10px] text-muted">{k.note}</span>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  {list.map((item) => {
                    const r = RARITY_CONFIG[item.rarity];
                    return (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 rounded-lg border border-hairline bg-canvas px-3 py-2.5 transition hover:border-hairline-strong"
                      >
                        <Icon name="check-circle" size="xs" />
                        <button onClick={() => setSelected(item.id)} className="min-w-0 flex-1 text-left">
                          <div className="truncate text-sm font-semibold text-ink hover:text-primary">
                            {displayName(item)}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted">
                            <span className="font-semibold" style={{ color: r.color }}>{r.ko}</span>
                            <span className="font-mono">{item.score}pt</span>
                            <span className="truncate">{item.source.owner}/{item.source.repo}</span>
                            {rowBadges(item)}
                          </div>
                        </button>
                        <button
                          onClick={() => withdraw(item)}
                          disabled={busy === item.id}
                          className="rounded-lg border border-hairline px-3 py-1.5 text-[11px] font-medium text-muted transition hover:border-accent-rose hover:text-accent-rose disabled:opacity-40"
                        >
                          {busy === item.id ? "..." : "해제"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      ) : null}

      {/* 꺼짐 · 보관됨 — vault에 보관된 비활성 자산. 켜기로 다시 활성화. */}
      {stored.length > 0 && (
        <section className="mt-8">
          <div className="mb-2 flex items-baseline gap-3">
            <h3 className="text-sm font-bold text-ink">꺼짐 · 보관됨</h3>
            <span className="rounded-full bg-surface-soft px-2 py-0.5 text-[11px] font-semibold text-muted">{stored.length}</span>
            <span className="text-[10px] text-muted">vault 보관 — 켜면 ~/.claude 에 활성화</span>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {stored.map((item) => {
              const r = RARITY_CONFIG[item.rarity];
              return (
                <div
                  key={item.id}
                  className="flex items-center gap-3 rounded-lg border border-hairline bg-canvas/60 px-3 py-2.5 transition hover:border-hairline-strong"
                >
                  <Icon name="backpack" size="xs" className="opacity-50" />
                  <button onClick={() => setSelected(item.id)} className="min-w-0 flex-1 text-left">
                    <div className="truncate text-sm font-semibold text-muted hover:text-primary">
                      {displayName(item)}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted">
                      <span className="font-semibold" style={{ color: r.color }}>{r.ko}</span>
                      <span className="font-mono">{item.score}pt</span>
                      <span className="truncate">{item.source.owner}/{item.source.repo}</span>
                      {rowBadges(item)}
                    </div>
                  </button>
                  <button
                    onClick={() => activate(item.id)}
                    disabled={busy === item.id}
                    className="rounded-lg border border-hairline px-3 py-1.5 text-[11px] font-semibold text-body transition hover:border-primary hover:text-primary disabled:opacity-40"
                  >
                    {busy === item.id ? "..." : "켜기"}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}
