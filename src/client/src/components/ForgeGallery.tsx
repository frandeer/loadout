import { useState } from "react";
import type { ForgeSession, ForgeVariant } from "../types/forge";

interface Props {
  session: ForgeSession;
  eliminated: Set<string>;
  onEliminate: (id: string) => void;
  onRestore: (id: string) => void;
  onStartPairwise: () => void;
  onExport: (variantId?: string) => void;
  // 새 변형(성공) 또는 null(실패)을 돌려준다 — 카드가 await 해 진행 표시를 띄우고,
  // 실패 시 패널·지시를 보존해 바로 재시도하게 한다(H#4).
  onRefine: (variantId: string, instructions: string) => void | Promise<ForgeVariant | null>;
  busy: boolean;
}

const KIND_LABEL: Record<string, string> = { html: "HTML", image: "이미지", image2html: "이미지→HTML" };

export function ForgeGallery({
  session, eliminated, onEliminate, onRestore, onStartPairwise, onExport, onRefine, busy,
}: Props) {
  const variants = session.variants || [];
  const done = variants.filter((v) => v.status === "done");
  const live = done.filter((v) => !eliminated.has(v.id));
  const generating = session.status === "generating" || variants.some((v) => v.status === "pending" || v.status === "running");

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="text-sm text-muted">
          {generating ? (
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-accent-orange" />
              생성 중… {done.length}/{variants.length}
            </span>
          ) : (
            <span>{live.length}개 변형 · {eliminated.size > 0 ? `${eliminated.size}개 탈락` : "모두 후보"}</span>
          )}
        </div>
        <div className="ml-auto flex gap-2">
          <button
            onClick={onStartPairwise}
            disabled={live.length < 2}
            className="h-8 rounded-md border border-accent-orange/40 bg-accent-orange-soft px-3 text-xs font-medium text-accent-orange transition hover:opacity-80 disabled:opacity-40"
          >
            A/B 비교 ({live.length})
          </button>
          <button
            onClick={() => onExport()}
            disabled={!live.some((v) => v.file?.endsWith(".html"))}
            className="h-8 rounded-md border border-hairline bg-canvas px-3 text-xs text-body hover:bg-surface-soft disabled:opacity-40"
          >
            풀 키트 내보내기
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {variants.map((v) => (
          <VariantCard
            key={v.id}
            v={v}
            eliminated={eliminated.has(v.id)}
            onEliminate={() => onEliminate(v.id)}
            onRestore={() => onRestore(v.id)}
            onExport={() => onExport(v.id)}
            onRefine={(instr) => onRefine(v.id, instr)}
            busy={busy}
          />
        ))}
      </div>
    </div>
  );
}

function VariantCard({
  v, eliminated, onEliminate, onRestore, onExport, onRefine, busy,
}: {
  v: ForgeVariant;
  eliminated: boolean;
  onEliminate: () => void;
  onRestore: () => void;
  onExport: () => void;
  onRefine: (instructions: string) => void | Promise<ForgeVariant | null>;
  busy: boolean;
}) {
  const [refineOpen, setRefineOpen] = useState(false);
  const [instr, setInstr] = useState("");
  const [refining, setRefining] = useState(false); // 이 카드의 개선 생성 진행 중 — 멈춘 듯 보이는 문제 해소(H#4)
  const isHtml = v.file?.endsWith(".html");

  // 개선 생성 — 패널을 바로 닫지 않고 await 하며 진행 표시를 띄운다.
  // 성공(새 변형 반환)에만 패널을 닫고 지시를 비운다. 실패(null)면 지시를 보존해 바로 재시도(에러는 상단 배너).
  const submitRefine = async () => {
    if (!instr.trim() || refining) return;
    setRefining(true);
    try {
      const result = await onRefine(instr);
      if (result) {
        setRefineOpen(false);
        setInstr("");
      }
    } finally {
      setRefining(false);
    }
  };

  return (
    <div
      className={`overflow-hidden rounded-xl border bg-canvas shadow-xs transition ${
        eliminated ? "border-hairline opacity-40" : "border-hairline hover:border-hairline-strong hover:shadow-sm"
      }`}
    >
      {/* 미리보기 */}
      <div className="relative h-44 overflow-hidden border-b border-hairline bg-surface-soft">
        {v.status === "done" && v.file ? (
          isHtml ? (
            <iframe
              src={v.file}
              title={v.id}
              // 신뢰 불가한 CLI 생성 HTML — 동일 출처 권한 제거(allow-same-origin 제외).
              // 스크립트/애니메이션 렌더는 유지하되 앱 localStorage·top 내비·동일 출처 fetch는 차단.
              sandbox="allow-scripts"
              className="pointer-events-none h-[176px] w-full origin-top-left"
              style={{ width: "200%", height: "352px", transform: "scale(0.5)" }}
            />
          ) : (
            <img src={v.file} alt={v.id} className="h-full w-full object-cover" />
          )
        ) : v.status === "error" ? (
          <div className="flex h-full items-center justify-center p-3 text-center text-xs text-accent-rose">
            ⚠ {v.error || "생성 실패"}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted">
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-accent-orange" />
              {v.status === "running" ? "생성 중…" : "대기 중"}
            </span>
          </div>
        )}
        <span className="absolute left-2 top-2 rounded bg-ink/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
          {KIND_LABEL[v.kind] || v.kind}
        </span>
        {v.status === "done" && (
          <span className="absolute right-2 top-2 rounded bg-accent-orange-soft px-1.5 py-0.5 text-[10px] font-bold text-accent-orange">
            Elo {v.elo}
          </span>
        )}
      </div>

      {/* 메타 + 액션 */}
      <div className="space-y-2 p-3">
        <div className="flex flex-wrap gap-1 text-[10px] text-muted">
          <Badge>{v.engine}</Badge>
          {v.strategy && <Badge>{v.strategy}</Badge>}
          {v.style && <Badge>{v.style}</Badge>}
          {v.derivedFrom && <Badge>↳ 개선본</Badge>}
        </div>
        {v.status === "done" && (
          <div className="flex items-center gap-2 text-[10px] text-muted-soft">
            <span>{(v.fileSize / 1024).toFixed(1)}KB</span>
            <span>· {(v.generationTimeMs / 1000).toFixed(1)}s</span>
            <span>· {v.wins}승 {v.losses}패</span>
          </div>
        )}

        <div className="flex gap-1.5">
          {v.status === "done" && v.file && (
            <a
              href={v.file}
              target="_blank"
              rel="noreferrer"
              className="flex-1 rounded border border-hairline py-1 text-center text-[11px] text-body hover:bg-surface-soft hover:text-ink"
            >
              열기
            </a>
          )}
          {eliminated ? (
            <button onClick={onRestore} className="flex-1 rounded border border-hairline py-1 text-[11px] text-body hover:bg-surface-soft hover:text-ink">
              복구
            </button>
          ) : (
            v.status === "done" && (
              <button onClick={onEliminate} className="flex-1 rounded border border-hairline py-1 text-[11px] text-accent-rose hover:bg-accent-rose/5">
                탈락
              </button>
            )
          )}
          {v.status === "done" && isHtml && (
            <button onClick={onExport} className="rounded border border-accent-orange/30 px-2 py-1 text-[11px] text-accent-orange hover:bg-accent-orange-soft">
              ★키트
            </button>
          )}
        </div>

        {v.status === "done" && (
          refining ? (
            <div className="flex items-center gap-2 rounded border border-accent-orange/30 bg-accent-orange-soft px-2 py-1.5 text-[11px] text-accent-orange">
              <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-accent-orange" />
              개선본 생성 중… 완료되면 새 변형 카드로 추가됩니다
            </div>
          ) : refineOpen ? (
            <div className="space-y-1.5">
              <textarea
                value={instr}
                onChange={(e) => setInstr(e.target.value)}
                placeholder="개선 지시 (예: 여백을 넓히고 색을 더 차분하게)"
                rows={2}
                className="w-full rounded border border-hairline bg-canvas p-1.5 text-[11px] text-ink placeholder:text-muted-soft focus:border-primary focus:outline-none"
              />
              <div className="flex gap-1.5">
                <button
                  onClick={submitRefine}
                  disabled={busy || !instr.trim()}
                  className="flex-1 rounded bg-accent-orange-soft py-1 text-[11px] text-accent-orange disabled:opacity-40"
                >
                  개선 생성
                </button>
                <button onClick={() => { setRefineOpen(false); setInstr(""); }} className="rounded border border-hairline px-2 py-1 text-[11px] text-muted">
                  취소
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setRefineOpen(true)} className="w-full rounded border border-dashed border-hairline py-1 text-[11px] text-muted hover:text-body">
              + 이 변형으로 개선
            </button>
          )
        )}
      </div>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="rounded bg-surface-soft px-1.5 py-0.5 text-muted">{children}</span>;
}
