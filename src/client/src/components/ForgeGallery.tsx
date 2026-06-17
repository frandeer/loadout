import { useState } from "react";
import type { ForgeSession, ForgeVariant } from "../types/forge";

interface Props {
  session: ForgeSession;
  eliminated: Set<string>;
  onEliminate: (id: string) => void;
  onRestore: (id: string) => void;
  onStartPairwise: () => void;
  onExport: (variantId?: string) => void;
  onRefine: (variantId: string, instructions: string) => void;
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
        <div className="text-sm text-zinc-400">
          {generating ? (
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
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
            className="h-8 rounded-md border border-amber-500/50 bg-amber-500/20 px-3 text-xs font-medium text-amber-300 transition hover:bg-amber-500/30 disabled:opacity-40"
          >
            A/B 비교 ({live.length})
          </button>
          <button
            onClick={() => onExport()}
            disabled={!live.some((v) => v.file?.endsWith(".html"))}
            className="h-8 rounded-md border border-zinc-700 bg-zinc-900 px-3 text-xs text-zinc-300 hover:text-white disabled:opacity-40"
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
  onRefine: (instructions: string) => void;
  busy: boolean;
}) {
  const [refineOpen, setRefineOpen] = useState(false);
  const [instr, setInstr] = useState("");
  const isHtml = v.file?.endsWith(".html");

  return (
    <div
      className={`overflow-hidden rounded-xl border bg-zinc-900 transition ${
        eliminated ? "border-zinc-800 opacity-40" : "border-zinc-700 hover:border-zinc-600"
      }`}
    >
      {/* 미리보기 */}
      <div className="relative h-44 overflow-hidden border-b border-zinc-800 bg-zinc-950">
        {v.status === "done" && v.file ? (
          isHtml ? (
            <iframe
              src={v.file}
              title={v.id}
              className="pointer-events-none h-[176px] w-full origin-top-left"
              style={{ width: "200%", height: "352px", transform: "scale(0.5)" }}
            />
          ) : (
            <img src={v.file} alt={v.id} className="h-full w-full object-cover" />
          )
        ) : v.status === "error" ? (
          <div className="flex h-full items-center justify-center p-3 text-center text-xs text-rose-400">
            ⚠ {v.error || "생성 실패"}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-zinc-500">
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
              {v.status === "running" ? "생성 중…" : "대기 중"}
            </span>
          </div>
        )}
        <span className="absolute left-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-zinc-200">
          {KIND_LABEL[v.kind] || v.kind}
        </span>
        {v.status === "done" && (
          <span className="absolute right-2 top-2 rounded bg-amber-500/80 px-1.5 py-0.5 text-[10px] font-bold text-black">
            Elo {v.elo}
          </span>
        )}
      </div>

      {/* 메타 + 액션 */}
      <div className="space-y-2 p-3">
        <div className="flex flex-wrap gap-1 text-[10px] text-zinc-400">
          <Badge>{v.engine}</Badge>
          {v.strategy && <Badge>{v.strategy}</Badge>}
          {v.style && <Badge>{v.style}</Badge>}
          {v.derivedFrom && <Badge>↳ 개선본</Badge>}
        </div>
        {v.status === "done" && (
          <div className="flex items-center gap-2 text-[10px] text-zinc-500">
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
              className="flex-1 rounded border border-zinc-700 py-1 text-center text-[11px] text-zinc-300 hover:text-white"
            >
              열기
            </a>
          )}
          {eliminated ? (
            <button onClick={onRestore} className="flex-1 rounded border border-zinc-700 py-1 text-[11px] text-zinc-300 hover:text-white">
              복구
            </button>
          ) : (
            v.status === "done" && (
              <button onClick={onEliminate} className="flex-1 rounded border border-zinc-700 py-1 text-[11px] text-rose-300 hover:bg-rose-500/10">
                탈락
              </button>
            )
          )}
          {v.status === "done" && isHtml && (
            <button onClick={onExport} className="rounded border border-zinc-700 px-2 py-1 text-[11px] text-amber-300 hover:bg-amber-500/10">
              ★키트
            </button>
          )}
        </div>

        {v.status === "done" && (
          refineOpen ? (
            <div className="space-y-1.5">
              <textarea
                value={instr}
                onChange={(e) => setInstr(e.target.value)}
                placeholder="개선 지시 (예: 여백을 넓히고 색을 더 차분하게)"
                rows={2}
                className="w-full rounded border border-zinc-700 bg-zinc-950 p-1.5 text-[11px] text-white placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none"
              />
              <div className="flex gap-1.5">
                <button
                  onClick={() => { onRefine(instr); setRefineOpen(false); setInstr(""); }}
                  disabled={busy || !instr.trim()}
                  className="flex-1 rounded bg-amber-500/20 py-1 text-[11px] text-amber-300 disabled:opacity-40"
                >
                  개선 생성
                </button>
                <button onClick={() => setRefineOpen(false)} className="rounded border border-zinc-700 px-2 py-1 text-[11px] text-zinc-400">
                  취소
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setRefineOpen(true)} className="w-full rounded border border-dashed border-zinc-700 py-1 text-[11px] text-zinc-400 hover:text-zinc-200">
              + 이 변형으로 개선
            </button>
          )
        )}
      </div>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="rounded bg-zinc-800 px-1.5 py-0.5">{children}</span>;
}
