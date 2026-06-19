import { useEffect, useState, useRef } from "react";
import { useStore } from "../hooks/useStore";
import { RARITY_CONFIG, isEquippable } from "../types";
import { computeLevel, formatK } from "../lib/utils";
import { traitsOf, neededTraitKeys, ROLES } from "../lib/traits";
import type { Item } from "../types";
import { api } from "../lib/api";
import { Icon } from "./Icon";
import { MarkdownView } from "./MarkdownView";

interface DetailPanelProps {
  variant?: "overlay" | "docked";
}

export function DetailPanel({ variant = "overlay" }: DetailPanelProps) {
  const {
    items,
    selected,
    setSelected,
    favorites,
    toggleFavorite,
    lang,
    reloadData,
    slots,
    panelWidth,
    setPanelWidth,
  } = useStore();
  const [content, setContent] = useState<string>("");
  const [contentKo, setContentKo] = useState<string>("");
  const [loadingContent, setLoadingContent] = useState(false);
  const [equipping, setEquipping] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [translatingContent, setTranslatingContent] = useState(false);
  const [activeTab, setActiveTab] = useState<"original" | "ko">("original");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  const [subPath, setSubPath] = useState<string | null>(null);
  const [files, setFiles] = useState<Array<{ name: string; path: string; size: number }>>([]);

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
    setSubPath(null);
    setFiles([]);
  }, [item?.id]);

  useEffect(() => {
    if (!item) return;
    setContent("");
    setContentKo("");
    setActiveTab("original");
    setLoadingContent(true);
    api
      .getContent(item.id, subPath || undefined)
      .then((d) => {
        setContent(d.content);
        if (d.contentKo) {
          setContentKo(d.contentKo);
          setActiveTab("ko");
        }
        if (d.files) {
          setFiles(d.files);
        }
      })
      .catch(() => setContent(""))
      .finally(() => setLoadingContent(false));
  }, [item?.id, subPath]);

  const currentWidthRef = useRef(panelWidth);

  useEffect(() => {
    currentWidthRef.current = panelWidth;
    document.documentElement.style.setProperty('--panel-width', `${panelWidth}px`);
  }, [panelWidth]);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(320, Math.min(900, window.innerWidth - e.clientX));
      currentWidthRef.current = newWidth;
      document.documentElement.style.setProperty('--panel-width', `${newWidth}px`);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      setPanelWidth(currentWidthRef.current);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, setPanelWidth]);

  const startResizing = (mouseDownEvent: React.MouseEvent) => {
    mouseDownEvent.preventDefault();
    setIsResizing(true);
  };

  const docked = variant === "docked";

  if (!item) {
    if (!docked) return null;
    return (
      <div
        data-testid="detail-placeholder"
        className="flex h-full min-h-[360px] flex-col items-center justify-center rounded-2xl border border-hairline bg-canvas p-8 text-center"
      >
        <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-soft">
          <Icon name="eye" size="xl" className="opacity-30" />
        </div>
        <p className="text-sm font-semibold text-ink">카드를 선택하세요</p>
        <p className="mt-1 text-xs text-muted">자산을 클릭하면 상세 정보가 표시됩니다</p>
      </div>
    );
  }

  const r = RARITY_CONFIG[item.rarity];
  const isFav = favorites.has(item.id);
  const lvl = computeLevel(item.stats?.power ?? 50, item.uses);
  const name = item.displayName;
  const desc = lang === "ko" && item.descKo ? item.descKo : item.description;
  const traits = traitsOf(item);
  const equippable = isEquippable(item.kind);
  const formationMembers = ROLES
    .map((role) => slots[role.key] && items.find((i) => i.id === slots[role.key]))
    .filter(Boolean) as Item[];
  const nearKeys = formationMembers.length ? neededTraitKeys(formationMembers) : undefined;

  const handleEquip = async () => {
    if (!equippable) return;
    const vaultToggleable = item.managed || item.claudeState === "resident";
    if (item.oversized && item.equipped && !window.confirm(`${item.displayName}는 거대 자산입니다. 끄면 vault로 이동(보관)됩니다. 진행할까요?`)) return;
    setEquipping(true);
    try {
      // vault 관리/상주 자산은 on/off 토글로 장착/해제한다.
      if (vaultToggleable) await api.activateVault(item.id, !item.equipped);
      else if (item.equipped) await api.unequip(item.id);
      else await api.equip(item.id);
      await reloadData();
    } catch {}
    setEquipping(false);
  };

  const handleTranslate = async () => {
    setTranslating(true);
    try {
      await api.translate(item.id);
      const contentRes = await api.translateContent(item.id).catch(() => null);
      if (contentRes && contentRes.contentKo) {
        setContentKo(contentRes.contentKo);
        setActiveTab("ko");
      }
      await reloadData();
    } catch {}
    setTranslating(false);
  };

  const handleTranslateContent = async () => {
    setTranslatingContent(true);
    try {
      const res = await api.translateContent(item.id);
      if (res.ok && res.contentKo) {
        setContentKo(res.contentKo);
        setActiveTab("ko");
      }
    } catch (e: any) {
      alert("본문 번역 중 오류가 발생했습니다: " + e.message);
    }
    setTranslatingContent(false);
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
          ? "relative flex h-full flex-col rounded-2xl border border-hairline bg-canvas"
          : "fixed inset-y-0 right-0 z-[60] flex h-screen w-full max-w-md flex-col border-l border-hairline bg-canvas/98 backdrop-blur-xl sm:max-w-lg"
      }
      style={docked ? undefined : { width: `${panelWidth}px`, maxWidth: "100%" }}
    >
      {/* Resizing Grab Handle — desktop view only */}
      <div
        className="absolute inset-y-0 left-0 w-2 cursor-col-resize z-50 select-none group"
        onMouseDown={startResizing}
        title="드래그하여 크기 조절"
      >
        <div className="absolute inset-y-0 left-0 w-[2.5px] bg-transparent group-hover:bg-primary transition-colors duration-150" />
      </div>

      {isResizing && (
        <div className="fixed inset-0 z-[100] cursor-col-resize" />
      )}

      {/* Header Buttons: Korean translation button + close button */}
      <div className="absolute right-3 top-3 z-10 flex items-center gap-2">
        <button
          onClick={handleTranslate}
          disabled={translating}
          className="flex h-8 items-center gap-1.5 rounded-lg border border-hairline bg-canvas px-2.5 text-xs font-bold text-muted transition hover:bg-surface-soft hover:text-body disabled:opacity-50"
          title="한국어 번역 (이름, 설명, 상세문서)"
        >
          <Icon name="translate" size="xs" />
          {translating ? "번역 중..." : item.translated ? "재번역" : "한국어 번역"}
        </button>
        <button
          onClick={() => setSelected(null)}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-surface-soft hover:text-ink"
          title={docked ? "선택 해제" : "닫기"}
        >
          <Icon name="close" size="sm" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {/* 헤더: 등급 + 이름 + 타입 */}
        <div className="mb-4 pr-32"> {/* pr-32 to prevent overlay with the top buttons */}
          <div className="mb-2 flex items-center gap-2">
            <span
              className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold text-white"
              style={{ backgroundColor: r.color }}
            >
              {r.ko}
            </span>
            {item.equipped && (
              <span className="flex items-center gap-1 rounded-full bg-surface-success px-2.5 py-0.5 text-xs font-semibold text-accent-emerald">
                <Icon name="check-circle" size="xs" />
                장착 중
              </span>
            )}
            {item.installed && (
              <span className="rounded-full bg-accent-orange-soft px-2.5 py-0.5 text-xs font-semibold text-accent-orange">
                상주
              </span>
            )}
            <span className="ml-auto font-mono text-sm font-bold text-ink">{item.score}pt</span>
          </div>
          <h2 className="text-xl font-bold text-ink">{name}</h2>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted">
            <span className="shrink-0 whitespace-nowrap rounded-md bg-surface-soft px-1.5 py-0.5 font-medium uppercase">{item.kind === "memory" ? "기억" : item.kind}</span>
            <span>·</span>
            <span className="font-mono">Lv.{lvl}</span>
            <span className="ml-auto text-muted-soft">{item.source.owner}/{typeof item.source.repo === "string" ? item.source.repo : ""}</span>
          </div>
        </div>

        {/* 이미지 */}
        {item.image && (
          <div className="mb-4 overflow-hidden rounded-xl">
            <img src={item.image} alt="" className="w-full" />
          </div>
        )}

        {/* 액션 버튼 */}
        <div className="mb-5 flex gap-2">
          {equippable ? (
            <button
              onClick={handleEquip}
              disabled={equipping || item.installed}
              className={`flex-1 rounded-lg py-2.5 text-sm font-bold transition ${
                item.installed
                  ? "bg-surface-soft text-muted"
                  : item.equipped
                    ? "border border-hairline bg-canvas text-body hover:border-accent-rose hover:text-accent-rose"
                    : "bg-primary text-white hover:bg-primary-active"
              }`}
            >
              {item.installed
                ? "상주 자산"
                : equipping ? "처리 중..." : item.equipped ? "해제" : "장착하기"}
            </button>
          ) : (
            <div className="flex-1 rounded-lg bg-surface-soft py-2.5 text-center text-sm font-semibold text-muted">
              읽기 전용
            </div>
          )}
          <button
            onClick={() => toggleFavorite(item.id)}
            className={`flex h-10 w-10 items-center justify-center rounded-lg border transition ${
              isFav ? "border-accent-orange bg-accent-orange-soft text-accent-orange" : "border-hairline text-muted hover:bg-surface-soft"
            }`}
          >
            <Icon name="favorite-star" size="lg" />
          </button>
        </div>

        {/* 설명 */}
        <div className="mb-5">
          <div className="text-sm leading-relaxed text-body">
            <MarkdownView size="sm" content={desc} onLinkClick={setSubPath} />
          </div>
          {lang === "ko" && item.descKo && (
            <details className="mt-2 text-xs text-muted-soft">
              <summary className="cursor-pointer hover:text-muted">원문 보기</summary>
              <div className="mt-1">
                <MarkdownView size="sm" content={item.description} onLinkClick={setSubPath} />
              </div>
            </details>
          )}
        </div>

        {/* 연결 시너지 */}
        <div className="mb-5">
          <h4 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">연결 시너지</h4>
          {traits.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {traits.map((t) => {
                const near = nearKeys?.has(t.key);
                return (
                  <span
                    key={t.key}
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      near
                        ? "bg-accent-orange-soft text-accent-orange"
                        : "bg-surface-soft text-muted"
                    }`}
                    title={near ? "편성에 넣으면 신호 링크 발동 임박" : `연결 시너지 ${t.label} +1`}
                  >
                    {t.label} +1{near ? " ◂" : ""}
                  </span>
                );
              })}
            </div>
          ) : (
            <span className="text-sm text-muted-soft">특성 없음</span>
          )}
        </div>

        {/* 스탯 바 */}
        <div className="mb-5">
          <h4 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">성능 지표</h4>
          <div className="space-y-3">
            {(["popularity", "freshness", "power", "clarity", "weight"] as const).map((k) => (
              <StatBar key={k} label={STAT_LABELS[k] ?? k} value={item.stats?.[k] ?? 0} color={r.color} />
            ))}
          </div>
        </div>

        {/* 코스트 + 위험 */}
        <div className="mb-5 space-y-3">
          <div className="flex items-center justify-between rounded-lg bg-surface-soft px-4 py-3">
            <span className="flex items-center gap-1.5 text-sm text-muted">
              <Icon name="gauge" size="xs" /> 컨텍스트 비용
            </span>
            <span className="font-mono text-sm font-semibold text-accent-orange">
              {item.cost ? `${formatK(item.cost)} tk` : "—"}
            </span>
          </div>
          {risks.length > 0 && (
            <div className="rounded-lg border border-accent-rose/20 bg-accent-rose/5 px-3 py-2">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-accent-rose">
                <Icon name="warning" size="xs" /> 위험 신호
              </span>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {risks.map((rk) => (
                  <span key={rk} className="rounded-full bg-accent-rose/10 px-2 py-0.5 text-[10px] font-medium text-accent-rose">
                    {RISK_LABELS[rk] ?? rk}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 소스 메타 */}
        <div className="mb-5 rounded-lg bg-surface-soft p-3 space-y-1.5 text-sm">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-muted"><Icon name="folder" size="xs" /> 출처</span>
            <span className="font-mono text-body">{item.source.owner}/{typeof item.source.repo === "string" ? item.source.repo : ""}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-muted"><Icon name="file" size="xs" /> 경로</span>
            <span className="max-w-[200px] truncate font-mono text-body" title={item.source.path}>{item.source.path}</span>
          </div>
        </div>

        {/* 중복 그룹 */}
        {dupGroup.length > 0 && (
          <div className="mb-4 rounded-lg border border-accent-orange/20 bg-accent-orange-soft p-3 text-sm text-body">
            동일 계열 자산 <b className="text-accent-orange">{dupGroup.length + 1}개</b> 감지 — 비교 후 하나만 운용 권장
          </div>
        )}

        {/* 관련 파일 브라우저 */}
        {files.filter((f) => f.path !== item.source.path.split(/[/\\]/).pop()).length > 0 && (
          <div className="mb-5">
            <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted flex items-center gap-1.5">
              <Icon name="folder" size="xs" /> 관련 파일 목록
            </h4>
            <div className="grid grid-cols-2 gap-1.5 max-h-[160px] overflow-y-auto rounded-lg border border-hairline p-2 bg-surface-app">
              {files
                .filter((f) => f.path !== item.source.path.split(/[/\\]/).pop())
                .map((f) => {
                  const isActive = subPath === f.path;
                  return (
                    <button
                      key={f.path}
                      onClick={() => setSubPath(isActive ? null : f.path)}
                      className={`flex items-center justify-between gap-2 rounded px-2.5 py-1 text-left text-xs font-medium transition cursor-pointer border-none ${
                        isActive
                          ? "bg-primary text-white shadow-xs"
                          : "bg-canvas text-body hover:bg-surface-soft hover:text-ink border border-hairline"
                      }`}
                    >
                      <span className="truncate flex-1 flex items-center gap-1">
                        <Icon name="file-alt" size="xs" className={isActive ? "text-white" : "text-muted-soft"} />
                        <span className="truncate">{f.path}</span>
                      </span>
                      <span className={`font-mono text-[9px] ${isActive ? "text-white/80" : "text-muted-soft"}`}>
                        {(f.size / 1024).toFixed(1)}k
                      </span>
                    </button>
                  );
                })}
            </div>
          </div>
        )}

        {/* 원문 문서 */}
        {loadingContent ? (
          <div className="flex h-24 items-center justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : content ? (
          <div>
            <div className="mb-3 flex items-center justify-between gap-4 border-b border-hairline pb-2">
              <h4 className="flex min-w-0 flex-1 items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-muted" title={subPath || "문서"}>
                <Icon name="file-alt" size="xs" />
                <span className="truncate">{subPath ? subPath.split("/").pop() : "문서"}</span>
              </h4>
              <div className="flex shrink-0 items-center gap-2">
                {subPath && (
                  <button
                    onClick={() => setSubPath(null)}
                    className="flex items-center gap-1 rounded bg-surface-soft px-2.5 py-1 text-xs font-semibold text-body hover:bg-surface-hover hover:text-ink transition cursor-pointer"
                  >
                    <Icon name="arrow-left" size="xs" /> 메인 문서
                  </button>
                )}
                {!contentKo && (
                  <button
                    onClick={handleTranslateContent}
                    disabled={translatingContent}
                    className="flex items-center gap-1 rounded-md bg-accent-orange-soft px-2.5 py-1 text-xs font-semibold text-accent-orange hover:bg-accent-orange/20 transition disabled:opacity-50"
                  >
                    <Icon name="translate" size="xs" />
                    {translatingContent ? "번역 중..." : "본문 번역"}
                  </button>
                )}
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="flex items-center gap-1 rounded-md bg-surface-soft px-2 py-1 text-xs font-semibold text-body hover:bg-surface-hover hover:text-ink transition"
                >
                  <Icon name="expand" size="xs" />
                  자세히 보기
                </button>
              </div>
            </div>

            {contentKo && (
              <div className="mb-3 flex border-b border-hairline">
                <button
                  onClick={() => setActiveTab("original")}
                  className={`px-4 py-2 text-xs font-bold transition border-b-2 -mb-[2px] ${
                    activeTab === "original"
                      ? "border-primary text-primary"
                      : "border-transparent text-muted hover:text-body"
                  }`}
                >
                  영어 (Original)
                </button>
                <button
                  onClick={() => setActiveTab("ko")}
                  className={`px-4 py-2 text-xs font-bold transition border-b-2 -mb-[2px] ${
                    activeTab === "ko"
                      ? "border-primary text-primary"
                      : "border-transparent text-muted hover:text-body"
                  }`}
                >
                  한국어 (번역)
                </button>
                <button
                  onClick={handleTranslateContent}
                  disabled={translatingContent}
                  className="ml-auto flex items-center gap-1 self-center rounded px-2 py-1 text-[10px] font-semibold text-muted hover:bg-surface-soft hover:text-body transition"
                  title="본문 번역 업데이트"
                >
                  <Icon name="translate" size="xs" className="scale-75" />
                  {translatingContent ? "번역 중..." : "재번역"}
                </button>
              </div>
            )}

            <div className="rounded-xl border border-hairline bg-canvas p-4 text-base md:text-lg leading-relaxed">
              <div className="prose prose-base max-w-none dark:prose-invert">
                <MarkdownView size="md" content={activeTab === "ko" && contentKo ? contentKo : content} onLinkClick={setSubPath} />
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Details Popup Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 md:p-10 bg-black/50 backdrop-blur-sm">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-transparent"
            onClick={() => setIsModalOpen(false)}
          />

          {/* Modal Container */}
          <div className="relative z-10 flex h-full max-h-[92vh] w-full max-w-6xl flex-col rounded-2xl border border-hairline bg-canvas shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-hairline px-6 py-4 bg-surface-soft/40">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
                  <Icon name="file-alt" size="md" />
                </span>
                <div>
                  <span
                    className="inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold text-white mb-0.5"
                    style={{ backgroundColor: r.color }}
                  >
                    {r.ko}
                  </span>
                  <h3 className="text-xl font-black text-ink">{item.displayName} - {subPath ? subPath.split("/").pop() : "상세 문서"}</h3>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-surface-soft hover:text-ink"
                title="닫기"
              >
                <Icon name="close" size="sm" />
              </button>
            </div>

            {/* Modal Sub-Header (Tabs inside Modal) */}
            <div className="flex items-center justify-between border-b border-hairline bg-surface-soft/20 px-6 py-2">
              <div className="flex gap-4">
                <button
                  onClick={() => setActiveTab("original")}
                  className={`py-2 text-sm font-bold transition border-b-2 -mb-[9px] flex items-center gap-1.5 ${
                    activeTab === "original"
                      ? "border-primary text-primary"
                      : "border-transparent text-muted hover:text-body"
                  }`}
                >
                  <Icon name="globe" size="xs" />
                  영어 (Original)
                </button>
                {contentKo && (
                  <button
                    onClick={() => setActiveTab("ko")}
                    className={`py-2 text-sm font-bold transition border-b-2 -mb-[9px] flex items-center gap-1.5 ${
                      activeTab === "ko"
                        ? "border-primary text-primary"
                        : "border-transparent text-muted hover:text-body"
                    }`}
                  >
                    <Icon name="translate" size="xs" />
                    한국어 (번역)
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleTranslateContent}
                  disabled={translatingContent}
                  className="flex items-center gap-1.5 rounded-md bg-accent-orange-soft px-3 py-1.5 text-xs font-bold text-accent-orange hover:bg-accent-orange/20 transition disabled:opacity-50"
                >
                  <Icon name="translate" size="xs" />
                  {translatingContent ? "번역 중..." : contentKo ? "번역 업데이트" : "한국어로 번역"}
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex flex-1 overflow-hidden bg-canvas">
              {/* Left Sidebar: File Explorer */}
              {files.filter((f) => f.path !== item.source.path.split(/[/\\]/).pop()).length > 0 && (
                <div className="w-64 shrink-0 border-r border-hairline bg-surface-soft/20 p-4 overflow-y-auto flex flex-col gap-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-muted mb-2 flex items-center gap-1.5">
                    <Icon name="folder" size="xs" /> 파일 탐색기
                  </div>
                  <div className="flex flex-col gap-1">
                    {/* Main file button */}
                    <button
                      onClick={() => setSubPath(null)}
                      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold transition cursor-pointer border-none ${
                        subPath === null
                          ? "bg-primary text-white shadow-xs"
                          : "bg-transparent text-body hover:bg-surface-soft hover:text-ink"
                      }`}
                    >
                      <Icon name="file-alt" size="xs" className={subPath === null ? "text-white" : "text-primary"} />
                      <span className="truncate flex-1 font-bold">
                        {item.displayName || "메인 문서"}
                      </span>
                    </button>
                    {/* Related files list */}
                    {files
                      .filter((f) => f.path !== item.source.path.split(/[/\\]/).pop())
                      .map((f) => {
                        const isActive = subPath === f.path;
                        return (
                          <button
                            key={f.path}
                            onClick={() => setSubPath(f.path)}
                            className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium transition cursor-pointer border-none ${
                              isActive
                                ? "bg-primary text-white shadow-xs"
                                : "bg-transparent text-body hover:bg-surface-soft hover:text-ink"
                            }`}
                          >
                            <span className="truncate flex-1 flex items-center gap-2">
                              <Icon name="file-alt" size="xs" className={isActive ? "text-white" : "text-muted-soft"} />
                              <span className={isActive ? "font-bold" : "font-normal"}>{f.path}</span>
                            </span>
                            <span className={`font-mono text-[9px] ${isActive ? "text-white/80" : "text-muted-soft"} ml-1`}>
                              {(f.size / 1024).toFixed(1)}k
                            </span>
                          </button>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Right Content Area */}
              <div className="flex-1 overflow-y-auto p-6 md:p-10 text-lg md:text-xl leading-relaxed">
                <div className="prose prose-lg max-w-none dark:prose-invert">
                  <MarkdownView size="lg" content={activeTab === "ko" && contentKo ? contentKo : content} onLinkClick={setSubPath} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-14 text-sm text-muted">{label}</span>
      <div className="h-2 flex-1 rounded-full bg-surface-soft">
        <div
          className="h-full rounded-full stat-bar-fill"
          style={{ width: `${value}%`, backgroundColor: color }}
        />
      </div>
      <span className="w-8 text-right font-mono text-sm font-semibold text-ink">{value}</span>
    </div>
  );
}
