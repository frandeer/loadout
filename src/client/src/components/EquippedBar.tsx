import { useState, useCallback, useRef, useEffect } from "react";
import { useStore } from "../hooks/useStore";
import { RARITY_CONFIG } from "../types";
import { Icon } from "./Icon";

export function EquippedBar() {
  const items = useStore((s) => s.items);
  const setSelected = useStore((s) => s.setSelected);
  const presets = useStore((s) => s.presets);
  const loadPreset = useStore((s) => s.loadPreset);
  const savePreset = useStore((s) => s.savePreset);
  const [presetOpen, setPresetOpen] = useState(false);
  const presetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (presetRef.current && !presetRef.current.contains(e.target as Node)) {
        setPresetOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);
  const [saving, setSaving] = useState(false);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);

  const equipped = items.filter((i) => i.equipped);
  const totalPower = equipped.reduce((sum, i) => sum + i.score, 0);
  const shown = equipped.slice(0, 5);
  const overflow = equipped.length - shown.length;
  const presetList = Object.entries(presets);

  const activePresetName = activePresetId ? presets[activePresetId]?.name : null;

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const name = prompt("팀 편성 이름을 입력하세요:", `팀 ${presetList.length + 1}`);
      if (!name) { setSaving(false); return; }
      const id = await savePreset(name);
      setActivePresetId(id);
    } finally {
      setSaving(false);
    }
  }, [savePreset, presetList.length]);

  const handleLoadPreset = useCallback((id: string) => {
    loadPreset(id);
    setActivePresetId(id);
    setPresetOpen(false);
  }, [loadPreset]);

  if (equipped.length === 0) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-canvas/95 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1800px] items-center gap-4 px-5 h-16">
        {/* 프리셋 드롭다운 */}
        <div className="shrink-0 flex items-center gap-2.5">
          <span className="text-[11px] text-muted-soft hidden sm:inline">팀 편성</span>
          <div className="relative" ref={presetRef}>
            <button
              onClick={() => setPresetOpen(!presetOpen)}
              className="flex items-center gap-1.5 rounded-lg bg-surface-soft px-3 py-1.5 text-sm font-semibold text-ink transition hover:bg-hairline"
            >
              {activePresetName ?? `장착 ${equipped.length}개`}
              <Icon name="expand-arrow" size="xs" />
            </button>
            {presetOpen && (
              <div className="absolute bottom-full left-0 mb-1 w-56 rounded-lg border border-hairline bg-canvas py-1 shadow-lg">
                {presetList.length === 0 && (
                  <div className="px-3 py-2 text-xs text-muted">저장된 프리셋 없음</div>
                )}
                {presetList.map(([id, p]) => (
                  <button
                    key={id}
                    onClick={() => handleLoadPreset(id)}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs transition hover:bg-surface-soft ${
                      id === activePresetId ? "text-primary font-semibold" : "text-body"
                    }`}
                  >
                    <span className="flex-1 truncate">{p.name}</span>
                    <span className="font-mono text-[10px] text-muted-soft">
                      {Object.values(p.slots).filter(Boolean).length}명
                    </span>
                    {id === activePresetId && <Icon name="check" size="xs" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 장착 칩 */}
        <div className="flex flex-1 items-center gap-2 overflow-x-auto">
          {shown.map((item) => {
            const r = RARITY_CONFIG[item.rarity];
            return (
              <button
                key={item.id}
                onClick={() => setSelected(item.id)}
                className="flex items-center gap-1.5 rounded-lg border border-hairline bg-canvas px-2.5 py-1.5 text-xs font-medium text-body transition hover:border-primary hover:bg-primary-soft shrink-0"
              >
                <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: r.color }} />
                <span className="max-w-[90px] truncate">{item.displayName}</span>
                <span className="rounded bg-surface-soft px-1 py-0.5 text-[8px] font-semibold uppercase text-muted">
                  {item.kind}
                </span>
              </button>
            );
          })}
          {overflow > 0 && (
            <span className="rounded-lg bg-surface-soft px-2 py-1.5 text-xs font-medium text-muted shrink-0">
              +{overflow}개 더
            </span>
          )}
        </div>

        {/* 총 파워 + 저장 */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-baseline gap-1.5">
            <span className="text-xs text-muted-soft">총 파워</span>
            <span className="font-mono text-lg font-bold text-ink">{totalPower}</span>
            <span className="text-xs text-muted">pt</span>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            title="현재 작전 준비(팀 편성) 구성을 이름 붙여 저장합니다"
            className="flex items-center gap-1.5 rounded-[10px] bg-primary px-5 py-2.5 text-sm font-bold text-white transition hover:bg-primary-active disabled:opacity-50"
          >
            <Icon name="save" size="sm" />
            {saving ? "저장 중..." : "팀 편성 저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
