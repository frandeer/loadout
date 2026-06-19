import { memo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import type { Item } from "../types";
import { RARITY_CONFIG } from "../types";
import { iconFor } from "../lib/utils";
import { Icon } from "./Icon";

export type AssetNode = Node<{ item: Item }, "asset">;

/** kind → 아이콘 글리프(카드와 톤 동기). */
function nodeIcon(item: Item): string {
  if (item.kind === "memory") return "memory-card";
  const cat = iconFor(item);
  return cat === "agent" ? "agent-badge" : cat === "module" ? "wrench" : "bolt-logo";
}

/** ~/.claude 상태 → 점 색(장착=emerald / 상주=amber / 보관·absent=muted).
 *  상주는 claudeState==="resident"로만 판정 — installed(소스가 ~/.claude 하위)는
 *  카탈로그 대부분이 해당돼 의미가 없고, Inventory "상주" 섹션과도 어긋난다(범례와 동기). */
function stateDot(item: Item): { color: string; label: string } {
  if (item.equipped) return { color: "var(--color-accent-emerald)", label: "장착" };
  if (item.claudeState === "resident")
    return { color: "var(--color-accent-orange)", label: "상주" };
  return { color: "var(--color-muted-soft)", label: "보관" };
}

const KIND_KO: Record<Item["kind"], string> = {
  skill: "스킬",
  agent: "요원",
  mcp: "장비",
  memory: "기억",
};

/** 그래프 노드 — 컴팩트 카드. 등급색 좌측 보더/링, kind 아이콘, 이름, 상태 점, 점수. */
function GraphNodeImpl({ data, selected }: NodeProps<AssetNode>) {
  const item = data.item;
  const r = RARITY_CONFIG[item.rarity];
  const dot = stateDot(item);
  const name = item.kind === "memory"
    ? (typeof item.source.repo === "string" ? item.source.repo : item.name)
    : item.displayName || item.name;
  const short = name.length > 18 ? name.slice(0, 18) + "…" : name;

  return (
    <div
      title={`${name} · ${KIND_KO[item.kind]} · ${r.ko} · ${dot.label} · ${item.score}pt`}
      className={`flex w-[150px] items-center gap-2 rounded-lg border bg-canvas px-2.5 py-2 shadow-sm transition ${
        selected ? "ring-2 ring-primary" : "border-hairline"
      }`}
      style={{
        borderLeftWidth: 4,
        borderLeftColor: r.color,
        ...(selected ? {} : { boxShadow: `0 0 0 1px ${r.bg}` }),
      }}
    >
      {/* 엣지 부착용 핸들 — 투명/숨김. source+target 둘 다 둬야 양방향 엣지가 붙는다. */}
      <Handle type="target" position={Position.Left} className="!h-1 !w-1 !border-0 !bg-transparent !opacity-0" />
      <Handle type="source" position={Position.Right} className="!h-1 !w-1 !border-0 !bg-transparent !opacity-0" />

      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
        style={{ backgroundColor: r.bg, color: r.color }}
      >
        <Icon name={nodeIcon(item)} size="sm" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <span className="truncate text-[11px] font-bold leading-tight text-ink">{short}</span>
          <span
            className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: dot.color }}
            aria-label={dot.label}
          />
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[9px] uppercase tracking-wide text-muted-soft">{KIND_KO[item.kind]}</span>
          <span className="ml-auto font-mono text-[10px] font-semibold text-body">{item.score}</span>
        </div>
      </div>
    </div>
  );
}

export const GraphNode = memo(GraphNodeImpl);
