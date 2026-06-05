import { memo } from "react";
import type { Item } from "../types";
import { RARITY_CONFIG } from "../types";
import { summarize, computeLevel, iconFor } from "../lib/utils";
import { useStore } from "../hooks/useStore";

interface CardProps {
  item: Item;
}

export const Card = memo(function Card({ item }: CardProps) {
  const { selected, setSelected, favorites, toggleFavorite, picked, togglePick, lang } = useStore();
  const r = RARITY_CONFIG[item.rarity];
  const lvl = computeLevel(item.stats?.power ?? 50);
  const isSelected = selected === item.id;
  const isFav = favorites.has(item.id);
  const isPicked = picked.has(item.id);
  const name = lang === "ko" && item.nameKo ? item.nameKo : item.displayName;
  const desc = lang === "ko" && item.descKo ? item.descKo : item.description;
  const cat = iconFor(item);

  const maxExp = lvl >= 7 ? 50 : lvl === 6 ? 40 : lvl === 5 ? 30 : lvl === 4 ? 25 : lvl === 3 ? 20 : lvl === 2 ? 15 : 10;
  const curExp = Math.max(1, Math.min(maxExp - 1, Math.round(((item.stats?.popularity ?? 40) / 100) * maxExp)));

  return (
    <div
      onClick={() => setSelected(isSelected ? null : item.id)}
      className={`group relative cursor-pointer rounded-xl border p-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${
        isSelected
          ? "border-amber-500/60 bg-amber-500/5 shadow-amber-500/10"
          : "border-zinc-800 bg-zinc-900/60 hover:border-zinc-600"
      } ${item.equipped ? "ring-1 ring-emerald-500/30" : ""}`}
    >
      {/* Rarity accent */}
      <div
        className="absolute inset-x-0 top-0 h-0.5 rounded-t-xl"
        style={{ backgroundColor: r.color }}
      />

      {/* Checkbox for batch ops */}
      <input
        type="checkbox"
        checked={isPicked}
        onChange={(e) => {
          e.stopPropagation();
          togglePick(item.id);
        }}
        onClick={(e) => e.stopPropagation()}
        className="absolute left-2 top-2 z-10 h-3.5 w-3.5 cursor-pointer accent-amber-500 opacity-0 transition group-hover:opacity-100"
        style={isPicked ? { opacity: 1 } : undefined}
        title="일괄 이미지 생성에 포함"
      />

      {/* Group badge */}
      {item.group && (
        <div className="absolute right-2 top-2 z-10 rounded bg-violet-500/20 px-1.5 py-0.5 text-[9px] font-bold text-violet-400">
          복수
        </div>
      )}

      {/* Top row */}
      <div className="mb-2 flex items-start justify-between">
        <span
          className="rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wider"
          style={{ color: r.color, backgroundColor: `${r.color}15` }}
        >
          {r.ko}
        </span>
        <div className="flex items-center gap-1.5">
          {item.equipped && (
            <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
              장착
            </span>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleFavorite(item.id);
            }}
            className={`text-sm transition ${
              isFav ? "text-amber-400" : "text-zinc-600 hover:text-zinc-400"
            }`}
            aria-label="즐겨찾기"
          >
            ★
          </button>
        </div>
      </div>

      {/* Image area */}
      {item.image ? (
        <div className="mb-2 aspect-[4/3] overflow-hidden rounded-lg bg-zinc-800">
          <img
            src={item.image}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </div>
      ) : (
        <div className="mb-2 flex aspect-[4/3] items-center justify-center rounded-lg bg-zinc-800/50">
          <span className="text-2xl text-zinc-600">{cat === "agent" ? "🤖" : cat === "module" ? "🔌" : "⚡"}</span>
        </div>
      )}

      {/* Name + kind */}
      <h3 className="mb-0.5 truncate text-sm font-semibold text-white">{name}</h3>
      <div className="mb-1.5 flex items-center gap-1.5">
        <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] uppercase text-zinc-400">
          {item.kind}
        </span>
        <span className="text-[10px] text-zinc-500">Lv.{lvl}</span>
        <span className="ml-auto text-[10px] font-mono text-zinc-500">
          {item.score}pt
        </span>
      </div>

      {/* Description */}
      <p className="line-clamp-2 text-xs leading-relaxed text-zinc-400">
        {summarize(desc)}
      </p>

      {/* Level progress bar */}
      <div className="mt-2 flex items-center gap-1.5">
        <span className="text-[10px] font-bold text-zinc-400">LV.{lvl}</span>
        <div className="h-1.5 flex-1 rounded-full bg-zinc-800">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${(curExp / maxExp) * 100}%`,
              backgroundColor: r.color,
            }}
          />
        </div>
        <span className="text-[9px] font-mono text-zinc-600">
          {curExp}/{maxExp}
        </span>
      </div>
    </div>
  );
});
