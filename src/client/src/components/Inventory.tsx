import { useState } from "react";
import { useStore } from "../hooks/useStore";
import { RARITY_CONFIG } from "../types";
import type { Item, Kind } from "../types";
import { api } from "../lib/api";
import { teamCost } from "../lib/traits";
import { ManaGauge } from "./ManaGauge";
import { CardDrop } from "./CardDrop";

const KIND_LABEL: Record<Kind, { label: string; note: string }> = {
  skill: { label: "스킬", note: "~/.claude/skills 정션" },
  agent: { label: "요원", note: "~/.claude/agents 복사" },
  mcp: { label: "장비", note: "기록만 — 수동 설정 권장" },
  memory: { label: "기억", note: "읽기 전용 — 장착 없음" },
};

/* 인벤토리 — 현재 ~/.claude에 투입된 자산의 단일 진실 화면.
   여기서 바로 1클릭 해제(철수)할 수 있다. */
export function Inventory() {
  const { items, lang, reloadData, setSelected } = useStore();
  const [busy, setBusy] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const equipped = items.filter((i) => i.equipped);
  const totalCost = teamCost(equipped);
  const displayName = (i: Item) => (lang === "ko" && i.nameKo ? i.nameKo : i.displayName);

  const withdraw = async (id: string) => {
    setBusy(id);
    try {
      await api.unequip(id);
      await reloadData();
    } catch {}
    setBusy(null);
  };

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
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-signal-dim">
            black-orchid / 인벤토리
          </div>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-ink">투입 자산 현황</h2>
          <p className="mt-1 text-sm text-ink-dim">
            지금 <span className="font-mono text-signal">~/.claude</span> 에 장착되어 Claude Code에서 활성인 자산입니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CardDrop />
          <button
            onClick={syncUsage}
            disabled={syncing}
            className="border border-line bg-panel2 px-4 py-2 font-mono text-xs text-ink-dim transition hover:text-ink disabled:opacity-50"
            title="세션 로그를 다시 스캔해 사용량(경험치)을 갱신합니다"
          >
            {syncing ? "동기화 중..." : "사용량 동기화"}
          </button>
        </div>
      </div>

      {equipped.length > 0 && (
        <div className="hud-frame mb-5 border border-line bg-panel px-4 py-3" style={{ "--hud-c": "var(--color-gold)" } as React.CSSProperties}>
          <ManaGauge cost={totalCost} label="장착 컨텍스트 부하" />
        </div>
      )}

      {equipped.length === 0 ? (
        <div className="hud-frame flex h-40 items-center justify-center border border-line bg-panel font-mono text-sm text-ink-faint">
          투입된 자산 없음 — 덱에서 자산을 선택해 작전 투입하세요
        </div>
      ) : (
        <div className="space-y-6">
          {(["skill", "agent", "mcp"] as const).map((kind) => {
            const list = equipped.filter((i) => i.kind === kind);
            if (!list.length) return null;
            const k = KIND_LABEL[kind];
            return (
              <section key={kind}>
                <div className="mb-2 flex items-baseline gap-3">
                  <h3 className="text-sm font-bold text-ink">{k.label}</h3>
                  <span className="font-mono text-[11px] text-signal">{list.length}</span>
                  <span className="font-mono text-[10px] text-ink-faint">{k.note}</span>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  {list.map((item) => {
                    const r = RARITY_CONFIG[item.rarity];
                    return (
                      <div
                        key={item.id}
                        className="hud-frame flex items-center gap-3 border border-line bg-panel px-3 py-2.5"
                        style={{ "--hud-c": `${r.color}55` } as React.CSSProperties}
                      >
                        <span className="blink h-1.5 w-1.5 shrink-0 rounded-full bg-signal" />
                        <button onClick={() => setSelected(item.id)} className="min-w-0 flex-1 text-left">
                          <div className="truncate text-sm font-semibold text-ink hover:text-signal">
                            {displayName(item)}
                          </div>
                          <div className="flex items-center gap-2 font-mono text-[10px] text-ink-faint">
                            <span style={{ color: r.color }}>{r.ko}</span>
                            <span>{item.score}pt</span>
                            <span className="truncate">{item.source.owner}/{item.source.repo}</span>
                          </div>
                        </button>
                        <button
                          onClick={() => withdraw(item.id)}
                          disabled={busy === item.id}
                          className="border border-line bg-panel2 px-3 py-1.5 font-mono text-[11px] text-ink-dim transition hover:border-danger hover:text-danger disabled:opacity-40"
                        >
                          {busy === item.id ? "..." : "철수"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
