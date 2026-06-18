import { memo, useState } from "react";
import type { Item } from "../types";
import { RARITY_CONFIG, isEquippable } from "../types";
import { summarize, computeLevel, computeXp, iconFor } from "../lib/utils";
import { traitsOf } from "../lib/traits";
import { useStore } from "../hooks/useStore";
import { api } from "../lib/api";
import { Icon } from "./Icon";

interface CardProps {
  item: Item;
  index?: number;
  needKeys?: Set<string>;
}

export const Card = memo(function Card({ item, index = 0, needKeys }: CardProps) {
  const { selected, setSelected, favorites, toggleFavorite, picked, togglePick, lang, reloadData } = useStore();
  const [busy, setBusy] = useState(false);
  const r = RARITY_CONFIG[item.rarity];
  const lvl = computeLevel(item.stats?.power ?? 50, item.uses);
  const xp = computeXp(item.uses);
  const gaugePct = xp ?? Math.min(99, item.stats?.popularity ?? 40);
  const isSelected = selected === item.id;
  const isFav = favorites.has(item.id);
  const isPicked = picked.has(item.id);
  const name =
    item.kind === "memory"
      ? typeof item.source.repo === "string"
        ? item.source.repo
        : ""
      : item.displayName;
  const desc = lang === "ko" && item.descKo ? item.descKo : item.description;
  const cat = iconFor(item);
  const traits = traitsOf(item);
  const wouldLink = needKeys && !item.equipped && traits.some((t) => needKeys.has(t.key));
  const equippable = isEquippable(item.kind);

  const toggleEquip = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (busy || item.installed || !equippable) return;
    setBusy(true);
    try {
      if (item.equipped) await api.unequip(item.id);
      else await api.equip(item.id);
      await reloadData();
    } catch {}
    setBusy(false);
  };

  const isS = item.rarity === "legendary";

  return (
    <div
      onClick={() => setSelected(isSelected ? null : item.id)}
      className={`reveal group relative cursor-pointer rounded-xl border bg-surface-card p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm ${
        isSelected
          ? "border-primary ring-2 ring-primary/10"
          : isS
            ? "border-accent-orange/40"
            : "border-hairline hover:border-hairline-strong"
      } ${item.equipped ? "ring-1 ring-accent-emerald/30" : ""}`}
      style={{
        animationDelay: `${Math.min(index, 24) * 18}ms`,
        ...(isS ? { boxShadow: "0 0 0 1px rgba(245,158,11,0.15), 0 8px 24px rgba(245,158,11,0.08)" } : {}),
      }}
    >
      {/* 일괄 선택 체크 */}
      <input
        type="checkbox"
        checked={isPicked}
        onChange={(e) => { e.stopPropagation(); togglePick(item.id); }}
        onClick={(e) => e.stopPropagation()}
        className="absolute left-3 top-3 z-10 h-4 w-4 cursor-pointer rounded accent-primary opacity-0 transition group-hover:opacity-100"
        style={isPicked ? { opacity: 1 } : undefined}
        title="일괄 작업에 포함"
      />

      {/* 상단: 등급 배지 + 즐겨찾기 */}
      <div className="mb-3 flex items-center justify-between">
        <span
          className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
          style={{ backgroundColor: r.color }}
        >
          {r.ko}
        </span>
        <div className="flex items-center gap-1.5">
          {wouldLink && (
            <span className="rounded-full bg-accent-orange-soft px-2 py-0.5 text-[10px] font-semibold text-accent-orange" title="장착하면 신호 링크 발동">
              링크+
            </span>
          )}
          {item.group && (
            <span className="rounded-full bg-surface-soft px-2 py-0.5 text-[10px] font-medium text-muted">
              복수
            </span>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); toggleFavorite(item.id); }}
            className={`transition ${isFav ? "text-accent-orange" : "text-hairline-strong hover:text-muted"}`}
            aria-label="즐겨찾기"
          >
            <Icon name="favorite-star" size="sm" />
          </button>
        </div>
      </div>

      {/* 아트 영역 */}
      {item.image ? (
        <div className="mb-3 aspect-[4/3] overflow-hidden rounded-lg">
          <img src={item.image} alt="" className="h-full w-full object-cover" loading="lazy" />
        </div>
      ) : (
        <div className="relative mb-3 flex aspect-[4/3] items-center justify-center rounded-lg" style={{ backgroundColor: r.bg }}>
          <Icon
            name={cat === "agent" ? "agent-badge" : cat === "module" ? "wrench" : "bolt-logo"}
            size="xl"
            className="opacity-50"
          />
        </div>
      )}

      {/* 이름 */}
      <h3 className="mb-0.5 truncate text-[15px] font-semibold text-ink">{name}</h3>

      {/* 타입 + 점수 */}
      <div className="mb-2 flex items-center gap-2">
        <span className="rounded-md bg-surface-soft px-1.5 py-0.5 text-[10px] font-medium uppercase text-muted">
          {item.kind === "memory" ? "기억" : item.kind}
        </span>
        {item.kind === "memory" ? (
          <span className="text-[10px] text-primary truncate max-w-[120px] font-medium" title={`${typeof item.source.repo === "string" ? item.source.repo : ""}/${item.source.path}`}>
            {typeof item.source.repo === "string" ? item.source.repo : ""}/{item.source.path}
          </span>
        ) : (
          traits.slice(0, 2).map((t) => (
            <span key={t.key} className="text-[10px] text-muted-soft">
              {t.label}
            </span>
          ))
        )}
        <span className="ml-auto font-mono text-xs font-semibold text-ink">{item.score}pt</span>
      </div>

      {/* 설명 */}
      <p className="line-clamp-2 text-xs leading-relaxed text-muted">{summarize(desc)}</p>

      {/* 레벨 게이지 */}
      <div className="mt-3 flex items-center gap-2">
        <span className="font-mono text-[11px] font-bold text-body">Lv.{lvl}</span>
        <div className="h-1.5 flex-1 rounded-full bg-surface-soft">
          <div
            className="h-full rounded-full stat-bar-fill"
            style={{ width: `${gaugePct}%`, backgroundColor: r.color }}
          />
        </div>
        <span className="font-mono text-[10px] text-muted-soft">
          {item.uses && item.uses > 0 ? `${item.uses}회` : `${item.score}/100`}
        </span>
      </div>

      {/* 장착 상태 + 빠른 장착 */}
      <div className="mt-3 flex items-center gap-2">
        {!equippable ? (
          <span className="flex-1 rounded-lg bg-surface-soft px-2 py-1.5 text-center text-[11px] text-muted">
            읽기 전용
          </span>
        ) : item.installed ? (
          <span className="flex-1 rounded-lg bg-surface-soft px-2 py-1.5 text-center text-[11px] font-medium text-accent-orange">
            상주
          </span>
        ) : item.equipped ? (
          <button
            onClick={toggleEquip}
            disabled={busy}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-surface-success px-2 py-1.5 text-[11px] font-semibold text-accent-emerald transition hover:bg-accent-emerald hover:text-white"
          >
            <Icon name="check-circle" size="xs" />
            {busy ? "..." : "장착 중"}
          </button>
        ) : (
          <button
            onClick={toggleEquip}
            disabled={busy}
            className="flex-1 rounded-lg border border-hairline px-2 py-1.5 text-[11px] font-semibold text-body opacity-0 transition hover:border-primary hover:text-primary group-hover:opacity-100"
          >
            {busy ? "..." : "장착"}
          </button>
        )}
      </div>
    </div>
  );
});
