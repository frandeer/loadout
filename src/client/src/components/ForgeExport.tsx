import type { ForgeExportResult } from "../types/forge";

interface Props {
  result: ForgeExportResult;
  onBack: () => void;
}

export function ForgeExport({ result, onBack }: Props) {
  const { files, tokens } = result;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center gap-3">
        <h3 className="text-sm font-semibold text-white">풀 키트 내보내기 완료</h3>
        <button onClick={onBack} className="ml-auto rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:text-white">
          갤러리로
        </button>
      </div>

      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm text-emerald-300">
        ✓ 기준 변형 <code className="font-mono">{result.chosenId}</code> 에서 디자인 키트를 생성했습니다.
      </div>

      {/* 다운로드 링크 */}
      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <FileLink href={files.designMd} label="DESIGN.md" desc="디자인 명세" />
        <FileLink href={files.variablesCss} label="variables.css" desc="CSS 토큰" />
        <FileLink href={files.exampleHtml} label="example.html" desc="예제 HTML" />
      </div>

      {/* 색상 팔레트 */}
      {tokens.colors.length > 0 && (
        <div className="mt-6">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">색상 팔레트</h4>
          <div className="flex flex-wrap gap-2">
            {tokens.colors.map((c) => (
              <div key={c} className="flex items-center gap-1.5 rounded border border-zinc-800 bg-zinc-900 px-2 py-1">
                <span className="h-4 w-4 rounded border border-zinc-700" style={{ background: c }} />
                <span className="font-mono text-[11px] text-zinc-400">{c}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 토큰 */}
      {Object.keys(tokens.customProps).length > 0 && (
        <div className="mt-6">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">디자인 토큰</h4>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 font-mono text-[11px]">
            {Object.entries(tokens.customProps).map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <span className="text-amber-400">{k}</span>
                <span className="text-zinc-500">:</span>
                <span className="text-zinc-300">{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 미리보기 */}
      <div className="mt-6">
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">예제 미리보기</h4>
        <iframe src={files.exampleHtml} title="export-preview" className="h-96 w-full rounded-lg border border-zinc-800 bg-white" />
      </div>
    </div>
  );
}

function FileLink({ href, label, desc }: { href: string; label: string; desc: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="rounded-lg border border-zinc-700 bg-zinc-900 p-3 transition hover:border-amber-500/50"
    >
      <div className="font-mono text-xs text-amber-300">{label}</div>
      <div className="mt-0.5 text-[11px] text-zinc-500">{desc}</div>
    </a>
  );
}
