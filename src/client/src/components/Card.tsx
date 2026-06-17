import { memo, useState } from "react";
import type { Item } from "../types";
import { RARITY_CONFIG, isEquippable } from "../types";
import { summarize, computeLevel, computeXp, formatK, iconFor } from "../lib/utils";
import { traitsOf } from "../lib/traits";
import { useStore } from "../hooks/useStore";
import { api } from "../lib/api";

interface CardProps {
  item: Item;
  index?: number;          // 등장 스태거 지연용
  needKeys?: Set<string>;  // 현재 팀 기준 "1개 더면 링크 발동" 특성 — 추천 뱃지
}

export const Card = memo(function Card({ item, index = 0, needKeys }: CardProps) {
  const { selected, setSelected, favorites, toggleFavorite, picked, togglePick, lang, reloadData } = useStore();
  const [busy, setBusy] = useState(false);
  const r = RARITY_CONFIG[item.rarity];
  const lvl = computeLevel(item.stats?.power ?? 50, item.uses);
  const xp = computeXp(item.uses);
  const gaugePct = xp ?? Math.min(99, item.stats?.popularity ?? 40);
  const risks = item.risks ?? [];
  const isSelected = selected === item.id;
  const isFav = favorites.has(item.id);
  const isPicked = picked.has(item.id);
  const name = lang === "ko" && item.nameKo ? item.nameKo : item.displayName;
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

  return (
    <div
      onClick={() => setSelected(isSelected ? null : item.id)}
      className={`hud-frame reveal group relative cursor-pointer border bg-panel p-3 transition-all duration-200 hover:-translate-y-0.5 ${
        isSelected ? "border-signal-dim bg-panel2" : "border-line hover:border-ink-faint"
      } ${item.equipped ? "shadow-[inset_0_0_24px_rgba(61,245,165,0.05)]" : ""}`}
      style={{
        "--hud-c": isSelected || item.equipped ? r.color : undefined,
        animationDelay: `${Math.min(index, 24) * 22}ms`,
      } as React.CSSProperties}
    >
      {/* 등급 컬러 스트립 (3px) — 모든 카드 일관 */}
      <div
        data-testid="rarity-strip"
        className="absolute inset-x-0 top-0 h-[3px]"
        style={{ backgroundColor: r.color, boxShadow: `0 0 6px ${r.color}66` }}
      />

      {/* 일괄 선택 체크 */}
      <input
        type="checkbox"
        checked={isPicked}
        onChange={(e) => { e.stopPropagation(); togglePick(item.id); }}
        onClick={(e) => e.stopPropagation()}
        className="absolute left-2 top-2 z-10 h-3.5 w-3.5 cursor-pointer accent-[#3df5a5] opacity-0 transition group-hover:opacity-100"
        style={isPicked ? { opacity: 1 } : undefined}
        title="일괄 작업에 포함"
      />

      {/* 우상단 배지: 링크 추천 / 위험 / 복수 */}
      <div className="absolute right-2 top-2 z-10 flex gap-1">
        {risks.length > 0 && (
          <div
            className="border border-danger/50 bg-danger/10 px-1.5 py-0.5 font-mono text-[9px] text-danger"
            title={`위험 신호: ${risks.join(", ")}`}
          >
            ⚠
          </div>
        )}
        {wouldLink && (
          <div className="border border-gold/50 bg-gold/10 px-1.5 py-0.5 font-mono text-[9px] text-gold" title="장착하면 신호 링크가 발동합니다">
            링크+
          </div>
        )}
        {item.group && (
          <div className="border border-line bg-panel2 px-1.5 py-0.5 font-mono text-[9px] text-ink-dim">
            복수
          </div>
        )}
      </div>

      {/* CLASS 행 */}
      <div className="mb-2 mt-3 flex items-start justify-between">
        <span className="font-mono text-[10px] font-semibold tracking-[0.15em]" style={{ color: r.color }}>
          {r.ko}
        </span>
        <div className="flex items-center gap-1.5">
          {!equippable ? (
            <span className="font-mono text-[9px] text-ink-faint" title="기억은 장착 개념이 없는 읽기 전용 자산">
              읽기 전용
            </span>
          ) : item.installed ? (
            <span className="font-mono text-[9px] text-gold" title="~/.claude 에 이미 설치된 상주 자산">
              상주
            </span>
          ) : item.equipped ? (
            <button
              onClick={toggleEquip}
              disabled={busy}
              className="flex items-center gap-1 font-mono text-[9px] text-signal transition hover:text-danger"
              title="클릭해 장착 해제"
            >
              <span className="blink inline-block h-1 w-1 rounded-full bg-signal group-hover:hidden" />
              <span className="group-hover:hidden">투입중</span>
              <span className="hidden border border-danger/40 px-1 py-px text-danger group-hover:inline">
                {busy ? "..." : "해제"}
              </span>
            </button>
          ) : (
            <button
              onClick={toggleEquip}
              disabled={busy}
              className="hidden border border-signal-dim/50 px-1 py-px font-mono text-[9px] text-signal transition hover:bg-signal/10 group-hover:inline"
              title="~/.claude 에 장착"
            >
              {busy ? "..." : "투입"}
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); toggleFavorite(item.id); }}
            className={`text-sm transition ${isFav ? "text-gold" : "text-ink-faint hover:text-ink-dim"}`}
            aria-label="즐겨찾기"
          >
            ★
          </button>
        </div>
      </div>

      {/* 아트 영역 */}
      {item.image ? (
        <div className="mb-2 aspect-[4/3] overflow-hidden border border-line bg-panel2">
          <img src={item.image} alt="" className="h-full w-full object-cover" loading="lazy" />
        </div>
      ) : (
        <div className="relative mb-2 flex aspect-[4/3] items-center justify-center border border-line bg-panel2/60">
          <div
            className="absolute inset-0 opacity-40"
            style={{ backgroundImage: "radial-gradient(rgba(61,245,165,0.14) 1px, transparent 1px)", backgroundSize: "12px 12px" }}
          />
          <span className="hud-frame relative px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-dim" style={{ "--hud-c": `${r.color}66` } as React.CSSProperties}>
            {cat}
          </span>
        </div>
      )}

      {/* 이름 + 종류 */}
      <h3 className="mb-0.5 truncate text-sm font-semibold text-ink">{name}</h3>
      <div className="mb-1.5 flex items-center gap-1.5">
        <span className="border border-line px-1 py-px font-mono text-[9px] uppercase text-ink-dim">
          {item.kind === "memory" ? "기억" : item.kind}
        </span>
        {traits.slice(0, 3).map((t) => {
          // 현재 편성에 이 카드를 넣으면 발동 임박(1개 모자람)인 특성 강조 — 오토체스 상점 패턴
          const near = !item.equipped && needKeys?.has(t.key);
          return (
            <span
              key={t.key}
              data-testid="trait-chip"
              className={`font-mono text-[9px] ${near ? "font-semibold text-gold" : "text-signal-dim"}`}
              title={near ? "편성에 넣으면 신호 링크 발동 임박" : `연결 시너지 ${t.label} +1`}
            >
              {t.label}<span className="opacity-60"> +1</span>
            </span>
          );
        })}
        <span className="ml-auto font-mono text-[10px] text-ink-faint">{item.score}pt</span>
      </div>

      {/* 설명 */}
      <p className="line-clamp-2 text-xs leading-relaxed text-ink-dim">{summarize(desc)}</p>

      {/* 레벨 게이지 (XP 진행도) */}
      <div className="mt-2 flex items-center gap-1.5">
        <span className="font-mono text-[10px] font-semibold text-ink-dim">LV.{lvl}</span>
        <div className="h-1 flex-1 bg-panel3">
          <div
            className="h-full transition-all"
            style={{ width: `${gaugePct}%`, backgroundColor: r.color, boxShadow: `0 0 6px ${r.color}55` }}
          />
        </div>
        {item.uses && item.uses > 0 ? (
          <span className="font-mono text-[9px] text-signal-dim">{item.uses}회</span>
        ) : (
          <span className="font-mono text-[9px] text-ink-faint">{item.score}/100</span>
        )}
      </div>

      {/* 코스트 보석 — cardart 템플릿과 시각 일치(회전 다이아 + 등급색 테두리). cost 없으면 미표시 */}
      {item.cost ? (
        <div className="absolute bottom-2 right-2" title="컨텍스트 토큰 비용(마나)">
          <div
            data-testid="cost-gem"
            className="grid h-7 w-7 rotate-45 place-items-center rounded-[5px] font-mono text-[8px] font-black text-void"
            style={{
              background: `linear-gradient(150deg, ${r.color}, ${r.color}88)`,
              boxShadow: `0 0 8px ${r.color}55, inset 0 0 0 1.5px #05080799`,
            }}
          >
            <span className="block -rotate-45">{formatK(item.cost)}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
});
