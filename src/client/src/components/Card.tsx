import { memo, useState } from "react";
import type { Item } from "../types";
import { RARITY_CONFIG, isEquippable, KIND_LABELS } from "../types";
import { summarize, computeLevel, computeXp, iconFor, pickDesc, rarityFrame } from "../lib/utils";
import { traitsOf } from "../lib/traits";
import { useStore } from "../hooks/useStore";
import { api } from "../lib/api";
import { Icon } from "./Icon";

interface CardProps {
  item: Item;
  index?: number;
}

export const Card = memo(function Card({ item, index = 0 }: CardProps) {
  // 카드별 fine-grained 구독 — 전역 store를 통째로 구독하면 memo가 무력화되어,
  // 카드 하나를 선택/즐겨찾기/체크할 때 보이는 카드 전부가 리렌더된다. 자기 항목 슬라이스만 구독.
  const setSelected = useStore((s) => s.setSelected);
  const toggleFavorite = useStore((s) => s.toggleFavorite);
  const togglePick = useStore((s) => s.togglePick);
  const reloadData = useStore((s) => s.reloadData);
  const lang = useStore((s) => s.lang);
  const isSelected = useStore((s) => s.selected === item.id);
  const isFav = useStore((s) => s.favorites.has(item.id));
  const isPicked = useStore((s) => s.picked.has(item.id));
  const [busy, setBusy] = useState(false);
  const r = RARITY_CONFIG[item.rarity];
  // 실제 사용 기록(uses>0)이 있을 때만 LV/XP를 노출 — 없으면 파일 크기를 레벨로 둔갑시키지 않고
  // 구조 기반 점수(score)를 대신 보여준다.
  const lvl = computeLevel(item.uses);
  const xp = computeXp(item.uses);
  const hasLevel = lvl !== null && xp !== null;
  const gaugePct = xp ?? 0;
  const name =
    item.kind === "memory"
      ? typeof item.source.repo === "string"
        ? item.source.repo
        : ""
      : item.displayName;
  const desc = pickDesc(item, lang);
  const cat = iconFor(item);
  const traits = traitsOf(item);
  const equippable = isEquippable(item.kind);

  // vault 토글 가능 = 관리 자산이거나 ~/.claude 상주(끄면 vault로 lazy 이동).
  const vaultToggleable = item.managed || item.claudeState === "resident";
  // 상주로 잡히지만 토글 불가(cc-config 등 레거시) → 읽기 전용 "고정" 상태.
  // installed 자체는 카탈로그 대부분이 ~/.claude 하위라 "상주"로 라벨하지 않는다(정직 모델).
  const lockedInstalled = !!item.installed && !vaultToggleable;

  const toggleEquip = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (busy || !equippable) return;
    if (lockedInstalled) return; // 고정(토글 불가)은 막고, vault 토글 가능 상주는 허용
    if (item.oversized && item.equipped && !window.confirm(`${item.displayName}는 거대 자산입니다. 끄면 vault로 이동(보관)됩니다. 진행할까요?`)) return;
    setBusy(true);
    try {
      // vault 관리/상주 자산은 on/off 토글로 장착/해제한다.
      if (vaultToggleable) await api.activateVault(item.id, !item.equipped);
      else if (item.equipped) await api.unequip(item.id);
      else await api.equip(item.id);
      await reloadData();
    } catch {}
    setBusy(false);
  };

  // 레어도 프레임 — 등급↑일수록 테두리/글로우↑(루터슈터 느낌). 평소엔 등급색 테두리를
  // 항상 유지하고, 선택 시엔 그 테두리를 따라 빛이 도는 .card-beam 애니메이션을 얹는다.
  // 장착 상태는 테두리에 섞지 않는다(녹색 링 제거) — 하단 "장착 중" 버튼이 담당.
  const frame: { borderColor?: string; boxShadow?: string } = rarityFrame(item.rarity, r.color);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => setSelected(isSelected ? null : item.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setSelected(isSelected ? null : item.id);
        }
      }}
      aria-label={`${name} — ${KIND_LABELS[item.kind]} 카드 열기`}
      aria-pressed={isSelected}
      className={`reveal group relative cursor-pointer overflow-hidden rounded-xl border bg-surface-card p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm ${
        isSelected ? "card-beam" : ""
      } ${frame.borderColor ? "" : "border-hairline hover:border-hairline-strong"}`}
      style={{
        animationDelay: `${Math.min(index, 24) * 18}ms`,
        ...frame,
        ["--beam-color" as string]: r.color,
      } as React.CSSProperties}
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

      {/* 아트 영역 — memory는 개별 AI 아트 대신 공통 분류 글리프(텍스트 우선). 큰 히어로
          박스를 쓰지 않아 이름·설명이 카드를 주도하고, "이건 장착 자산이 아니라 기억"임을
          한눈에 분류한다. */}
      {item.kind === "memory" ? (
        <div className="mb-3 flex items-center justify-between rounded-lg border border-hairline bg-surface-soft px-3 py-2">
          <div className="flex items-center gap-2 overflow-hidden">
            <Icon name="memory-card" size="sm" className="text-muted shrink-0" />
            <span className="text-[10px] font-bold uppercase tracking-wide text-muted-soft shrink-0">Memory</span>
            <span
              className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wide truncate"
              style={{ color: r.color }}
              title={`${r.ko} 등급 — 이번 스캔 상위 백분위 기준, 절대 품질 아님`}
            >
              <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
              {r.ko}
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
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
      ) : (
        <div className="relative -mx-4 -mt-4 mb-3 aspect-[4/3] overflow-hidden">
          {item.image ? (
            <img src={item.image} alt="" className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <div className="flex h-full w-full items-center justify-center" style={{ backgroundColor: r.bg }}>
              <Icon
                name={cat === "agent" ? "agent-badge" : cat === "module" ? "wrench" : "bolt-logo"}
                size="xl"
                className="opacity-50"
              />
            </div>
          )}

          {/* 우상단 오버레이: 배지 및 즐겨찾기 */}
          <div className="absolute right-2 top-2 z-10 flex items-center gap-1.5">
            {item.group && (
              <span className="rounded-full bg-surface-soft px-2 py-0.5 text-[10px] font-medium text-muted">
                복수
              </span>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); toggleFavorite(item.id); }}
              className={`p-1 transition-colors duration-200 ${
                isFav
                  ? "text-accent-orange"
                  : "text-hairline-strong hover:text-muted"
              }`}
              aria-label="즐겨찾기"
            >
              <Icon name="favorite-star" size="sm" className={isFav ? "fill-current" : ""} />
            </button>
          </div>
        </div>
      )}

      {/* 이름 — 카드의 주인공. 살짝 키워 더 또렷하게. 등급은 카드 테두리 색으로 표현. */}
      <h3 className="mb-0.5 truncate text-[19px] font-bold leading-tight tracking-tight text-ink" title={`${r.ko} 등급 — 이번 스캔 상위 백분위 기준, 절대 품질 아님`}>{name}</h3>

      {/* 타입 + 점수 */}
      <div className="mb-2 flex items-center gap-2">
        <span className="shrink-0 whitespace-nowrap rounded-md bg-surface-soft px-1.5 py-0.5 text-[10px] font-medium uppercase text-muted">
          {KIND_LABELS[item.kind]}
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

      {/* MCP 실제 신호 — 조작된 스탯 대신 구조적 사실(인자/env/위험)을 노출 */}
      {item.kind === "mcp" && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="rounded-full bg-surface-soft px-1.5 py-0.5 font-mono text-[10px] text-muted" title="명령 인자 개수">
            인자 {item.meta?.args?.length ?? 0}
          </span>
          <span className="rounded-full bg-surface-soft px-1.5 py-0.5 font-mono text-[10px] text-muted" title="환경변수 키 개수">
            env {item.meta?.env?.length ?? 0}
          </span>
          {(item.risks?.length ?? 0) > 0 && (
            <span className="rounded-full bg-accent-rose/10 px-1.5 py-0.5 font-mono text-[10px] text-accent-rose" title="위험 신호">
              위험 {item.risks!.length}
            </span>
          )}
        </div>
      )}

      {/* 레벨 게이지 — 실제 사용 기록(uses>0)이 있을 때만. 없으면 점수 라인으로 대체. */}
      {hasLevel ? (
        <div className="mt-3 flex items-center gap-2">
          <span className="font-mono text-[11px] font-bold text-body">Lv.{lvl}</span>
          <div className="h-1.5 flex-1 rounded-full bg-surface-soft">
            <div
              className="h-full rounded-full stat-bar-fill"
              style={{ width: `${gaugePct}%`, backgroundColor: r.color }}
            />
          </div>
          <span className="font-mono text-[10px] text-muted-soft">{item.uses}회</span>
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-2" title="실사용 기록이 없어 구조 기반 점수로 표시">
          <span className="font-mono text-[10px] font-medium text-muted-soft">구조 점수</span>
          <div className="h-1.5 flex-1 rounded-full bg-surface-soft">
            <div
              className="h-full rounded-full stat-bar-fill"
              style={{ width: `${Math.min(item.score, 100)}%`, backgroundColor: r.color }}
            />
          </div>
          <span className="font-mono text-[10px] text-muted-soft">{item.score}/100</span>
        </div>
      )}

      {/* 장착 상태 + 빠른 장착 */}
      <div className="mt-3 flex items-center gap-2">
        {!equippable ? (
          <span className="flex-1 rounded-lg bg-surface-soft px-2 py-1.5 text-center text-[11px] text-muted">
            읽기 전용
          </span>
        ) : lockedInstalled ? (
          <span
            className="flex-1 rounded-lg bg-surface-soft px-2 py-1.5 text-center text-[11px] font-medium text-muted"
            title="이미 ~/.claude 에 설치돼 있어 토글할 수 없습니다(읽기 전용)"
          >
            고정 (설치됨)
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
