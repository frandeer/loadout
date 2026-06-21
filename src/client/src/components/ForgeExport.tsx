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
        <h3 className="text-sm font-semibold text-ink">풀 키트 내보내기 완료</h3>
        <button onClick={onBack} className="ml-auto rounded-md border border-hairline px-3 py-1.5 text-xs text-body hover:bg-surface-soft hover:text-ink">
          갤러리로
        </button>
      </div>

      <div className="rounded-xl border border-accent-emerald/30 bg-surface-success p-4 text-sm text-accent-emerald">
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
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">색상 팔레트</h4>
          <div className="flex flex-wrap gap-2">
            {tokens.colors.map((c) => (
              <div key={c} className="flex items-center gap-1.5 rounded border border-hairline bg-canvas px-2 py-1">
                <span className="h-4 w-4 rounded border border-hairline" style={{ background: c }} />
                <span className="font-mono text-[11px] text-muted">{c}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 폰트 토큰 */}
      {tokens.fonts.length > 0 && (
        <div className="mt-6">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">폰트</h4>
          <div className="flex flex-wrap gap-2">
            {tokens.fonts.map((f) => (
              <div key={f} className="rounded border border-hairline bg-canvas px-2 py-1">
                <span className="font-mono text-[11px] text-muted" style={{ fontFamily: f }}>{f}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 토큰 */}
      {Object.keys(tokens.customProps).length > 0 && (
        <div className="mt-6">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">디자인 토큰</h4>
          <div className="rounded-lg border border-hairline bg-surface-soft p-3 font-mono text-[11px]">
            {Object.entries(tokens.customProps).map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <span className="text-accent-orange">{k}</span>
                <span className="text-muted-soft">:</span>
                <span className="text-body">{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 미리보기 */}
      <div className="mt-6">
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">예제 미리보기</h4>
        <iframe src={files.exampleHtml} title="export-preview" className="h-96 w-full rounded-lg border border-hairline bg-canvas" />
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
      className="rounded-lg border border-hairline bg-canvas p-3 shadow-xs transition hover:border-accent-orange/40 hover:shadow-sm"
    >
      <div className="font-mono text-xs text-accent-orange">{label}</div>
      <div className="mt-0.5 text-[11px] text-muted">{desc}</div>
    </a>
  );
}
