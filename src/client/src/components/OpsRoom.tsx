import { useMemo, useState } from "react";
import { useStore } from "../hooks/useStore";
import { RARITY_CONFIG } from "../types";
import type { Item } from "../types";
import { ROLES, TRAITS, computeLinks, teamPower, teamCost, roleFit, traitsOf, LINK_THRESHOLDS, LINK_GRADES } from "../lib/traits";
import { api } from "../lib/api";
import { copyText } from "../lib/utils";
import { ManaGauge } from "./ManaGauge";
import { TeamEvalPanel } from "./TeamEvalPanel";
import { TeamAbPanel } from "./TeamAbPanel";
import { Modal } from "./Modal";
import { Icon } from "./Icon";
import type { TeamExportOmcResp } from "../types";

/* 작전 준비실 — BLACK-ORCHID 목업의 구현.
   5개 역할 슬롯에 자산을 배치하면 신호 링크(시너지)가 단계별 발동하고,
   팀 전투력이 실시간 갱신된다. 팀은 프리셋으로 저장/전환. */
export function OpsRoom() {
  const { items, slots, presets, assignSlot, savePreset, loadPreset, removePreset, reloadData, setSelected, engines } = useStore();
  const [pickingRole, setPickingRole] = useState<string | null>(null);
  const [teamName, setTeamName] = useState("");
  const [deploying, setDeploying] = useState(false);
  const [deployMsg, setDeployMsg] = useState("");
  const [swapArmed, setSwapArmed] = useState(false);
  const [exported, setExported] = useState(false);
  // /team 설정 내보내기 모드
  const [cfgBusy, setCfgBusy] = useState(false);
  const [cfgError, setCfgError] = useState("");
  const [cfgResult, setCfgResult] = useState<TeamExportOmcResp | null>(null);
  const [cfgTab, setCfgTab] = useState<"omc.jsonc" | "team-command.md">("omc.jsonc");
  const [cfgCopied, setCfgCopied] = useState(false);

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const members = ROLES.map((r) => slots[r.key] && byId.get(slots[r.key]!)).filter(Boolean) as Item[];
  const links = computeLinks(members);
  const power = teamPower(members);
  const cost = teamCost(members);
  const activeLinks = links.filter((l) => l.tier > 0);

  const displayName = (i: Item) => i.displayName;

  // OMC 팀 export — 현재 편성 + 발동 링크를 마크다운으로 클립보드 복사.
  const exportTeam = async () => {
    const roleByMember = new Map<string, string>();
    for (const role of ROLES) {
      const id = slots[role.key];
      if (id) roleByMember.set(id, role.label);
    }
    const lines: string[] = [];
    lines.push(`# 팀: ${teamName.trim() || "무제 작전"}`);
    lines.push(``, `## 구성`);
    for (const m of members) {
      const role = roleByMember.get(m.id) ?? "요원";
      const tr = traitsOf(m).map((t) => t.label).join("·") || "—";
      lines.push(`- ${role}: ${displayName(m)} (${m.kind}, 특성: ${tr})`);
    }
    if (activeLinks.length) {
      lines.push(``, `## 발동 시너지`);
      for (const l of activeLinks) {
        lines.push(`- ${l.trait.label} ${l.count}/${l.next ?? LINK_THRESHOLDS[LINK_THRESHOLDS.length - 1]} (${LINK_GRADES[l.tier - 1]}): ${l.trait.bonus[l.tier - 1]}`);
      }
    }
    lines.push(``, `## 사용법`);
    lines.push(`claude에서 위 자산 장착 후 다중 에이전트 파이프라인에 역할별로 배정.`);
    await copyText(lines.join("\n"));
    setExported(true);
    setTimeout(() => setExported(false), 2000);
  };

  // /team 설정 내보내기 — 저장된 팀 필요. 미저장 편성이면 자동 저장 후 변환 요청.
  const exportConfig = async () => {
    if (!members.length || cfgBusy) return;
    setCfgBusy(true);
    setCfgError("");
    try {
      // 현재 편성이 이미 저장된 프리셋과 동일하면 그 id를 재사용(중복 자동 저장 방지).
      const slotsEqual = (a: typeof slots) => ROLES.every((r) => (a[r.key] ?? null) === (slots[r.key] ?? null));
      const existing = Object.entries(presets).find(([, p]) => slotsEqual(p.slots));
      // 없으면 "(자동 저장)" 표식으로 새로 저장 — 서버 저장 완료까지 await(레이스 방지).
      const id = existing
        ? existing[0]
        : await savePreset(`${teamName.trim() || "무제 작전"} (자동 저장)`);
      const resp = await api.teamExportOmc(id);
      if (resp.ok && resp.files) {
        setCfgResult(resp);
        setCfgTab("omc.jsonc");
      } else {
        setCfgError(resp.error || "설정 내보내기에 실패했습니다");
      }
    } catch {
      setCfgError("내보내기 요청이 실패했습니다 — 서버 상태를 확인하세요");
    } finally {
      setCfgBusy(false);
    }
  };

  const copyCfgTab = async () => {
    if (!cfgResult) return;
    await copyText(cfgResult.files[cfgTab]);
    setCfgCopied(true);
    setTimeout(() => setCfgCopied(false), 2000);
  };

  // 팀 투입: 슬롯 멤버 중 미장착을 일괄 장착(MCP는 서버가 기록만 — 그대로 통과)
  const deploy = async () => {
    if (!members.length || deploying) return;
    setDeploying(true);
    setDeployMsg("");
    let ok = 0, fail = 0;
    for (const m of members) {
      if (m.equipped) { ok++; continue; }
      try { await api.equip(m.id); ok++; }
      catch { fail++; }
    }
    await reloadData();
    setDeployMsg(fail ? `${ok}명 투입 · ${fail}명 실패` : `${ok}명 전원 투입 완료`);
    setDeploying(false);
  };

  // 작전 전환: 팀 외 장착 자산 전원 철수 + 팀 일괄 투입 (상주 자산은 건드리지 않음)
  const swapDeploy = async () => {
    if (!members.length || deploying) return;
    if (!swapArmed) { setSwapArmed(true); return; }
    setSwapArmed(false);
    setDeploying(true);
    setDeployMsg("");
    const memberIds = new Set(members.map((m) => m.id));
    const outsiders = items.filter((i) => i.equipped && !i.installed && !memberIds.has(i.id));
    let off = 0, on = 0, fail = 0;
    for (const o of outsiders) {
      try { await api.unequip(o.id); off++; } catch { fail++; }
    }
    for (const m of members) {
      if (m.equipped) { on++; continue; }
      try { await api.equip(m.id); on++; } catch { fail++; }
    }
    await reloadData();
    setDeployMsg(`전환 완료 — 철수 ${off} · 투입 ${on}${fail ? ` · 실패 ${fail}` : ""}`);
    setDeploying(false);
  };

  // 커버리지: 핵심 작전 영역에 팀이 닿아 있는지 — 빈 영역은 결핍 경고
  const CORE_KEYS = ["build", "recon", "audit", "archive", "plan", "deploy"];
  const coveredKeys = new Set(members.flatMap((m) => traitsOf(m).map((t) => t.key)));

  return (
    <main className="mx-auto max-w-[1800px] px-5 py-5">
      {/* 작전 헤더 */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-wide text-muted">
            작전 준비
          </div>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-ink">팀 편성</h2>
          <p className="mt-1 text-sm text-muted">
            자산을 역할 슬롯에 배치하면 신호 링크가 연결되고 팀 전투력이 갱신됩니다.
          </p>
        </div>
        <div className="flex items-center gap-6">
          <Metric label="편성 인원" value={`${members.length}/${ROLES.length}`} />
          <Metric label="발동 링크" value={`${activeLinks.length}`} accent />
          <div className="rounded-xl border border-hairline bg-canvas px-5 py-2.5">
            <div className="text-right">
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted">Team Power</div>
              <div className="font-mono text-2xl font-semibold text-accent-orange">
                {power.total.toLocaleString()}
                {power.bonus > 0 && (
                  <span className="ml-1.5 text-xs text-accent-emerald">+{power.bonus}</span>
                )}
              </div>
            </div>
            <div className="mt-2 w-44">
              <ManaGauge cost={cost} />
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        <div>
          {/* 역할 슬롯 */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            {ROLES.map((role) => {
              const id = slots[role.key];
              const item = id ? byId.get(id) : undefined;
              const r = item ? RARITY_CONFIG[item.rarity] : null;
              return (
                <div
                  key={role.key}
                  onClick={() => setPickingRole(pickingRole === role.key ? null : role.key)}
                  className={`cursor-pointer rounded-xl border bg-canvas p-3 transition hover:border-hairline-strong ${
                    pickingRole === role.key ? "border-primary ring-2 ring-primary/10" : "border-hairline"
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="rounded-md bg-primary-soft px-1.5 py-0.5 text-[10px] font-bold text-primary">
                      {role.label}
                    </span>
                    {item && (
                      <button
                        onClick={(e) => { e.stopPropagation(); assignSlot(role.key, null); }}
                        className="text-[10px] text-muted hover:text-accent-rose"
                        title="슬롯 비우기"
                      >
                        해제
                      </button>
                    )}
                  </div>
                  {item ? (
                    <>
                      <div className="truncate text-sm font-semibold text-ink" title={displayName(item)}>
                        {displayName(item)}
                      </div>
                      <div className="mt-1 flex items-center gap-1.5">
                        <span className="text-[9px] font-bold" style={{ color: r!.color }}>{r!.ko}</span>
                        <span className="font-mono text-[9px] text-muted-soft">{item.score}pt</span>
                        {!item.equipped && <span className="text-[9px] text-accent-rose">미장착</span>}
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {traitsOf(item).slice(0, 3).map((t) => (
                          <span key={t.key} className="rounded-full bg-surface-soft px-1.5 py-px text-[9px] text-muted">
                            {t.label}
                          </span>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="py-2">
                      <div className="text-sm font-medium text-muted">빈 슬롯</div>
                      <div className="mt-0.5 text-[11px] text-muted-soft">{role.desc} — 클릭해 배치</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 요원 선택기 */}
          {pickingRole && (
            <SlotPicker
              role={pickingRole}
              onPick={(id) => { assignSlot(pickingRole, id); setPickingRole(null); }}
              onClose={() => setPickingRole(null)}
            />
          )}

          {/* 커버리지 매트릭스 */}
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-hairline bg-surface-soft px-3 py-2">
            <span className="text-[10px] font-bold uppercase tracking-wide text-muted">커버리지</span>
            {CORE_KEYS.map((key) => {
              const trait = TRAITS.find((t) => t.key === key)!;
              const ok = coveredKeys.has(key);
              return (
                <span
                  key={key}
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    ok ? "bg-surface-success text-accent-emerald" : "bg-accent-rose/10 text-accent-rose"
                  }`}
                  title={ok ? "팀이 이 영역을 커버합니다" : "이 영역을 커버하는 자산이 없습니다"}
                >
                  {trait.label} {ok ? "✓" : "—"}
                </span>
              );
            })}
          </div>

          {/* 투입 라인 */}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              onClick={deploy}
              disabled={!members.length || deploying}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-6 py-2.5 text-sm font-bold text-white transition hover:bg-primary-active disabled:opacity-40"
            >
              <Icon name="rocket" size="sm" className="text-white" />
              {deploying ? "투입 중..." : "팀 투입 — ~/.claude 일괄 장착"}
            </button>
            <button
              onClick={swapDeploy}
              onBlur={() => setSwapArmed(false)}
              disabled={!members.length || deploying}
              className={`rounded-lg border px-4 py-2.5 text-sm font-medium transition disabled:opacity-40 ${
                swapArmed
                  ? "border-accent-rose bg-accent-rose/10 text-accent-rose"
                  : "border-hairline text-body hover:bg-surface-soft"
              }`}
              title="팀 외 장착 자산을 모두 철수하고 이 팀만 투입합니다"
            >
              {swapArmed ? "확인 — 팀 외 전원 철수 + 교체 투입" : "작전 전환"}
            </button>
            <div className="flex items-stretch rounded-lg overflow-hidden">
              <button
                onClick={exportTeam}
                disabled={!members.length}
                className="border border-accent-orange/40 bg-accent-orange-soft px-4 py-2.5 text-xs font-semibold text-accent-orange transition hover:bg-accent-orange/15 disabled:opacity-40"
                title="현재 편성을 마크다운으로 클립보드에 복사"
              >
                <Icon name="clipboard" size="xs" /> {exported ? "복사됨 ✓" : "마크다운 복사"}
              </button>
              <button
                onClick={exportConfig}
                disabled={!members.length || cfgBusy}
                className="border border-l-0 border-accent-orange/40 bg-accent-orange-soft px-4 py-2.5 text-xs font-semibold text-accent-orange transition hover:bg-accent-orange/15 disabled:opacity-40"
                title="현재 편성을 저장하고 /team 파이프라인 설정 파일(omc.jsonc·team-command.md)로 내보냅니다"
              >
                <Icon name="external-link" size="xs" /> {cfgBusy ? "변환 중..." : "/team 설정 내보내기"}
              </button>
            </div>
            {deployMsg && <span className="text-xs font-medium text-accent-emerald">{deployMsg}</span>}
            {cfgError && <span className="text-xs font-medium text-accent-rose">{cfgError}</span>}

            <div className="ml-auto flex items-center gap-2">
              <input
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="팀 이름 — 예: 강력한 코딩팀"
                className="h-9 w-52 rounded-lg border border-hairline bg-canvas px-3 text-sm text-ink placeholder:text-muted-soft focus:border-primary focus:outline-none"
              />
              <button
                onClick={() => { if (teamName.trim()) { savePreset(teamName.trim()); setTeamName(""); } }}
                disabled={!teamName.trim() || !members.length}
                className="flex items-center gap-1.5 rounded-lg border border-hairline px-4 py-2 text-sm font-medium text-body transition hover:bg-surface-soft disabled:opacity-40"
              >
                <Icon name="save" size="sm" /> 작전 저장
              </button>
            </div>
          </div>

          {/* 팀 프리셋 */}
          {Object.keys(presets).length > 0 && (
            <div className="mt-5">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">저장된 작전</h3>
              <div className="flex flex-wrap gap-2">
                {Object.entries(presets).sort((a, b) => b[1].at - a[1].at).map(([id, p]) => {
                  const pm = Object.values(p.slots).filter(Boolean).map((mid) => byId.get(mid!)).filter(Boolean) as Item[];
                  const pp = teamPower(pm);
                  return (
                    <div key={id} className="group flex items-center gap-3 rounded-lg border border-hairline bg-canvas px-3 py-2 transition hover:border-primary">
                      <button onClick={() => loadPreset(id)} className="text-left" title="이 팀 불러오기">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-semibold text-ink group-hover:text-primary">{p.name}</span>
                          {typeof p.elo === "number" && (
                            <span className="rounded-full bg-accent-orange-soft px-1.5 py-px text-[9px] font-semibold text-accent-orange" title="A/B 대전 누적 Elo">
                              Elo {p.elo}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-muted">
                          {pm.length}명 · {pp.total.toLocaleString()}pt
                        </div>
                      </button>
                      <button onClick={() => removePreset(id)} className="text-[10px] text-muted hover:text-accent-rose" title="삭제">
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 팀 단위 AI 평가 — 역할명→itemId 맵으로 전달(서버 평가 프롬프트가 역할명 사용) */}
          <TeamEvalPanel
            slots={Object.fromEntries(ROLES.map((r) => [r.label, slots[r.key] ?? null]))}
            engines={engines}
          />

          {/* 저장된 작전 2개를 같은 시나리오로 교전 — 승패·Elo 변동 */}
          <TeamAbPanel engines={engines} />
        </div>

        {/* 신호 링크 트래커 */}
        <aside className="h-fit rounded-xl border border-hairline bg-canvas p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-sm font-bold text-primary">
            <Icon name="linked-nodes" size="sm" /> 신호 링크
          </h3>
            <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-semibold text-primary">{activeLinks.length} ACTIVE</span>
          </div>
          {links.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted">
              자산을 배치하면 링크 신호가 잡힙니다
            </p>
          ) : (
            <div className="space-y-2">
              {links.map((l) => (
                <div
                  key={l.trait.key}
                  className={`rounded-lg border px-3 py-2 ${l.tier > 0 ? "border-primary/30 bg-primary-soft" : "border-hairline bg-surface-soft"}`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-semibold ${l.tier > 0 ? "text-primary" : "text-muted"}`}>
                      {l.trait.label}
                      {l.tier > 0 && (
                        <span className="ml-1.5 text-[9px] font-bold text-accent-orange">{LINK_GRADES[l.tier - 1]}</span>
                      )}
                    </span>
                    <span className="font-mono text-[11px] text-muted-soft">
                      {l.count}/{l.next ?? LINK_THRESHOLDS[LINK_THRESHOLDS.length - 1]}
                    </span>
                  </div>
                  <div className="mt-1.5 flex gap-0.5">
                    {Array.from({ length: LINK_THRESHOLDS[LINK_THRESHOLDS.length - 1] }, (_, i) => (
                      <div
                        key={i}
                        className="h-1.5 flex-1 rounded-full"
                        style={{
                          backgroundColor: i < l.count ? "var(--color-primary)" : "var(--color-hairline)",
                          opacity: i < l.count ? (l.tier > 0 ? 1 : 0.5) : 1,
                        }}
                      />
                    ))}
                  </div>
                  <div className="mt-1 text-[10px] leading-relaxed text-muted">
                    {l.tier > 0 ? l.trait.bonus[l.tier - 1] : `${l.next! - l.count}개 더 배치하면 발동`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>

      {/* /team 설정 내보내기 결과 */}
      <Modal open={!!cfgResult} onClose={() => setCfgResult(null)} title="/team 설정 내보내기" wide>
        {cfgResult && (
          <div>
            <div className="mb-3 flex items-center gap-1 border-b border-hairline">
              {(["omc.jsonc", "team-command.md"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setCfgTab(tab)}
                  className={`-mb-px border-b-2 px-3 py-1.5 font-mono text-xs transition ${
                    cfgTab === tab
                      ? "border-primary text-primary"
                      : "border-transparent text-muted hover:text-ink"
                  }`}
                >
                  {tab}
                </button>
              ))}
              <button
                onClick={copyCfgTab}
                className="ml-auto rounded-lg bg-primary-soft px-3 py-1 text-[11px] font-semibold text-primary transition hover:bg-primary/15"
              >
                {cfgCopied ? "복사됨 ✓" : "복사"}
              </button>
            </div>
            <pre className="max-h-[55vh] overflow-auto rounded-lg border border-hairline bg-surface-soft p-3 font-mono text-[11px] leading-relaxed text-body">
              {cfgResult.files[cfgTab]}
            </pre>
            <div className="mt-2 text-[10px] text-muted">
              저장 경로: <span className="font-mono text-primary">{cfgResult.dir}</span>
            </div>
          </div>
        )}
      </Modal>
    </main>
  );

  /* 슬롯 요원 선택기 — 적성(역할 affinity) 순으로 정렬, 시너지 진행 배지 */
  function SlotPicker({ role, onPick, onClose }: { role: string; onPick: (id: string) => void; onClose: () => void }) {
    const [q, setQ] = useState("");
    const roleDef = ROLES.find((r) => r.key === role)!;
    const assigned = new Set(Object.values(slots).filter(Boolean) as string[]);

    const candidates = items
      .filter((i) => i.kind !== "memory") // 기억은 역할 배치 대상 아님(장착 개념 없음)
      .filter((i) => !assigned.has(i.id))
      .filter((i) => !q || `${i.name} ${i.nameKo ?? ""} ${i.description}`.toLowerCase().includes(q.toLowerCase()))
      .map((i) => ({ item: i, fit: roleFit(i, roleDef) }))
      .sort((a, b) => b.fit - a.fit || (b.item.equipped ? 1 : 0) - (a.item.equipped ? 1 : 0) || b.item.score - a.item.score)
      .slice(0, 30);

    return (
      <div className="mt-3 rounded-xl border border-primary/30 bg-canvas p-3 shadow-sm">
        <div className="mb-2 flex items-center gap-3">
          <span className="text-sm font-bold text-primary">{roleDef.label} 후보</span>
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="검색..."
            className="h-7 flex-1 rounded-lg border border-hairline bg-surface-soft px-2 text-xs text-ink placeholder:text-muted-soft focus:outline-none"
          />
          <button onClick={onClose} className="text-xs text-muted hover:text-ink"><Icon name="close" size="xs" /></button>
        </div>
        <div className="grid max-h-64 gap-1 overflow-y-auto md:grid-cols-2 xl:grid-cols-3">
          {candidates.map(({ item, fit }) => {
            const r = RARITY_CONFIG[item.rarity];
            return (
              <button
                key={item.id}
                onClick={() => onPick(item.id)}
                onDoubleClick={() => setSelected(item.id)}
                className="flex items-center gap-2 rounded-lg border border-hairline bg-surface-soft px-2.5 py-1.5 text-left transition hover:border-primary hover:bg-primary-soft"
              >
                <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: r.color }} />
                <span className="flex-1 truncate text-xs text-ink">{displayName(item)}</span>
                {fit > 0 && <span className="text-[9px] font-semibold text-accent-orange" title="역할 적성">적성 {fit}</span>}
                {item.equipped && <span className="text-[9px] font-semibold text-accent-emerald">장착중</span>}
                <span className="font-mono text-[9px] text-muted-soft">{item.score}</span>
              </button>
            );
          })}
          {candidates.length === 0 && (
            <div className="col-span-full py-3 text-center text-xs text-muted">후보 없음</div>
          )}
        </div>
      </div>
    );
  }
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="text-right">
      <div className="text-[10px] font-bold uppercase tracking-widest text-muted">{label}</div>
      <div className={`font-mono text-xl font-semibold ${accent ? "text-primary" : "text-ink"}`}>{value}</div>
    </div>
  );
}
