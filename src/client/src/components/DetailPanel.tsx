import { useEffect, useState, useRef } from "react";
import { useStore } from "../hooks/useStore";
import { RARITY_CONFIG, isEquippable } from "../types";
import { computeLevel, formatK, pickDesc } from "../lib/utils";
import { traitsOf } from "../lib/traits";
import type { Item } from "../types";
import { api } from "../lib/api";
import { Icon } from "./Icon";
import { MarkdownView } from "./MarkdownView";

interface DetailPanelProps {
  variant?: "overlay" | "docked";
}

// /api/analyze 응답의 analysis 형태 (api.ts 계약과 일치)
interface AnalysisResult {
  purpose: string;
  quality: string;
  redundancy: string;
  recommendation: "keep" | "drop";
  confidence: number;
  reasons: string[];
}

export function DetailPanel({ variant = "overlay" }: DetailPanelProps) {
  // fine-grained 구독 — 전역 store를 통째로 구독하면 filters/picked 같은 무관한 변경에도
  // DetailPanel이 리렌더된다(큰 문서가 열려 있을 때 필터 클릭이 버벅이는 원인). 쓰는 슬라이스만 구독.
  const items = useStore((s) => s.items);
  const selected = useStore((s) => s.selected);
  const setSelected = useStore((s) => s.setSelected);
  const favorites = useStore((s) => s.favorites);
  const toggleFavorite = useStore((s) => s.toggleFavorite);
  const lang = useStore((s) => s.lang);
  const reloadData = useStore((s) => s.reloadData);
  const engines = useStore((s) => s.engines);
  const panelWidth = useStore((s) => s.panelWidth);
  const setPanelWidth = useStore((s) => s.setPanelWidth);
  const [content, setContent] = useState<string>("");
  const [contentKo, setContentKo] = useState<string>("");
  const [loadingContent, setLoadingContent] = useState(false);
  const [equipping, setEquipping] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [translatingContent, setTranslatingContent] = useState(false);
  const [activeTab, setActiveTab] = useState<"original" | "ko">("original");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const [deleting, setDeleting] = useState(false);

  // ── AI 분석 — 엔진/모델 선택 + 결과(로컬 상태, 선택 카드 바뀌면 리셋) ──
  const nonHeuristic = engines.filter((e) => e !== "heuristic");
  const defaultEngine = nonHeuristic.includes("claude") ? "claude" : nonHeuristic[0] ?? "heuristic";
  const [analyzeEngine, setAnalyzeEngine] = useState<string>(defaultEngine);
  const [analyzeModel, setAnalyzeModel] = useState<string>("sonnet");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  // 실제 분석에 쓰인 엔진(서버 응답) — 요청 엔진이 실패하면 휴리스틱으로 폴백되므로
  // 결과에 그대로 노출해 "선택 엔진인 척하는 휴리스틱" 혼동을 막는다.
  const [analyzedEngine, setAnalyzedEngine] = useState<string | null>(null);

  // engines가 부팅보다 늦게 도착하면 초깃값이 "heuristic"으로 고정될 수 있다(useState는 1회 평가).
  // 실엔진이 들어오면 아직 휴리스틱이던 선택을 claude(없으면 첫 실엔진)로 한 번 재동기화한다.
  useEffect(() => {
    if (analyzeEngine === "heuristic" && nonHeuristic.length) {
      setAnalyzeEngine(nonHeuristic.includes("claude") ? "claude" : nonHeuristic[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engines]);

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
    setDeleteOpen(false);
    setDeleteText("");
    // AI 분석 상태도 카드별로 초기화
    setAnalysis(null);
    setAnalyzeError(null);
    setAnalyzing(false);
    setAnalyzedEngine(null);
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
  const lvl = computeLevel(item.uses); // 실사용(uses>0) 있을 때만 LV, 없으면 null → 숨김
  const name = item.displayName;
  const isMcp = item.kind === "mcp";
  const desc = pickDesc(item, lang);
  const traits = traitsOf(item);
  const equippable = isEquippable(item.kind);
  // vault on/off 토글 대상: vault 관리 항목 또는 ~/.claude 상주 실폴더.
  const vaultToggleable = item.managed || item.claudeState === "resident";
  // installed지만 토글 불가(cc-config 등 레거시) → 읽기 전용 "고정 (설치됨)".
  // "상주"(claudeState==="resident")와는 구분 — 상주는 vault 토글 가능.
  const lockedInstalled = !!item.installed && !vaultToggleable;

  const handleEquip = async () => {
    if (!equippable || lockedInstalled) return;
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

  const handleDelete = async () => {
    // 서버/Inventory DeleteDialog와 동일하게 양변 trim 비교 — item.name 공백 차이로 수용 기준이 어긋나지 않게.
    if (deleteText.trim() !== item.name.trim()) return;
    setDeleting(true);
    try {
      const res = await api.deleteItem(item.id, deleteText.trim());
      if (res.ok) {
        setDeleteOpen(false);
        setSelected(null);
        await reloadData();
      } else {
        alert("삭제 실패: " + (res.error || "알 수 없는 오류"));
      }
    } catch (e: any) {
      alert("삭제 중 오류: " + (e?.message || e));
    }
    setDeleting(false);
  };

  const handleAnalyze = async () => {
    if (!item) return;
    setAnalyzing(true);
    setAnalyzeError(null);
    setAnalysis(null);
    setAnalyzedEngine(null);
    try {
      const res = await api.analyze(
        item.id,
        analyzeEngine,
        analyzeEngine === "claude" ? analyzeModel : undefined,
      );
      if (res.ok && res.analysis) {
        setAnalysis(res.analysis);
        // 서버는 요청 엔진 실패 시 휴리스틱으로 폴백하고 실제 사용 엔진을 res.engine으로 돌려준다.
        setAnalyzedEngine(res.engine || null);
      } else {
        setAnalyzeError("분석에 실패했습니다 (엔진 미설치 또는 응답 오류)");
      }
    } catch {
      setAnalyzeError("분석 요청 중 오류가 발생했습니다");
    } finally {
      setAnalyzing(false);
    }
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

  // 정직한 라벨 — popularity는 git 활동량(추천/인기 아님), power는 파일 부피(역량 아님).
  const STAT_LABELS: Record<string, string> = {
    popularity: "repo 활동성",
    power: "규모",
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
              title="이번 스캔 상위 백분위 기준 — 절대 품질 아님"
            >
              {r.ko}
            </span>
            {item.equipped && (
              <span className="flex items-center gap-1 rounded-full bg-surface-success px-2.5 py-0.5 text-xs font-semibold text-accent-emerald">
                <Icon name="check-circle" size="xs" />
                장착 중
              </span>
            )}
            {item.claudeState === "resident" ? (
              <span className="rounded-full bg-accent-orange-soft px-2.5 py-0.5 text-xs font-semibold text-accent-orange">
                상주
              </span>
            ) : lockedInstalled ? (
              <span
                className="rounded-full bg-surface-soft px-2.5 py-0.5 text-xs font-semibold text-muted"
                title="이미 ~/.claude 에 설치돼 있어 토글할 수 없습니다(읽기 전용)"
              >
                고정 (설치됨)
              </span>
            ) : null}
            <span className="ml-auto font-mono text-sm font-bold text-ink">{item.score}pt</span>
          </div>
          <h2 className="text-xl font-bold text-ink">{name}</h2>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted">
            <span className="shrink-0 whitespace-nowrap rounded-md bg-surface-soft px-1.5 py-0.5 font-medium uppercase">{item.kind === "memory" ? "기억" : item.kind}</span>
            {lvl !== null && (
              <>
                <span>·</span>
                <span className="font-mono" title={`실사용 ${item.uses}회 기반 레벨`}>Lv.{lvl}</span>
              </>
            )}
            <span className="ml-auto text-muted-soft">{item.source.owner}/{typeof item.source.repo === "string" ? item.source.repo : ""}</span>
          </div>
        </div>

        {/* 이미지 — memory는 개별 AI 아트를 쓰지 않는다(카드와 동일하게 공통 분류 글리프로 통일). */}
        {item.image && item.kind !== "memory" && (
          <div className="mb-4 overflow-hidden rounded-xl">
            <img src={item.image} alt="" className="w-full" />
          </div>
        )}

        {/* 액션 버튼 */}
        <div className="mb-5 flex gap-2">
          {equippable ? (
            <button
              onClick={handleEquip}
              disabled={equipping || lockedInstalled}
              className={`flex-1 rounded-lg py-2.5 text-sm font-bold transition ${
                lockedInstalled
                  ? "bg-surface-soft text-muted"
                  : item.equipped
                    ? "border border-hairline bg-canvas text-body hover:border-accent-rose hover:text-accent-rose"
                    : "bg-primary text-white hover:bg-primary-active"
              }`}
              title={item.claudeState === "resident" ? "해제하면 vault(보관함)로 끌어와 관리합니다" : undefined}
            >
              {lockedInstalled
                ? "고정 (설치됨)"
                : equipping
                  ? "처리 중..."
                  : item.equipped
                    ? item.claudeState === "resident" ? "해제 (보관함으로)" : "해제"
                    : "장착하기"}
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

        {/* AI 분석 — 자산의 용도/품질/중복을 평가해 유지·정리 권고. 엔진/모델 선택. */}
        <div className="mb-5 rounded-xl border border-hairline bg-canvas p-4">
          <div className="mb-3 flex items-center gap-1.5">
            <Icon name="flask" size="sm" className="text-primary" />
            <h4 className="text-sm font-bold uppercase tracking-wide text-muted">AI 분석</h4>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={analyzeEngine}
              onChange={(e) => setAnalyzeEngine(e.target.value)}
              disabled={analyzing}
              className="rounded-lg border border-hairline bg-canvas px-2.5 py-1.5 text-xs text-body focus:border-primary focus:outline-none disabled:opacity-50"
              title="분석 엔진"
            >
              {engines.map((e) => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>

            {analyzeEngine === "claude" && (
              <select
                value={analyzeModel}
                onChange={(e) => setAnalyzeModel(e.target.value)}
                disabled={analyzing}
                className="rounded-lg border border-hairline bg-canvas px-2.5 py-1.5 text-xs text-body focus:border-primary focus:outline-none disabled:opacity-50"
                title="Claude 모델"
              >
                <option value="sonnet">sonnet</option>
                <option value="opus">opus</option>
                <option value="haiku">haiku</option>
              </select>
            )}

            <button
              onClick={handleAnalyze}
              disabled={analyzing}
              className="ml-auto flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white transition hover:bg-primary-active disabled:opacity-50"
            >
              {analyzing ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  분석 중...
                </>
              ) : (
                <>
                  <Icon name="flask" size="xs" /> 분석
                </>
              )}
            </button>
          </div>

          {analyzing && (
            <p className="mt-2 text-[11px] text-muted-soft">
              엔진에 따라 30~60초 정도 걸릴 수 있습니다.
            </p>
          )}

          {analyzeError && (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-soft">
              <Icon name="error-circle" size="xs" className="text-accent-rose" /> {analyzeError}
            </p>
          )}

          {analysis && (
            <div className="mt-4 space-y-3">
              {/* 권고 + 신뢰도 */}
              <div className="flex items-center gap-2">
                {analysis.recommendation === "keep" ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-surface-success px-2.5 py-0.5 text-xs font-bold text-accent-emerald">
                    <Icon name="check-circle" size="xs" /> 유지 권장
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-accent-rose/10 px-2.5 py-0.5 text-xs font-bold text-accent-rose">
                    <Icon name="warning" size="xs" /> 정리 후보
                  </span>
                )}
                <span className="font-mono text-xs text-muted" title="권고 신뢰도">
                  {Math.round(analysis.confidence)}%
                </span>
                {analyzedEngine &&
                  (analyzedEngine === "heuristic" && analyzeEngine !== "heuristic" ? (
                    <span
                      className="ml-auto inline-flex items-center gap-1 rounded-full bg-accent-rose/10 px-2 py-0.5 font-mono text-[11px] text-accent-rose"
                      title="요청 엔진을 쓸 수 없어 휴리스틱(규칙 기반)으로 폴백했습니다"
                    >
                      <Icon name="warning" size="xs" /> 휴리스틱 폴백
                    </span>
                  ) : (
                    <span
                      className="ml-auto font-mono text-[11px] text-muted-soft"
                      title="분석에 실제로 사용된 엔진"
                    >
                      {analyzedEngine}
                    </span>
                  ))}
              </div>

              {/* 용도 / 품질 / 중복성 */}
              <div className="space-y-2.5">
                <AnalysisBlock label="용도" value={analysis.purpose} />
                <AnalysisBlock label="품질" value={analysis.quality} />
                <AnalysisBlock label="중복성" value={analysis.redundancy} />
              </div>

              {/* 근거 */}
              {analysis.reasons?.length > 0 && (
                <div>
                  <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-muted">근거</div>
                  <ul className="space-y-1">
                    {analysis.reasons.map((reason, i) => (
                      <li key={i} className="flex gap-1.5 text-xs leading-relaxed text-body">
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-soft" />
                        <span>{reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 위험 구역: 스킬/에이전트 삭제 — 이름 입력 재확인(휴지통 이동, 복구 가능) */}
        {equippable && (
          <div className="mb-5">
            {!deleteOpen ? (
              <button
                onClick={() => { setDeleteOpen(true); setDeleteText(""); }}
                className="flex items-center gap-1.5 text-xs font-medium text-muted-soft transition hover:text-accent-rose"
              >
                <Icon name="delete" size="xs" /> 이 자산 삭제
              </button>
            ) : (
              <div className="rounded-lg border border-accent-rose/30 bg-accent-rose/5 p-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-accent-rose">
                  <Icon name="warning" size="xs" /> 삭제 확인
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-muted">
                  라이브(<span className="font-mono">~/.claude</span>) 사본 · vault 사본 · 소스를 모두
                  휴지통(<span className="font-mono">vault/.trash</span>)으로 옮깁니다. 복구 가능하지만
                  카탈로그에서는 사라집니다. 진행하려면 아래에 <b className="text-body">{item.name}</b> 을(를) 그대로 입력하세요.
                </p>
                <input
                  type="text"
                  value={deleteText}
                  onChange={(e) => setDeleteText(e.target.value)}
                  placeholder={item.name}
                  autoFocus
                  className="mt-2 w-full rounded-md border border-hairline bg-canvas px-2.5 py-1.5 text-sm text-ink outline-none transition focus:border-accent-rose"
                />
                <div className="mt-2 flex items-center gap-2">
                  <button
                    onClick={handleDelete}
                    disabled={deleting || deleteText.trim() !== item.name.trim()}
                    className="rounded-md bg-accent-rose px-3 py-1.5 text-xs font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {deleting ? "삭제 중..." : "영구 삭제"}
                  </button>
                  <button
                    onClick={() => { setDeleteOpen(false); setDeleteText(""); }}
                    disabled={deleting}
                    className="rounded-md border border-hairline px-3 py-1.5 text-xs font-medium text-muted transition hover:bg-surface-soft disabled:opacity-40"
                  >
                    취소
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

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

        {/* 특성 태그 */}
        <div className="mb-5">
          <h4 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">특성</h4>
          {traits.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {traits.map((t) => (
                <span
                  key={t.key}
                  className="rounded-full bg-surface-soft px-3 py-1 text-xs font-medium text-muted"
                  title={`특성 ${t.label}`}
                >
                  {t.label}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-sm text-muted-soft">특성 없음</span>
          )}
        </div>

        {/* 성능 지표 — MCP는 스탯이 스캔 상수(조작값)이므로 막대 대신 실제 구성 신호를 노출 */}
        {isMcp ? (
          <div className="mb-5">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-sm font-bold uppercase tracking-wide text-muted">MCP 구성</h4>
              <span className="rounded-full bg-surface-soft px-2 py-0.5 text-[10px] font-medium text-muted-soft" title="MCP 스탯은 스캔 상수라 막대로 표시하지 않음. 점수/등급은 구조(명령·인자·env)로 산출.">
                구조 기반 점수
              </span>
            </div>
            <McpSignals item={item} />
          </div>
        ) : (
          <div className="mb-5">
            <h4 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">성능 지표</h4>
            <div className="space-y-3">
              {(["popularity", "freshness", "power", "clarity", "weight"] as const).map((k) => (
                <StatBar key={k} label={STAT_LABELS[k] ?? k} value={item.stats?.[k] ?? 0} color={r.color} />
              ))}
            </div>
          </div>
        )}

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

/* ── AI 분석 결과의 라벨링된 블록 (용도/품질/중복성) ── */
function AnalysisBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface-soft px-3 py-2">
      <div className="text-[11px] font-bold uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-0.5 text-xs leading-relaxed text-body">{value || "—"}</div>
    </div>
  );
}

/* ── MCP 실제 신호 — 조작된 스탯 대신 명령/인자/env 같은 구조적 사실을 노출 ── */
function McpSignals({ item }: { item: Item }) {
  const meta = item.meta as { command?: string | null; args?: string[]; url?: string | null; env?: string[] } | undefined;
  const command = meta?.command || null;
  const url = meta?.url || null;
  const args = meta?.args ?? [];
  const env = meta?.env ?? [];

  return (
    <div className="space-y-2.5">
      {/* 실행 방식: 로컬 명령 또는 원격 URL */}
      <div className="rounded-lg border border-hairline bg-surface-soft px-3 py-2">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
          <Icon name={url ? "web-globe" : "terminal-window"} size="xs" />
          {url ? "원격 엔드포인트" : "실행 명령"}
        </div>
        <div className="mt-1 break-all font-mono text-xs text-body">
          {url ? url : command ? command : <span className="text-muted-soft">— 정의 없음</span>}
        </div>
      </div>

      {/* 인자 — 개수 + 토큰 목록 */}
      <div className="rounded-lg border border-hairline bg-surface-soft px-3 py-2">
        <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-muted">
          <span className="flex items-center gap-1.5"><Icon name="puzzle-piece" size="xs" /> 인자</span>
          <span className="font-mono text-muted-soft">{args.length}</span>
        </div>
        {args.length > 0 ? (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {args.map((a, i) => (
              <span key={i} className="rounded bg-canvas px-1.5 py-0.5 font-mono text-[10px] text-body border border-hairline">{a}</span>
            ))}
          </div>
        ) : (
          <div className="mt-1 text-xs text-muted-soft">없음</div>
        )}
      </div>

      {/* env 키 — 자격증명 노출 여부 */}
      <div className="rounded-lg border border-hairline bg-surface-soft px-3 py-2">
        <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-muted">
          <span className="flex items-center gap-1.5"><Icon name="key" size="xs" /> 환경변수 키</span>
          <span className="font-mono text-muted-soft">{env.length}</span>
        </div>
        {env.length > 0 ? (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {env.map((e, i) => (
              <span key={i} className="rounded bg-canvas px-1.5 py-0.5 font-mono text-[10px] text-body border border-hairline">{e}</span>
            ))}
          </div>
        ) : (
          <div className="mt-1 text-xs text-muted-soft">없음</div>
        )}
      </div>
    </div>
  );
}
