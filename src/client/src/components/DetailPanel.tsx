import { useEffect, useState } from "react";
import { marked } from "marked";
import { useStore } from "../hooks/useStore";
import { RARITY_CONFIG, isEquippable } from "../types";
import { computeLevel, formatK } from "../lib/utils";
import { traitsOf, neededTraitKeys, ROLES } from "../lib/traits";
import type { Item } from "../types";
import { api } from "../lib/api";

interface DetailPanelProps {
  /** overlay = 화면 우측 고정 오버레이(기존 동작·좁은 화면/타 탭). docked = 덱 마스터-디테일 우측 고정 컬럼. */
  variant?: "overlay" | "docked";
}

export function DetailPanel({ variant = "overlay" }: DetailPanelProps) {
  const { items, selected, setSelected, favorites, toggleFavorite, lang, reloadData, slots } =
    useStore();
  const [content, setContent] = useState<string>("");
  const [loadingContent, setLoadingContent] = useState(false);
  const [equipping, setEquipping] = useState(false);
  const [translating, setTranslating] = useState(false);

  const item = items.find((i) => i.id === selected);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setSelected]);

  useEffect(() => {
    if (!item) return;
    setContent("");
    setLoadingContent(true);
    api
      .getContent(item.id)
      .then((d) => setContent(d.content))
      .catch(() => setContent(""))
      .finally(() => setLoadingContent(false));
  }, [item?.id]);

  const docked = variant === "docked";

  // docked(덱 데스크톱)는 항상 영역을 확보 — 미선택 시 플레이스홀더.
  if (!item) {
    if (!docked) return null;
    return (
      <div
        data-testid="detail-placeholder"
        className="hud-frame flex h-full min-h-[360px] flex-col items-center justify-center border border-line bg-panel/40 p-8 text-center"
        style={{ "--hud-c": "var(--color-line)" } as React.CSSProperties}
      >
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink-faint">Intel</div>
        <p className="mt-3 text-sm text-ink-dim">카드를 선택하세요</p>
        <p className="mt-1 text-xs text-ink-faint">자산을 클릭하면 상세 인텔이 표시됩니다</p>
      </div>
    );
  }

  const r = RARITY_CONFIG[item.rarity];
  const isFav = favorites.has(item.id);
  const lvl = computeLevel(item.stats?.power ?? 50, item.uses);
  const name = lang === "ko" && item.nameKo ? item.nameKo : item.displayName;
  const desc = lang === "ko" && item.descKo ? item.descKo : item.description;
  const traits = traitsOf(item);
  const equippable = isEquippable(item.kind);
  // 현재 작전 편성 기준 — 이 카드를 넣으면 발동 임박(1개 모자람)인 특성 강조용
  const formationMembers = ROLES
    .map((role) => slots[role.key] && items.find((i) => i.id === slots[role.key]))
    .filter(Boolean) as Item[];
  const nearKeys = formationMembers.length ? neededTraitKeys(formationMembers) : undefined;

  const handleEquip = async () => {
    if (!equippable) return;
    setEquipping(true);
    try {
      if (item.equipped) await api.unequip(item.id);
      else await api.equip(item.id);
      await reloadData();
    } catch {}
    setEquipping(false);
  };

  const handleTranslate = async () => {
    setTranslating(true);
    try {
      await api.translate(item.id);
      await reloadData();
    } catch {}
    setTranslating(false);
  };

  const dupGroup = item.group
    ? items.filter((x) => x.group === item.group && x.id !== item.id)
    : [];

  const STAT_LABELS: Record<string, string> = {
    popularity: "신뢰도",
    power: "작전력",
    clarity: "명확도",
    freshness: "신선도",
    weight: "무게",
  };

  const RISK_LABELS: Record<string, string> = {
    network: "외부 통신",
    shell: "셸 실행",
    creds: "자격증명",
  };
  const risks = item.risks ?? [];

  return (
    <div
      data-testid="detail-panel"
      className={
        docked
          ? "relative flex h-full flex-col border border-line bg-void/95"
          : "fixed inset-y-0 right-0 z-[60] flex w-full max-w-md flex-col border-l border-line bg-void/95 backdrop-blur-xl sm:max-w-lg"
      }
    >
      {/* 등급 컬러 엣지 */}
      <div className="absolute inset-y-0 left-0 w-px" style={{ backgroundColor: r.color, opacity: 0.6 }} />

      <button
        onClick={() => setSelected(null)}
        className="absolute right-3 top-3 z-10 p-1.5 font-mono text-ink-dim transition hover:text-ink"
        title={docked ? "선택 해제" : "닫기"}
      >
        ✕
      </button>

      <div className="flex-1 overflow-y-auto p-5">
        {/* CLASS 헤더 */}
        <div className="mb-3 flex items-center gap-2">
          <span
            className="hud-frame inline-block px-2 py-0.5 font-mono text-xs font-semibold tracking-[0.15em]"
            style={{ color: r.color, "--hud-c": r.color } as React.CSSProperties}
          >
            {r.ko} · {item.score}pt
          </span>
          {item.installed ? (
            <span className="font-mono text-[10px] text-gold" title="~/.claude 에 이미 설치된 상주 자산">
              상주 자산
            </span>
          ) : item.equipped ? (
            <span className="flex items-center gap-1.5 font-mono text-[10px] text-signal">
              <span className="blink inline-block h-1 w-1 rounded-full bg-signal" />
              투입중
            </span>
          ) : null}
        </div>

        {item.image && (
          <div className="hud-frame mb-4 overflow-hidden border border-line" style={{ "--hud-c": `${r.color}66` } as React.CSSProperties}>
            <img src={item.image} alt="" className="w-full" />
          </div>
        )}

        <h2 className="mb-1 text-xl font-bold text-ink">{name}</h2>
        <div className="mb-3 flex items-center gap-2 font-mono text-[11px] text-ink-faint">
          <span className="border border-line px-1.5 py-0.5 uppercase">{item.kind === "memory" ? "기억" : item.kind}</span>
          <span>LV.{lvl}</span>
          <span className="ml-auto">{item.source.owner}/{item.source.repo}</span>
        </div>

        {/* 연결 시너지 — 특성별 +1 기여, 현재 편성에서 발동 임박 특성 강조 */}
        {traits.length > 0 && (
          <div className="mb-3" data-testid="synergy-inline">
            <h4 className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">연결 시너지</h4>
            <div className="flex flex-wrap gap-1.5">
              {traits.map((t) => {
                const near = nearKeys?.has(t.key);
                return (
                  <span
                    key={t.key}
                    className={`border px-2 py-0.5 font-mono text-[10px] ${
                      near
                        ? "border-gold/50 bg-gold/10 text-gold"
                        : "border-signal-dim/40 bg-signal/5 text-signal-dim"
                    }`}
                    title={near ? "편성에 넣으면 신호 링크 발동 임박" : `연결 시너지 ${t.label} +1`}
                  >
                    {t.label} +1{near ? " ◂ 임박" : ""}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        <p className="mb-2 text-sm leading-relaxed text-ink">{desc}</p>
        {lang === "ko" && item.descKo && (
          <details className="mb-4 text-xs text-ink-faint">
            <summary className="cursor-pointer hover:text-ink-dim">원문 보기</summary>
            <p className="mt-1 text-ink-dim">{item.description}</p>
          </details>
        )}

        {/* 스탯 */}
        <div className="mb-5 space-y-2">
          <h4 className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">Stats</h4>
          {(["popularity", "freshness", "power", "clarity", "weight"] as const).map((k) => (
            <StatBar key={k} label={STAT_LABELS[k] ?? k} value={item.stats?.[k] ?? 0} color={r.color} />
          ))}
        </div>

        {/* 코스트 + 위험 신호 */}
        <div className="mb-5 space-y-2">
          <div className="flex items-center gap-3">
            <span className="w-16 text-xs text-ink-dim">코스트</span>
            <span className="font-mono text-xs text-gold">
              {item.cost ? `${formatK(item.cost)} tk` : "—"}
            </span>
            <span className="font-mono text-[10px] text-ink-faint">컨텍스트 토큰 비용</span>
          </div>
          <div className="flex items-start gap-3">
            <span className="w-16 shrink-0 text-xs text-ink-dim">위험</span>
            <div className="flex flex-wrap gap-1.5">
              {risks.length > 0 ? (
                risks.map((rk) => (
                  <span key={rk} className="border border-danger/50 bg-danger/10 px-2 py-0.5 font-mono text-[10px] text-danger">
                    {RISK_LABELS[rk] ?? rk}
                  </span>
                ))
              ) : (
                <span className="font-mono text-[10px] text-ink-faint">위험 신호 없음</span>
              )}
            </div>
          </div>
        </div>

        {/* 소스 */}
        <div className="mb-5 space-y-1 font-mono text-[11px]">
          <div className="flex justify-between text-ink-dim">
            <span>소스</span>
            <span className="text-ink">{item.source.owner}/{item.source.repo}</span>
          </div>
          <div className="flex justify-between text-ink-dim">
            <span>경로</span>
            <span className="max-w-[220px] truncate text-ink" title={item.source.path}>{item.source.path}</span>
          </div>
        </div>

        {dupGroup.length > 0 && (
          <div className="hud-frame mb-4 border border-line bg-panel p-3 text-xs text-ink-dim">
            동일 계열 자산 <b className="text-gold">{dupGroup.length + 1}개</b> 감지 — 비교 후 하나만 운용 권장
          </div>
        )}

        {/* 액션 */}
        <div className="mb-5 space-y-2">
          <div className="flex gap-2">
            {equippable ? (
              <button
                onClick={handleEquip}
                disabled={equipping || item.installed}
                className={`hud-frame flex-1 py-2.5 text-sm font-semibold transition ${
                  item.installed
                    ? "bg-panel2 text-ink-faint"
                    : item.equipped
                    ? "bg-panel2 text-ink-dim hover:text-danger"
                    : "bg-signal/15 text-signal hover:bg-signal/25"
                }`}
                style={{ "--hud-c": item.equipped ? "var(--color-line)" : "var(--color-signal-dim)" } as React.CSSProperties}
              >
                {item.installed
                  ? "상주 자산 — 이미 ~/.claude 에 설치됨"
                  : equipping ? "..." : item.equipped ? "철수 — 장착 해제" : "작전 투입 — ~/.claude 장착"}
              </button>
            ) : (
              <div
                className="hud-frame flex-1 py-2.5 text-center text-sm font-semibold text-ink-faint bg-panel2"
                style={{ "--hud-c": "var(--color-line)" } as React.CSSProperties}
                title="기억은 장착 개념이 없는 읽기 전용 자산입니다"
              >
                읽기 전용 — 영속 인텔(기억)
              </div>
            )}
            <button
              onClick={() => toggleFavorite(item.id)}
              className={`border border-line px-4 py-2.5 text-sm transition ${
                isFav ? "bg-gold/10 text-gold" : "bg-panel2 text-ink-dim hover:text-ink"
              }`}
            >
              ★
            </button>
          </div>
          <button
            onClick={handleTranslate}
            disabled={translating}
            className="w-full border border-line bg-panel2 py-2 text-xs text-ink-dim transition hover:text-ink disabled:opacity-50"
          >
            {translating ? "번역 중..." : item.nameKo ? "한국어 재번역" : "한국어 번역"}
          </button>
        </div>

        {/* 원문 문서 */}
        {loadingContent ? (
          <div className="flex h-24 items-center justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-signal border-t-transparent" />
          </div>
        ) : content ? (
          <div className="space-y-1">
            <h4 className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
              Documentation
            </h4>
            <div
              className="prose prose-invert prose-sm max-w-none text-ink-dim"
              dangerouslySetInnerHTML={{ __html: marked.parse(content) as string }}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function StatBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-16 text-xs text-ink-dim">{label}</span>
      <div className="h-1 flex-1 bg-panel3">
        <div
          className="h-full transition-all duration-500"
          style={{ width: `${value}%`, backgroundColor: color, boxShadow: `0 0 6px ${color}44` }}
        />
      </div>
      <span className="w-8 text-right font-mono text-xs text-ink-faint">{value}</span>
    </div>
  );
}
