import { useStore } from "../hooks/useStore";
import { Modal } from "./Modal";
import { Icon } from "./Icon";

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
}

type EngineKey = "codex-api" | "codex" | "chatgpt";

const ENGINE_OPTIONS: { key: EngineKey; title: string; desc: string; badge?: string }[] = [
  {
    key: "codex-api",
    title: "Codex API (gpt-image-2)",
    desc: "원격 API로 즉시 생성. 브라우저·Python 설치 없이 HTTP 한 번이면 끝. 가장 안정적이고 빠릅니다.",
    badge: "추천",
  },
  {
    key: "codex",
    title: "Codex CLI (gpt-image)",
    desc: "로컬 Codex CLI + Python 스크립트로 생성. 브라우저 자동화를 거치지 않아 안정적이지만 Python 환경이 필요합니다.",
  },
  {
    key: "chatgpt",
    title: "ChatGPT (브라우저)",
    desc: "로그인된 Chrome을 자동 조작해 생성. image-farm이 떠 있으면 재사용합니다. 사용량 차단/로그인 만료/타임아웃에 영향받을 수 있습니다.",
  },
];

export function SettingsPanel({ open, onClose }: SettingsPanelProps) {
  const imageEngine = useStore((s) => s.imageEngine);
  const setImageEngine = useStore((s) => s.setImageEngine);

  const selected: EngineKey = imageEngine === "codex-api" ? "codex-api" : imageEngine === "codex" ? "codex" : "chatgpt";

  return (
    <Modal open={open} onClose={onClose} title="설정">
      <div className="space-y-6">
        <section>
          <h4 className="mb-1 text-sm font-bold text-ink">이미지 생성 엔진</h4>
          <p className="mb-3 text-xs text-muted">
            카드 이미지를 어떤 방식으로 만들지 선택합니다. 여기서 바꾸면 다음 생성부터 바로 적용됩니다.
          </p>
          <div className="space-y-2">
            {ENGINE_OPTIONS.map((opt) => {
              const active = selected === opt.key;
              return (
                <button
                  key={opt.key}
                  onClick={() => setImageEngine(opt.key)}
                  className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition ${
                    active
                      ? "border-primary bg-primary-soft"
                      : "border-hairline bg-surface-soft hover:border-primary/40"
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                      active ? "border-primary" : "border-hairline"
                    }`}
                  >
                    {active && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}
                  </span>
                  <span className="flex-1">
                    <span className="flex items-center gap-2">
                      <span className={`text-sm font-bold ${active ? "text-primary" : "text-ink"}`}>
                        {opt.title}
                      </span>
                      {opt.badge && (
                        <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-white">
                          {opt.badge}
                        </span>
                      )}
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-muted">{opt.desc}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-soft">
            <Icon name="settings" size="xs" />
            현재 선택: <span className="font-semibold text-body">{imageEngine}</span>
          </p>
        </section>
      </div>
    </Modal>
  );
}
