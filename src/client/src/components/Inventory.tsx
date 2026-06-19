import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../hooks/useStore";
import { RARITY_CONFIG, KIND_LABELS } from "../types";
import type { Item, Kind } from "../types";
import { api } from "../lib/api";
import { teamCost } from "../lib/traits";
import { ManaGauge } from "./ManaGauge";
import { Modal } from "./Modal";
import { Icon } from "./Icon";

/* ── 장착·보관 (CONTROL TOWER) ──────────────────────────────
   "지금 무엇이 켜져 있는가 → 이해 → 손쉬운 해제 → 정말 불필요한 것만 삭제".
   - 활성: ~/.claude 에서 동작 중(우리 링크 또는 레거시 장착)
   - 상주: 직접 설치된 실폴더 — 해제 시 vault 로 안전 이동(보관)
   - 보관: vault 에 있고 ~/.claude 에는 없음(꺼짐) — 켜면 재링크
   - 분기: vault ↔ 라이브 사본 불일치 — pull/push 로 해소
   서버(server.mjs)가 진실의 원천 — claudeState/managed/divergent 플래그를 그대로 신뢰한다. */

const KIND_ICON: Record<Kind, string> = {
  skill: "puzzle",
  agent: "agent-badge",
  mcp: "server",
  memory: "memory-chip",
};

// 삭제 가능 종류 — 서버는 skill/agent 만 휴지통 이동을 허용(mcp/memory 거부).
const canDelete = (item: Item) => item.kind === "skill" || item.kind === "agent";

export function Inventory() {
  const { items, reloadData, setSelected } = useStore();
  const navigate = useNavigate();

  const [busy, setBusy] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [selected, setSel] = useState<Set<string>>(new Set());
  const [batch, setBatch] = useState<{ kind: "off" | "on"; done: number; total: number } | null>(null);
  const [delTarget, setDelTarget] = useState<Item | null>(null);

  // ── 섹션 분류 (우선순위 체인 — 한 항목은 정확히 한 섹션에만 노출) ──────────
  // 분기를 먼저 가른다. 서버는 관리 항목의 라이브 자리가 실폴더(resident)일 때만 divergent=true 로 내리므로
  // (server.mjs: divergent ⟹ claudeState==="resident"), 상주 필터에서 분기를 빼지 않으면 같은 항목이
  // 상주·분기에 이중 노출되고, 상주의 "해제 → 보관함"이 미해소 분기를 덮어쓸 수 있다.
  // 분기 = 최우선(해소 전까지 다른 섹션에 노출 금지).
  const divergent = useMemo(() => items.filter((i) => i.divergent), [items]);
  // 활성: 우리 링크(claudeState==="link") 또는 레거시 장착(미관리·equipped인데 상태 미확정).
  // 레거시 절은 미관리 항목으로 한정 — equipped 는 파생값이라 관리 항목엔 의존하지 않는다.
  const active = useMemo(
    () =>
      items.filter(
        (i) =>
          !i.divergent &&
          (i.claudeState === "link" ||
            (!i.managed && !!i.equipped && i.claudeState == null)),
      ),
    [items],
  );
  // 상주: 직접 설치된 실폴더 — 해제하면 vault 로 이동 보관. 분기는 제외(분기 섹션에서만 해소).
  const resident = useMemo(
    () => items.filter((i) => i.claudeState === "resident" && !i.divergent),
    [items],
  );
  // 보관: vault 관리 대상이며 ~/.claude 에는 없음(꺼짐).
  const stored = useMemo(() => items.filter((i) => i.managed && i.claudeState === "absent"), [items]);

  // 마나 게이지 = 활성 + 상주 자산의 총 컨텍스트 부하(실제로 ~/.claude 에서 로드되는 것).
  const liveItems = useMemo(() => [...active, ...resident], [active, resident]);
  const totalCost = teamCost(liveItems);

  const isEmpty = !active.length && !resident.length && !stored.length && !divergent.length;

  // ── 단건 액션 ─────────────────────────────────────────
  // 해제 라우팅(단일 진실) — 관리/링크/상주는 vault 토글 off(안전 이동), 레거시 미관리는 unequip.
  // deactivate·withdrawResident·batchOff 가 모두 이걸 재사용해 분기 로직이 흩어지지 않게 한다.
  const offAction = (item: Item) =>
    item.managed || item.claudeState === "link" || item.claudeState === "resident"
      ? api.activateVault(item.id, false)
      : api.unequip(item.id);

  // 해제(활성): 관리 링크면 vault 토글 off, 레거시면 unequip.
  const deactivate = async (item: Item) => {
    setBusy(item.id);
    try {
      await offAction(item);
      await reloadData();
    } catch {}
    setBusy(null);
  };

  // 해제 → 보관(상주): vault 로 안전 이동. 거대 자산은 느린 이동이므로 먼저 확인.
  const withdrawResident = async (item: Item) => {
    if (item.oversized && !window.confirm("거대 자산입니다 — vault로 이동하는 데 시간이 걸릴 수 있습니다. 계속할까요?"))
      return;
    setBusy(item.id);
    try {
      await api.activateVault(item.id, false);
      await reloadData();
    } catch {}
    setBusy(null);
  };

  // 켜기(보관): vault → ~/.claude 재링크.
  const activate = async (id: string) => {
    setBusy(id);
    try {
      await api.activateVault(id, true);
      await reloadData();
    } catch {}
    setBusy(null);
  };

  // 분기 해소 — pull(vault←라이브) / push(vault→라이브 재링크).
  const resolve = async (id: string, choice: "pull" | "push") => {
    setBusy(id);
    try {
      await api.resolveDivergence(id, choice);
      await reloadData();
    } catch {}
    setBusy(null);
  };

  const syncUsage = async () => {
    setSyncing(true);
    try {
      await api.refreshUsage();
      await reloadData();
    } catch {}
    setSyncing(false);
  };

  // ── 선택(배치) ────────────────────────────────────────
  const toggleSel = (id: string) =>
    setSel((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const clearSel = () => setSel(new Set());

  // 선택 항목을 섹션별로 분리 — 활성/상주는 해제, 보관은 켜기.
  const selOffItems = useMemo(
    () => [...active, ...resident].filter((i) => selected.has(i.id)),
    [active, resident, selected],
  );
  const selOnItems = useMemo(() => stored.filter((i) => selected.has(i.id)), [stored, selected]);

  // 일괄 해제 — 활성/상주 선택분을 순차 처리.
  const batchOff = async () => {
    const list = selOffItems;
    if (!list.length) return;
    setBatch({ kind: "off", done: 0, total: list.length });
    for (let i = 0; i < list.length; i++) {
      try {
        await offAction(list[i]);
      } catch {}
      setBatch({ kind: "off", done: i + 1, total: list.length });
    }
    await reloadData();
    setBatch(null);
    clearSel();
  };

  // 일괄 켜기 — 보관 선택분을 순차 재링크.
  const batchOn = async () => {
    const list = selOnItems;
    if (!list.length) return;
    setBatch({ kind: "on", done: 0, total: list.length });
    for (let i = 0; i < list.length; i++) {
      try {
        await api.activateVault(list[i].id, true);
      } catch {}
      setBatch({ kind: "on", done: i + 1, total: list.length });
    }
    await reloadData();
    setBatch(null);
    clearSel();
  };

  return (
    <main className="mx-auto max-w-[1100px] px-5 py-5 pb-28">
      {/* ── 헤더 ── */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-wide text-muted">CONTROL TOWER</div>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-ink">장착·보관</h2>
          <p className="mt-1 text-sm text-muted">
            지금 <span className="font-mono text-primary">~/.claude</span>에서 무엇이 동작 중인지 확인하고,
            해제·보관·삭제를 한 곳에서 관리합니다.
          </p>
        </div>
        <button
          onClick={syncUsage}
          disabled={syncing}
          className="flex items-center gap-1.5 rounded-lg border border-hairline px-4 py-2 text-xs font-medium text-body transition hover:bg-surface-soft disabled:opacity-50"
          title="세션 로그를 다시 스캔해 사용량(경험치)을 갱신합니다"
        >
          <Icon name="sync" size="sm" /> {syncing ? "동기화 중..." : "사용량 동기화"}
        </button>
      </div>

      {/* ── 마나 게이지(활성+상주 부하) ── */}
      {liveItems.length > 0 && (
        <div className="mb-6 rounded-xl border border-hairline bg-canvas px-4 py-3">
          <ManaGauge cost={totalCost} label="활성 컨텍스트 부하 (활성 + 상주)" />
        </div>
      )}

      {/* ── 빈 상태 ── */}
      {isEmpty ? (
        <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-xl border border-hairline bg-canvas text-sm text-muted">
          <Icon name="backpack" size="xl" className="opacity-20" />
          <div>장착된 자산이 없습니다 — 자산 탭에서 선택해 장착하세요</div>
          <button
            onClick={() => navigate("/assets")}
            className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white transition hover:bg-primary-active"
          >
            자산 탭으로 이동
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* 1. 활성 */}
          <Section
            title="활성"
            note="~/.claude 에서 동작 중"
            count={active.length}
            icon="connected"
            tone="success"
          >
            {active.map((item) => (
              <Row
                key={item.id}
                item={item}
                busy={busy === item.id}
                checked={selected.has(item.id)}
                onCheck={() => toggleSel(item.id)}
                onOpen={() => setSelected(item.id)}
                onDelete={canDelete(item) ? () => setDelTarget(item) : undefined}
                actions={
                  <button
                    onClick={() => deactivate(item)}
                    disabled={busy === item.id}
                    className="rounded-lg border border-hairline px-3 py-1.5 text-[11px] font-medium text-muted transition hover:border-accent-rose hover:text-accent-rose disabled:opacity-40"
                    title="~/.claude 에서 내립니다"
                  >
                    {busy === item.id ? "..." : "해제"}
                  </button>
                }
              />
            ))}
          </Section>

          {/* 2. 상주 (직접 설치됨) */}
          <Section
            title="상주"
            note="직접 설치됨 — 우리가 만든 링크가 아닙니다"
            count={resident.length}
            icon="lock"
            tone="warm"
          >
            {resident.length > 0 && (
              <div className="mb-1 rounded-lg bg-surface-warm px-3 py-2 text-[11px] text-body">
                직접 설치한 실폴더입니다. <strong className="font-semibold">해제 → 보관함</strong>을 누르면
                ~/.claude 에서 내리고 vault(보관함)로 <strong className="font-semibold">안전 이동</strong>합니다.
                필요할 때 보관 섹션에서 다시 켤 수 있습니다.
              </div>
            )}
            {resident.map((item) => (
              <Row
                key={item.id}
                item={item}
                busy={busy === item.id}
                checked={selected.has(item.id)}
                onCheck={() => toggleSel(item.id)}
                onOpen={() => setSelected(item.id)}
                onDelete={canDelete(item) ? () => setDelTarget(item) : undefined}
                badge={
                  <span
                    className="rounded-full bg-accent-orange-soft px-2 py-0.5 text-[10px] font-semibold text-accent-orange"
                    title="이 자산은 직접 설치된 실폴더입니다"
                  >
                    상주 · 직접 설치
                  </span>
                }
                actions={
                  <button
                    onClick={() => withdrawResident(item)}
                    disabled={busy === item.id}
                    className="rounded-lg border border-hairline px-3 py-1.5 text-[11px] font-semibold text-body transition hover:border-primary hover:text-primary disabled:opacity-40"
                    title="끄면 ~/.claude 에서 내리고 vault(보관함)로 안전 이동합니다."
                  >
                    {busy === item.id ? "..." : "해제 → 보관함"}
                  </button>
                }
              />
            ))}
          </Section>

          {/* 3. 보관 (vault · 꺼짐) */}
          <Section
            title="보관"
            note="vault · 꺼짐 — 켜면 ~/.claude 에 재링크"
            count={stored.length}
            icon="backpack"
            tone="default"
          >
            {stored.map((item) => (
              <Row
                key={item.id}
                item={item}
                dim
                busy={busy === item.id}
                checked={selected.has(item.id)}
                onCheck={() => toggleSel(item.id)}
                onOpen={() => setSelected(item.id)}
                onDelete={canDelete(item) ? () => setDelTarget(item) : undefined}
                actions={
                  <button
                    onClick={() => activate(item.id)}
                    disabled={busy === item.id}
                    className="rounded-lg bg-primary px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-primary-active disabled:opacity-40"
                    title="vault → ~/.claude 재링크"
                  >
                    {busy === item.id ? "..." : "켜기"}
                  </button>
                }
              />
            ))}
          </Section>

          {/* 4. 분기 (vault ↔ 라이브 불일치) */}
          <Section
            title="분기"
            note="vault ↔ 라이브 불일치 — 한쪽으로 맞춰 해소"
            count={divergent.length}
            icon="warning"
            tone="danger"
          >
            {divergent.length > 0 && (
              <div className="mb-1 rounded-lg bg-accent-rose/10 px-3 py-2 text-[11px] text-body">
                vault 사본과 라이브(~/.claude) 사본이 서로 다릅니다.
                <strong className="font-semibold"> 당기기</strong>는 라이브를 vault 로 가져오고,
                <strong className="font-semibold"> 밀기</strong>는 vault 로 라이브를 다시 맞춥니다.
              </div>
            )}
            {divergent.map((item) => (
              <Row
                key={item.id}
                item={item}
                busy={busy === item.id}
                onOpen={() => setSelected(item.id)}
                actions={
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => resolve(item.id, "pull")}
                      disabled={busy === item.id}
                      className="rounded-lg border border-hairline px-2.5 py-1.5 text-[11px] font-medium text-muted transition hover:border-primary hover:text-primary disabled:opacity-40"
                      title="vault ← 라이브: 라이브 사본을 vault 로 가져옵니다"
                    >
                      당기기(pull)
                    </button>
                    <button
                      onClick={() => resolve(item.id, "push")}
                      disabled={busy === item.id}
                      className="rounded-lg border border-hairline px-2.5 py-1.5 text-[11px] font-medium text-muted transition hover:border-primary hover:text-primary disabled:opacity-40"
                      title="vault → 라이브: vault 기준으로 라이브를 재링크합니다"
                    >
                      밀기(push)
                    </button>
                  </div>
                }
              />
            ))}
          </Section>
        </div>
      )}

      {/* ── 배치 액션 바(선택 ≥1) ── */}
      {selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-hairline bg-canvas/95 backdrop-blur-sm">
          <div className="mx-auto flex max-w-[1100px] flex-wrap items-center gap-3 px-5 py-3">
            <span className="text-sm font-semibold text-ink">
              <span className="font-mono">{selected.size}</span>개 선택됨
            </span>
            {batch && (
              <span className="font-mono text-xs text-muted">
                {batch.kind === "off" ? "해제" : "켜기"} {batch.done}/{batch.total}...
              </span>
            )}
            <div className="ml-auto flex items-center gap-2">
              {selOffItems.length > 0 && (
                <button
                  onClick={batchOff}
                  disabled={!!batch}
                  className="rounded-lg border border-hairline px-4 py-2 text-xs font-medium text-body transition hover:border-accent-rose hover:text-accent-rose disabled:opacity-40"
                >
                  일괄 해제 (<span className="font-mono">{selOffItems.length}</span>)
                </button>
              )}
              {selOnItems.length > 0 && (
                <button
                  onClick={batchOn}
                  disabled={!!batch}
                  className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white transition hover:bg-primary-active disabled:opacity-40"
                >
                  일괄 켜기 (<span className="font-mono">{selOnItems.length}</span>)
                </button>
              )}
              <button
                onClick={clearSel}
                disabled={!!batch}
                className="rounded-lg px-3 py-2 text-xs font-medium text-muted transition hover:text-ink disabled:opacity-40"
              >
                선택 해제
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 삭제 확인 모달 ── */}
      <DeleteDialog
        item={delTarget}
        onClose={() => setDelTarget(null)}
        onDone={async () => {
          setDelTarget(null);
          await reloadData();
        }}
      />
    </main>
  );
}

/* ── 섹션 패널 — 비어 있으면 렌더하지 않는다 ── */
function Section({
  title,
  note,
  count,
  icon,
  tone,
  children,
}: {
  title: string;
  note: string;
  count: number;
  icon: string;
  tone: "success" | "warm" | "danger" | "default";
  children: React.ReactNode;
}) {
  if (count === 0) return null;
  const toneCls =
    tone === "success"
      ? "bg-surface-success text-accent-emerald"
      : tone === "warm"
        ? "bg-surface-warm text-accent-orange"
        : tone === "danger"
          ? "bg-accent-rose/10 text-accent-rose"
          : "bg-surface-soft text-muted";
  return (
    <section className="rounded-xl border border-hairline bg-canvas p-4">
      <div className="mb-3 flex items-center gap-3">
        <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${toneCls}`}>
          <Icon name={icon} size="sm" />
        </span>
        <h3 className="text-sm font-bold text-ink">{title}</h3>
        <span className="rounded-full bg-surface-soft px-2 py-0.5 text-[11px] font-semibold text-muted">
          <span className="font-mono">{count}</span>
        </span>
        <span className="text-[11px] text-muted">{note}</span>
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

/* ── 자산 행 ── */
function Row({
  item,
  busy,
  dim,
  checked,
  onCheck,
  onOpen,
  onDelete,
  badge,
  actions,
}: {
  item: Item;
  busy: boolean;
  dim?: boolean;
  checked?: boolean;
  onCheck?: () => void;
  onOpen: () => void;
  onDelete?: () => void;
  badge?: React.ReactNode;
  actions: React.ReactNode;
}) {
  const r = RARITY_CONFIG[item.rarity];
  return (
    <div
      className={`flex items-center gap-3 rounded-lg border border-hairline px-3 py-2.5 transition hover:border-hairline-strong ${
        dim ? "bg-surface-soft/40" : "bg-canvas"
      }`}
    >
      {onCheck && (
        <input
          type="checkbox"
          checked={!!checked}
          onChange={onCheck}
          className="h-4 w-4 shrink-0 cursor-pointer accent-[var(--color-primary)]"
          title="배치 선택"
        />
      )}
      <Icon name={KIND_ICON[item.kind]} size="sm" className={dim ? "text-muted-soft" : "text-muted"} />
      <button onClick={onOpen} className="min-w-0 flex-1 text-left">
        <div className={`truncate text-sm font-semibold hover:text-primary ${dim ? "text-muted" : "text-ink"}`}>
          {item.displayName}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[10px] text-muted">
          <span className="rounded-full px-1.5 py-0.5 font-semibold" style={{ color: r.color, backgroundColor: r.bg }}>
            {r.ko}
          </span>
          <span className="font-mono">{item.score}pt</span>
          <span className="text-muted-soft">{KIND_LABELS[item.kind]}</span>
          <span className="truncate">
            {item.source.owner}/{item.source.repo}
          </span>
          {!!item.uses && item.uses > 0 && (
            <span className="font-mono text-accent-emerald">{item.uses}회 사용</span>
          )}
          {item.oversized && (
            <span
              className="rounded-full bg-accent-orange-soft px-1.5 py-0.5 font-semibold text-accent-orange"
              title="거대 자산 — 해제 시 vault로 이동(지연)"
            >
              거대 자산
            </span>
          )}
          {badge}
        </div>
      </button>
      {actions}
      {onDelete && (
        <button
          onClick={onDelete}
          disabled={busy}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-soft transition hover:bg-accent-rose/10 hover:text-accent-rose disabled:opacity-40"
          title="휴지통으로 안전 삭제"
        >
          <Icon name="delete" size="sm" />
        </button>
      )}
    </div>
  );
}

/* ── 삭제 확인 다이얼로그 (이름 일치 확인) ──
   1) dryRun 으로 willRemove[] 경로를 먼저 보여준다.
   2) 사용자가 item.name 을 정확히 타이핑해야 삭제 버튼이 활성화된다.
   3) 실제 삭제는 휴지통 이동(복구 가능). */
function DeleteDialog({
  item,
  onClose,
  onDone,
}: {
  item: Item | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [typed, setTyped] = useState("");
  const [willRemove, setWillRemove] = useState<Array<{ label: string; path: string }> | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const itemId = item?.id;
  // 모달이 열리면(아이템 변경 시) dryRun 으로 제거 대상 미리보기를 불러온다.
  useEffect(() => {
    if (!item || !itemId) return;
    let alive = true;
    setTyped("");
    setWillRemove(null);
    setErr(null);
    setLoading(true);
    api
      .deleteItem(item.id, "", true)
      .then((res) => {
        if (!alive) return;
        setWillRemove(res.willRemove ?? []);
        if (res.error) setErr(res.error);
      })
      .catch(() => alive && setErr("미리보기를 불러오지 못했습니다."))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);

  const close = () => {
    setTyped("");
    setWillRemove(null);
    setErr(null);
    onClose();
  };

  const confirm = async () => {
    // 서버(server.mjs)와 동일하게 trim 후 비교 — item.name 에 공백이 끼어도 수용 기준이 어긋나지 않게.
    if (!item || typed.trim() !== item.name.trim()) return;
    setDeleting(true);
    try {
      const res = await api.deleteItem(item.id, typed, false);
      if (res.error) {
        setErr(res.error);
        setDeleting(false);
        return;
      }
      setTyped("");
      setWillRemove(null);
      setDeleting(false);
      onDone();
    } catch {
      setErr("삭제에 실패했습니다.");
      setDeleting(false);
    }
  };

  const armed = !!item && typed.trim() === item.name.trim() && !deleting;

  return (
    <Modal open={!!item} onClose={close} title="자산 영구 삭제">
      {item && (
        <div className="space-y-4">
          <div className="rounded-lg bg-surface-warm px-3 py-2.5 text-xs text-body">
            <strong className="font-semibold text-ink">{item.displayName}</strong> 를(을) 디스크에서 제거합니다.
            <span className="text-muted"> 휴지통(보관 트래시)으로 이동하므로 복구할 수 있습니다.</span>
          </div>

          {/* 제거 대상 미리보기 */}
          <div>
            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted">제거 대상</div>
            {loading ? (
              <div className="rounded-lg border border-hairline bg-surface-soft px-3 py-3 text-xs text-muted">
                미리보기 불러오는 중...
              </div>
            ) : willRemove && willRemove.length > 0 ? (
              <ul className="space-y-1 rounded-lg border border-hairline bg-surface-soft px-3 py-2.5">
                {willRemove.map((w, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs">
                    <Icon name="file-alt" size="xs" className="mt-0.5 text-muted-soft" />
                    <div className="min-w-0">
                      <div className="font-medium text-body">{w.label}</div>
                      <div className="truncate font-mono text-[10px] text-muted">{w.path}</div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="rounded-lg border border-hairline bg-surface-soft px-3 py-3 text-xs text-muted">
                제거 대상 경로를 확인할 수 없습니다.
              </div>
            )}
          </div>

          {err && (
            <div className="rounded-lg bg-accent-rose/10 px-3 py-2 text-xs font-medium text-accent-rose">{err}</div>
          )}

          {/* 이름 확인 입력 */}
          <div>
            <label className="mb-1.5 block text-xs text-body">
              확인을 위해 <span className="font-mono font-semibold text-ink">{item.name}</span> 를(을) 정확히 입력하세요.
            </label>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={item.name}
              autoFocus
              className="w-full rounded-lg border border-hairline bg-canvas px-3 py-2 font-mono text-sm text-ink outline-none transition focus:border-accent-rose"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              onClick={close}
              disabled={deleting}
              className="rounded-lg border border-hairline px-4 py-2 text-xs font-medium text-body transition hover:bg-surface-soft disabled:opacity-40"
            >
              취소
            </button>
            <button
              onClick={confirm}
              disabled={!armed}
              className="flex items-center gap-1.5 rounded-lg bg-accent-rose px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Icon name="delete" size="sm" />
              {deleting ? "삭제 중..." : "영구 삭제 (휴지통으로)"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
