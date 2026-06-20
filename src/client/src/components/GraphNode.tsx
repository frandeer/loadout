import { memo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import type { Item } from "../types";
import { RARITY_CONFIG, KIND_LABELS } from "../types";
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

/** 그래프 노드 — 컴팩트 카드. 등급색 좌측 보더/링, kind 아이콘, 이름, 상태 점, 점수. */
function GraphNodeImpl({ data, selected }: NodeProps<AssetNode>) {
  const item = data.item;
  const r = RARITY_CONFIG[item.rarity];
  const dot = stateDot(item);
  const name = item.kind === "memory"
    ? (typeof item.source.repo === "string" ? item.source.repo : item.name)
    : item.displayName || item.name;
  // JS slice 제거 — CSS truncate가 w-[150px] 안에서 레이아웃 정확하게 잘라줌(이중 절단 방지).
  const ariaLabel = `${name} · ${KIND_LABELS[item.kind]} · ${r.ko} · ${dot.label} · ${item.score}점`;

  return (
    <div
      role="button"
      tabIndex={0}
      title={`${name} · ${KIND_LABELS[item.kind]} · ${r.ko} · ${dot.label} · ${item.score}pt`}
      aria-label={ariaLabel}
      aria-pressed={selected}
      className={`flex w-[150px] items-center gap-2 rounded-lg border bg-canvas px-2.5 py-2 shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
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
          <span className="truncate text-[11px] font-bold leading-tight text-ink">{name}</span>
          <span
            className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: dot.color }}
            aria-label={dot.label}
          />
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[9px] uppercase tracking-wide text-muted-soft">{KIND_LABELS[item.kind]}</span>
          <span className="ml-auto font-mono text-[10px] font-semibold text-body">{item.score}</span>
        </div>
      </div>
    </div>
  );
}

export const GraphNode = memo(GraphNodeImpl);
