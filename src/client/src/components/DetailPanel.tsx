import { useEffect, useState } from "react";
import { marked } from "marked";
import { useStore } from "../hooks/useStore";
import { RARITY_CONFIG } from "../types";
import { computeLevel } from "../lib/utils";
import { api } from "../lib/api";

export function DetailPanel() {
  const { items, selected, setSelected, favorites, toggleFavorite, lang, reloadData } =
    useStore();
  const [content, setContent] = useState<string>("");
  const [loadingContent, setLoadingContent] = useState(false);
  const [equipping, setEquipping] = useState(false);

  const item = items.find((i) => i.id === selected);

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

  if (!item) return null;

  const r = RARITY_CONFIG[item.rarity];
  const isFav = favorites.has(item.id);
  const lvl = computeLevel(item.stats?.power ?? 50);
  const name = lang === "ko" && item.nameKo ? item.nameKo : item.displayName;
  const desc = lang === "ko" && item.descKo ? item.descKo : item.description;

  const [translating, setTranslating] = useState(false);

  const handleEquip = async () => {
    setEquipping(true);
    try {
      if (item.equipped) {
        await api.unequip(item.id);
      } else {
        await api.equip(item.id);
      }
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

  return (
    <div className="fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l border-zinc-800 bg-zinc-950/95 backdrop-blur-xl sm:max-w-lg">
      {/* Close */}
      <button
        onClick={() => setSelected(null)}
        className="absolute right-3 top-3 z-10 rounded-full p-1.5 text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
      >
        ✕
      </button>

      <div className="flex-1 overflow-y-auto p-5">
        {/* Rarity badge */}
        <div className="mb-3 flex items-center gap-2">
          <span
            className="inline-block rounded px-2 py-0.5 text-xs font-bold tracking-wider"
            style={{ color: r.color, backgroundColor: `${r.color}15` }}
          >
            {r.ko} · {item.score}pt
          </span>
          {item.equipped && (
            <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-400">
              장착 중
            </span>
          )}
        </div>

        {/* Image */}
        {item.image && (
          <div className="mb-4 overflow-hidden rounded-xl">
            <img src={item.image} alt="" className="w-full" />
          </div>
        )}

        {/* Title */}
        <h2 className="mb-1 text-xl font-bold text-white">{name}</h2>
        <div className="mb-4 flex items-center gap-2 text-xs text-zinc-500">
          <span className="rounded bg-zinc-800 px-1.5 py-0.5 uppercase">{item.kind}</span>
          <span>Lv.{lvl}</span>
          <span className="ml-auto text-zinc-600">{item.source.owner}/{item.source.repo}</span>
        </div>

        {/* Description */}
        <p className="mb-2 text-sm leading-relaxed text-zinc-300">{desc}</p>
        {lang === "ko" && item.descKo && (
          <details className="mb-4 text-xs text-zinc-500">
            <summary className="cursor-pointer hover:text-zinc-300">원문 보기</summary>
            <p className="mt-1 text-zinc-400">{item.description}</p>
          </details>
        )}

        {/* Stats */}
        <div className="mb-5 space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Stats</h4>
          {(["popularity", "freshness", "power", "clarity", "weight"] as const).map((k) => (
            <StatBar key={k} label={STAT_LABELS[k] ?? k} value={item.stats?.[k] ?? 0} />
          ))}
        </div>

        {/* Source info */}
        <div className="mb-5 space-y-1 text-xs">
          <div className="flex justify-between text-zinc-400">
            <span>소스</span>
            <span className="font-mono text-zinc-300">{item.source.owner}/{item.source.repo}</span>
          </div>
          <div className="flex justify-between text-zinc-400">
            <span>경로</span>
            <span className="truncate max-w-[200px] font-mono text-zinc-300" title={item.source.path}>{item.source.path}</span>
          </div>
        </div>

        {/* Duplicate group hint */}
        {dupGroup.length > 0 && (
          <div className="mb-4 rounded-lg border border-violet-500/20 bg-violet-500/5 p-3 text-xs text-violet-300">
            동일 계열 자산 <b>{dupGroup.length + 1}개</b> 감지
          </div>
        )}

        {/* Actions */}
        <div className="mb-5 space-y-2">
          <div className="flex gap-2">
            <button
              onClick={handleEquip}
              disabled={equipping}
              className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition ${
                item.equipped
                  ? "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                  : "bg-amber-500 text-black hover:bg-amber-400"
              }`}
            >
              {equipping ? "..." : item.equipped ? "투입 해제" : "작전 투입"}
            </button>
            <button
              onClick={() => toggleFavorite(item.id)}
              className={`rounded-lg px-4 py-2.5 text-sm transition ${
                isFav
                  ? "bg-amber-500/20 text-amber-400"
                  : "bg-zinc-800 text-zinc-400 hover:text-white"
              }`}
            >
              ★
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleTranslate}
              disabled={translating}
              className="flex-1 rounded-lg bg-zinc-800 py-2 text-xs text-zinc-300 transition hover:bg-zinc-700"
            >
              {translating ? "번역 중..." : item.nameKo ? "한국어 재번역" : "한국어 번역"}
            </button>
          </div>
        </div>

        {/* Full doc */}
        {loadingContent ? (
          <div className="flex h-24 items-center justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
          </div>
        ) : content ? (
          <div className="space-y-1">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Documentation
            </h4>
            <div
              className="prose prose-invert prose-sm max-w-none text-zinc-300"
              dangerouslySetInnerHTML={{ __html: marked.parse(content) as string }}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function StatBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-20 text-xs capitalize text-zinc-400">{label}</span>
      <div className="h-1.5 flex-1 rounded-full bg-zinc-800">
        <div
          className="h-full rounded-full bg-gradient-to-r from-amber-500/80 to-amber-400/60 transition-all duration-500"
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="w-8 text-right text-xs font-mono text-zinc-500">{value}</span>
    </div>
  );
}
