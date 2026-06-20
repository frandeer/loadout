import { useEffect, useState } from "react";
import { useForge } from "../hooks/useForge";
import { ForgeGallery } from "./ForgeGallery";
import { ForgePairwise } from "./ForgePairwise";
import { ForgeExport } from "./ForgeExport";

export function Forge() {
  const {
    caps, sessions, current, view, exportResult, busy, error,
    init, openSession, newSession, setView, recordMatch, refine, doExport, remove, back,
  } = useForge();

  const [eliminated, setEliminated] = useState<Set<string>>(new Set());
  // 세션이 바뀌면 탈락 목록 초기화 — 렌더 중 상태 보정(React 공식 패턴, effect 불필요)
  const [prevId, setPrevId] = useState<string | undefined>(current?.id);
  if (current?.id !== prevId) { setPrevId(current?.id); setEliminated(new Set()); }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { init(); }, []);

  const eliminate = (id: string) => setEliminated((s) => new Set(s).add(id));
  const restore = (id: string) => setEliminated((s) => { const n = new Set(s); n.delete(id); return n; });

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-4">
      {error && (
        <div className="mb-3 rounded-lg border border-accent-rose/30 bg-accent-rose/10 px-3 py-2 text-xs text-accent-rose">
          {error}
        </div>
      )}

      {!current ? (
        <SessionList
          sessions={sessions}
          caps={caps}
          busy={busy}
          onOpen={openSession}
          onCreate={newSession}
          onRemove={remove}
        />
      ) : (
        <div>
          <div className="mb-4 flex items-center gap-3">
            <button onClick={back} className="rounded-md border border-hairline px-2.5 py-1 text-xs text-muted hover:text-ink">
              ← 세션 목록
            </button>
            <h2 className="truncate text-sm font-semibold text-ink">{current.title}</h2>
          </div>

          {view === "pairwise" ? (
            <ForgePairwise
              session={current}
              eliminated={eliminated}
              onMatch={recordMatch}
              onDone={() => setView("gallery")}
            />
          ) : view === "export" && exportResult ? (
            <ForgeExport result={exportResult} onBack={() => setView("gallery")} />
          ) : (
            <ForgeGallery
              session={current}
              eliminated={eliminated}
              onEliminate={eliminate}
              onRestore={restore}
              onStartPairwise={() => setView("pairwise")}
              onExport={(vid) => doExport(vid)}
              onRefine={(vid, instr) => refine(vid, instr)}
              busy={busy}
            />
          )}
        </div>
      )}
    </div>
  );
}

function SessionList({
  sessions, caps, busy, onOpen, onCreate, onRemove,
}: {
  sessions: ReturnType<typeof useForge.getState>["sessions"];
  caps: ReturnType<typeof useForge.getState>["caps"];
  busy: boolean;
  onOpen: (id: string) => void;
  onCreate: (prompt: string, opts?: { style?: string }) => void;
  onRemove: (id: string) => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState<string>("");

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
      {/* 새 세션 */}
      <div className="order-2 lg:order-1">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">세션 ({sessions.length})</h3>
        {sessions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-hairline py-12 text-center text-sm text-muted">
            아직 세션이 없습니다. 디자인을 설명하고 새 세션을 시작하세요.
          </div>
        ) : (
          <div className="space-y-2">
            {sessions.map((s) => (
              <div key={s.id} className="flex items-center gap-3 rounded-lg border border-hairline bg-canvas px-3 py-2.5 shadow-xs">
                <button onClick={() => onOpen(s.id)} className="flex-1 text-left">
                  <div className="truncate text-sm text-body">{s.title}</div>
                  <div className="mt-0.5 text-[11px] text-muted">
                    {s.variantCount}개 변형 · <StatusBadge status={s.status} />
                  </div>
                </button>
                <button
                  onClick={() => onRemove(s.id)}
                  className="rounded border border-hairline px-2 py-1 text-[11px] text-muted hover:text-accent-rose"
                >
                  삭제
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 새 생성 폼 */}
      <div className="order-1 lg:order-2">
        <div className="rounded-xl border border-hairline bg-canvas p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-ink">새 디자인 생성</h3>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="어떤 디자인을 원하나요? 예: SaaS 분석 도구의 가격 페이지. 다크 테마, 3개 요금제, 신뢰감 있는 톤."
            rows={5}
            className="w-full rounded-lg border border-hairline bg-canvas p-2.5 text-sm text-ink placeholder:text-muted-soft focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
          />

          <div className="mt-3">
            <label className="mb-1 block text-[11px] text-muted">스타일 프리셋 (선택 — 모든 변형 공통)</label>
            <div className="flex flex-wrap gap-1.5">
              <StyleChip active={style === ""} onClick={() => setStyle("")} label="자동(혼합)" />
              {caps?.styles.map((st) => (
                <StyleChip key={st.key} active={style === st.key} onClick={() => setStyle(st.key)} label={st.label} />
              ))}
            </div>
          </div>

          <button
            onClick={() => prompt.trim() && onCreate(prompt.trim(), style ? { style } : undefined)}
            disabled={busy || !prompt.trim()}
            className="mt-4 w-full rounded-lg bg-accent-orange py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
          >
            {busy ? "생성 시작 중…" : "8개 변형 병렬 생성"}
          </button>

          {caps && (
            <p className="mt-3 text-[11px] leading-relaxed text-muted-soft">
              엔진: {caps.clis.length ? caps.clis.join(", ") : "(CLI 없음)"} · 포지 이미지 변형 엔진: {caps.imageEngines.join(", ")}.
              HTML 변형은 CLI로, 이미지 변형은 로그인된 Chrome(CDP)로 생성됩니다.
              (카드 이미지 생성 엔진은 설정에서 별도 관리합니다.)
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    created: "text-muted", generating: "text-accent-orange", ready: "text-accent-emerald", error: "text-accent-rose",
  };
  const label: Record<string, string> = { created: "준비됨", generating: "생성 중", ready: "완료", error: "오류" };
  return <span className={map[status] || "text-muted"}>{label[status] || status}</span>;
}

function StyleChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md border px-2 py-1 text-[11px] transition ${
        active
          ? "border-accent-orange/40 bg-accent-orange-soft text-accent-orange"
          : "border-hairline bg-surface-soft text-muted hover:text-body"
      }`}
    >
      {label}
    </button>
  );
}
