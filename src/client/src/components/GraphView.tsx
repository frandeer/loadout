import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  Panel,
  useReactFlow,
  useNodesState,
  useEdgesState,
  SelectionMode,
  type Edge,
  type NodeMouseHandler,
  type OnSelectionChangeFunc,
} from "@xyflow/react";
import {
  forceSimulation,
  forceManyBody,
  forceLink,
  forceCenter,
  forceCollide,
  forceX,
  forceY,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from "d3-force";
import "@xyflow/react/dist/style.css";

import type { Item, Kind } from "../types";
import { RARITY_CONFIG } from "../types";
import { useStore } from "../hooks/useStore";
import { api } from "../lib/api";
import { buildGraph, egoFilter, type GraphEdgeType } from "../lib/graph";
import { GraphNode, type AssetNode } from "./GraphNode";
import { Icon } from "./Icon";

/* 엣지 색 — 동명=violet(등급 hex 아님, accent-violet 토큰), 특성=teal(엣지 전용). */
const EDGE_COLOR: Record<GraphEdgeType, string> = {
  name: "#8B5CF6", // accent-violet 토큰과 동일
  trait: "#14B8A6", // teal — 엣지 전용(등급색 아님)
};

const KIND_CHIPS: { key: Kind | "all"; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "skill", label: "스킬" },
  { key: "agent", label: "요원" },
  { key: "mcp", label: "장비" },
  { key: "memory", label: "기억" },
];

const nodeTypes = { asset: GraphNode };

/** 자산이 "지금 ~/.claude 에서 활성"인지 — 기본 스코프의 앵커.
 *  installed(소스가 ~/.claude 하위)는 카탈로그 대부분이 해당돼 의미가 없으므로 제외.
 *  실제 활성 = managed 링크 / 상주(직접 설치) / 레거시 equipped 만. */
function isAnchor(it: Item): boolean {
  return Boolean(it.equipped || it.claudeState === "resident" || it.claudeState === "link");
}

type Scope = "ego" | "all";

interface SimNode extends SimulationNodeDatum {
  id: string;
}

/** 내부 그래프 캔버스 — ReactFlowProvider 안에서 동작. */
function GraphCanvas() {
  const items = useStore((s) => s.items);
  const setSelected = useStore((s) => s.setSelected);
  const reloadData = useStore((s) => s.reloadData);
  const rf = useReactFlow<AssetNode, Edge>();

  // ── 컨트롤 상태 ──
  const [kind, setKind] = useState<Kind | "all">("all");
  // 기본값 ON — 컨트롤타워 기본 화면은 "내 활성 자산(장착·상주)과 그 관계"로 좁혀 가독성 확보.
  //   끄면 이웃까지 확장(EGO_CAP로 상한).
  const [equipOnly, setEquipOnly] = useState(true);
  const [showName, setShowName] = useState(true);
  const [showTrait, setShowTrait] = useState(true);
  const [scope, setScope] = useState<Scope>("ego");
  const [q, setQ] = useState("");

  // ── 다중 선택(React Flow 로컬 — 전역 picked와 분리) ──
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [batch, setBatch] = useState<{ running: boolean; done: number; total: number; label: string } | null>(null);

  // ── 1차 필터: kind + 장착·상주만 (스코프 적용 전) ──
  const prefiltered = useMemo(() => {
    let xs = items;
    if (kind !== "all") xs = xs.filter((i) => i.kind === kind);
    if (equipOnly) xs = xs.filter(isAnchor);
    return xs;
  }, [items, kind, equipOnly]);

  // ── 스코프 적용: ego(장착·상주 + 1홉 이웃) vs all ──
  const scopedItems = useMemo(() => {
    if (scope === "all") return prefiltered;
    // ego 스코프: prefiltered 전체 그래프를 한 번만 빌드해 egoFilter에 엣지를 재사용
    //   (egoFilter 내부 중복 buildGraph 회피).
    const opts = { showName, showTrait };
    // 앵커가 없으면(장착 자산 0) 점수 상위 일부를 시드로 — 빈 캔버스 방지.
    //   equipOnly로 prefiltered가 비면 전체 items에서 시드를 뽑아 빈 화면을 피한다.
    const pool = prefiltered.length ? prefiltered : items;
    const { edges } = buildGraph(pool, opts);
    const anchorIds = pool.filter(isAnchor).map((i) => i.id);
    const seeds = anchorIds.length
      ? anchorIds
      : [...pool].sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 12).map((i) => i.id);
    const ego = egoFilter(pool, seeds, 1, opts, edges);
    // EGO 상한 — 특성 엣지가 조밀해 이웃이 폭증할 수 있다. 시드는 항상 유지하고,
    //   나머지 이웃은 점수순으로 잘라 헤어볼을 방지(가독성 우선).
    const EGO_CAP = 80;
    if (ego.length <= EGO_CAP) return ego;
    const seedSet = new Set(seeds);
    const kept = ego.filter((i) => seedSet.has(i.id));
    const rest = ego
      .filter((i) => !seedSet.has(i.id))
      .sort((a, b) => (b.score || 0) - (a.score || 0));
    return [...kept, ...rest].slice(0, Math.max(EGO_CAP, kept.length));
  }, [prefiltered, items, scope, showName, showTrait]);

  // ── 그래프 빌드(노드/엣지) — items/필터/스코프/관계토글 변화 시에만 재계산 ──
  const graph = useMemo(
    () => buildGraph(scopedItems, { showName, showTrait }),
    [scopedItems, showName, showTrait],
  );

  // 전체 스코프에서 노드 수가 많을 때 성능 경고용.
  const allCount = prefiltered.length;

  const [nodes, setNodes, onNodesChange] = useNodesState<AssetNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // 검색 매치 — q에 걸리는 노드 id 집합(하이라이트/줌).
  const matchIds = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return new Set<string>();
    return new Set(
      scopedItems
        .filter((i) =>
          `${i.name} ${i.displayName} ${i.nameKo ?? ""} ${i.source.repo}`.toLowerCase().includes(s),
        )
        .map((i) => i.id),
    );
  }, [q, scopedItems]);

  // ── d3-force 레이아웃: 그래프(노드 집합/엣지)가 바뀔 때 한 번만 돌린다. ──
  //    드래그 시에는 재실행하지 않음(React Flow가 위치를 관리). ──
  const lastKeyRef = useRef<string>("");
  useEffect(() => {
    // 그래프 동일성 키 — 노드 id 집합 + 엣지 id 집합.
    // 구분자는 id에 등장할 수 없는 제어문자()를 써 콤마 등으로 인한 키 충돌을 방지.
    const SEP = "";
    const key =
      graph.nodes.map((n) => n.id).join(SEP) + "" + graph.edges.map((e) => e.id).join(SEP);
    if (key === lastKeyRef.current) return;
    lastKeyRef.current = key;

    if (graph.nodes.length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }

    const simNodes: SimNode[] = graph.nodes.map((n) => ({ id: n.id }));
    const idx = new Map(simNodes.map((n, i) => [n.id, i]));
    const simLinks: SimulationLinkDatum<SimNode>[] = graph.edges.map((e) => ({
      source: idx.get(e.source)!,
      target: idx.get(e.target)!,
    }));

    // forceX/Y로 약하게 중심으로 끌어당겨, 엣지 없는 고립 노드가 멀리 날아가
    //   fitView가 과도하게 축소되는 것을 막는다(가독성).
    const sim = forceSimulation(simNodes)
      .force("charge", forceManyBody().strength(-260))
      .force("link", forceLink<SimNode, SimulationLinkDatum<SimNode>>(simLinks).distance(78).strength(0.5))
      .force("center", forceCenter(0, 0))
      .force("x", forceX(0).strength(0.07))
      .force("y", forceY(0).strength(0.07))
      .force("collide", forceCollide(46))
      .stop();

    sim.tick(260); // 동기 틱 — 위치 확정 후 렌더.

    const rfNodes: AssetNode[] = graph.nodes.map((n, i) => ({
      id: n.id,
      type: "asset",
      position: { x: simNodes[i].x ?? 0, y: simNodes[i].y ?? 0 },
      data: n.data,
    }));

    const rfEdges: Edge[] = graph.edges.map((e) => {
      const type = e.data.type;
      const isName = type === "name";
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        data: e.data,
        style: {
          stroke: EDGE_COLOR[type],
          strokeWidth: isName ? 2.5 : 1.2,
          opacity: isName ? 0.85 : 0.5,
        },
      };
    });

    setNodes(rfNodes);
    setEdges(rfEdges);

    // 레이아웃 직후 화면 맞춤(다음 프레임 — 노드 측정 후). maxZoom으로 소수 노드 과확대 방지.
    requestAnimationFrame(() => rf.fitView({ padding: 0.25, duration: 300, maxZoom: 1.1 }));
  }, [graph, setNodes, setEdges, rf]);

  // 검색 매치 하이라이트 — 매치 외 노드를 흐리게, 매치 노드는 또렷하게. matchIds 변화 시.
  useEffect(() => {
    setNodes((nds) =>
      nds.map((n) => {
        // 레이아웃 패스가 설정한 다른 스타일을 보존하기 위해 기존 style을 펼친다.
        const base = n.style ?? {};
        if (matchIds.size === 0) {
          // 하이라이트 해제 — opacity만 제거하고 나머지 스타일은 유지.
          if (base.opacity === undefined) return n;
          const { opacity: _omit, ...rest } = base;
          return { ...n, style: rest };
        }
        return { ...n, style: { ...base, opacity: matchIds.has(n.id) ? 1 : 0.25 } };
      }),
    );
    // 매치가 있으면 그쪽으로 줌 — 라이브 nodes(이전 프레임일 수 있음) 대신 matchIds로 직접 타깃 산출.
    if (matchIds.size > 0) {
      const targets = [...matchIds].map((id) => ({ id }));
      requestAnimationFrame(() =>
        rf.fitView({ nodes: targets, padding: 0.4, duration: 400, maxZoom: 1.5 }),
      );
    }
  }, [matchIds, setNodes, rf]);

  // ── 노드 클릭 → 전역 DetailPanel 열기(드래그를 깨지 않음 — onNodeClick은 클릭에서만 발화). ──
  const onNodeClick: NodeMouseHandler<AssetNode> = useCallback(
    (_e, node) => setSelected(node.id),
    [setSelected],
  );

  // ── 다중 선택 추적(로컬). ──
  const onSelectionChange = useCallback<OnSelectionChangeFunc<AssetNode, Edge>>(
    ({ nodes: sel }) => setSelectedIds(sel.map((n) => n.id)),
    [],
  );

  // ── 일괄 작업 ──
  const runBatch = useCallback(
    async (mode: "equip" | "unequip") => {
      const ids = [...selectedIds];
      const targets = items.filter(
        (i) => ids.includes(i.id) && i.kind !== "memory",
      );
      if (targets.length === 0) return;
      setBatch({ running: true, done: 0, total: targets.length, label: mode === "equip" ? "장착" : "해제" });
      let done = 0;
      for (const it of targets) {
        try {
          const vaultToggleable = it.managed || it.claudeState === "resident";
          if (mode === "equip") {
            if (vaultToggleable) await api.activateVault(it.id, true);
            else if (!it.equipped) await api.equip(it.id);
          } else {
            if (vaultToggleable) await api.activateVault(it.id, false);
            else if (it.equipped) await api.unequip(it.id);
          }
        } catch {
          /* 개별 실패는 건너뛰고 계속 — 진행률만 갱신. */
        }
        done++;
        setBatch((b) => (b ? { ...b, done } : b));
      }
      await reloadData();
      setSelectedIds([]); // 재로딩 후 선택 초기화 — 일괄 바의 잔여 카운트 방지.
      setBatch(null);
    },
    [selectedIds, items, reloadData],
  );

  // 빈 캔버스 클릭 시 로컬 다중 선택 초기화(컨트롤드 상태 안전장치).
  const onPaneClick = useCallback(() => setSelectedIds([]), []);

  const openFirst = useCallback(() => {
    if (selectedIds.length) setSelected(selectedIds[0]);
  }, [selectedIds, setSelected]);

  // 빈 상태.
  if (items.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-6">
        <div className="flex flex-col items-center gap-3 rounded-xl border border-hairline bg-canvas px-10 py-12 text-center">
          <Icon name="network" size="xl" className="text-muted-soft" />
          <h2 className="text-base font-bold text-ink">관계 그래프</h2>
          <p className="text-sm text-muted">표시할 자산이 없습니다. 먼저 자산을 스캔하세요.</p>
        </div>
      </div>
    );
  }

  return (
    <ReactFlow<AssetNode, Edge>
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={nodeTypes}
      onNodeClick={onNodeClick}
      onPaneClick={onPaneClick}
      onSelectionChange={onSelectionChange}
      fitView
      minZoom={0.1}
      maxZoom={2.5}
      selectionOnDrag
      panOnDrag={[1, 2]}
      selectionMode={SelectionMode.Partial}
      proOptions={{ hideAttribution: true }}
      className="bg-surface-app"
    >
      <Background color="var(--color-hairline)" gap={20} />
      <Controls className="!border-hairline !bg-canvas" />
      <MiniMap
        pannable
        zoomable
        className="!border !border-hairline !bg-canvas"
        nodeColor={(n) => {
          const it = (n.data as { item?: Item })?.item;
          return it ? RARITY_CONFIG[it.rarity].color : "var(--color-muted-soft)";
        }}
        nodeStrokeWidth={0}
      />

      {/* ── 좌상단 컨트롤 패널 ── */}
      <Panel position="top-left" className="!m-3 w-[240px]">
        <div className="flex max-h-[calc(100vh-8rem)] flex-col gap-3 overflow-y-auto rounded-xl border border-hairline bg-canvas/95 p-3 shadow-md backdrop-blur-xl">
          {/* 검색 */}
          <div className="flex items-center gap-2 rounded-lg border border-hairline bg-surface-soft px-2.5 py-1.5">
            <Icon name="search" size="xs" className="text-muted-soft" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="자산 검색…"
              className="w-full bg-transparent text-xs text-body outline-none placeholder:text-muted-soft"
            />
            {q && (
              <button onClick={() => setQ("")} aria-label="검색 지우기" className="text-muted-soft hover:text-body">
                <Icon name="close" size="xs" />
              </button>
            )}
          </div>

          {/* kind 필터 */}
          <div>
            <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-soft">종류</div>
            <div className="flex flex-wrap gap-1.5">
              {KIND_CHIPS.map((c) => (
                <button
                  key={c.key}
                  onClick={() => setKind(c.key)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                    kind === c.key
                      ? "bg-primary text-white"
                      : "border border-hairline bg-canvas text-muted hover:bg-surface-soft hover:text-body"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* 장착·상주만 */}
          <label className="flex cursor-pointer items-center justify-between gap-2 text-xs text-body">
            <span className="flex items-center gap-1.5">
              <Icon name="check-circle" size="xs" className="text-accent-emerald" /> 장착·상주만
            </span>
            <input type="checkbox" checked={equipOnly} onChange={(e) => setEquipOnly(e.target.checked)} className="h-3.5 w-3.5 accent-primary" />
          </label>

          {/* 관계 토글 */}
          <div>
            <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-soft">연결</div>
            <div className="flex flex-col gap-1.5">
              <label className="flex cursor-pointer items-center justify-between gap-2 text-xs text-body">
                <span className="flex items-center gap-1.5">
                  <span className="h-0.5 w-4 rounded" style={{ backgroundColor: EDGE_COLOR.name }} /> 동명/변형
                </span>
                <input type="checkbox" checked={showName} onChange={(e) => setShowName(e.target.checked)} className="h-3.5 w-3.5 accent-primary" />
              </label>
              <label className="flex cursor-pointer items-center justify-between gap-2 text-xs text-body">
                <span className="flex items-center gap-1.5">
                  <span className="h-0.5 w-4 rounded" style={{ backgroundColor: EDGE_COLOR.trait }} /> 특성(유사)
                </span>
                <input type="checkbox" checked={showTrait} onChange={(e) => setShowTrait(e.target.checked)} className="h-3.5 w-3.5 accent-primary" />
              </label>
            </div>
          </div>

          {/* 스코프 */}
          <div>
            <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-soft">범위</div>
            <div className="flex flex-col gap-1.5">
              <button
                onClick={() => setScope("ego")}
                className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition ${
                  scope === "ego" ? "bg-primary-soft text-primary" : "border border-hairline text-muted hover:bg-surface-soft"
                }`}
              >
                <span>장착 자산 + 이웃</span>
                {scope === "ego" && <Icon name="check" size="xs" />}
              </button>
              <button
                onClick={() => setScope("all")}
                className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition ${
                  scope === "all" ? "bg-primary-soft text-primary" : "border border-hairline text-muted hover:bg-surface-soft"
                }`}
              >
                <span>전체 ({allCount})</span>
                {scope === "all" && <Icon name="check" size="xs" />}
              </button>
              {scope === "all" && allCount > 150 && (
                <p className="flex items-start gap-1 rounded-lg bg-accent-orange-soft px-2 py-1.5 text-[10px] text-accent-orange">
                  <Icon name="warning" size="xs" className="mt-px shrink-0" />
                  노드 {allCount}개 — 많으면 느려질 수 있습니다.
                </p>
              )}
            </div>
          </div>

          <div className="border-t border-hairline pt-2 font-mono text-[10px] text-muted-soft">
            노드 {nodes.length} · 엣지 {edges.length}
          </div>
        </div>
      </Panel>

      {/* ── 좌하단 범례 ── */}
      <Panel position="bottom-left" className="!m-3">
        <div className="flex flex-col gap-1.5 rounded-xl border border-hairline bg-canvas/95 p-2.5 text-[10px] shadow-sm backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-muted">
              <span className="h-0.5 w-4 rounded" style={{ backgroundColor: EDGE_COLOR.name }} /> 동명
            </span>
            <span className="flex items-center gap-1 text-muted">
              <span className="h-0.5 w-4 rounded" style={{ backgroundColor: EDGE_COLOR.trait }} /> 특성
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-muted">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "var(--color-accent-emerald)" }} /> 장착
            </span>
            <span className="flex items-center gap-1 text-muted">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "var(--color-accent-orange)" }} /> 상주
            </span>
            <span className="flex items-center gap-1 text-muted">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "var(--color-muted-soft)" }} /> 보관
            </span>
          </div>
        </div>
      </Panel>

      {/* ── 0 노드(필터 결과 비었을 때) ── */}
      {nodes.length === 0 && (
        <Panel position="top-center" className="!mt-20">
          <div className="rounded-xl border border-hairline bg-canvas px-6 py-4 text-center text-sm text-muted shadow-sm">
            조건에 맞는 자산이 없습니다. 필터/범위를 조정하세요.
          </div>
        </Panel>
      )}

      {/* ── 우상단 일괄 작업 바(2개 이상 선택 시) ── */}
      {selectedIds.length >= 2 && (
        <Panel position="top-right" className="!m-3">
          <div className="flex flex-col gap-2 rounded-xl border border-hairline bg-canvas/95 p-3 shadow-md backdrop-blur-xl">
            <span className="text-xs font-bold text-body">
              선택 <span className="text-primary">{selectedIds.length}</span>개
            </span>
            {batch?.running ? (
              <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                {batch.label} 중 ({batch.done}/{batch.total})
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <button
                  onClick={() => runBatch("equip")}
                  className="flex items-center justify-center gap-1.5 rounded-lg bg-accent-emerald px-3 py-1.5 text-xs font-bold text-white transition hover:opacity-90"
                >
                  <Icon name="check-circle" size="xs" className="text-white" /> 일괄 장착
                </button>
                <button
                  onClick={() => runBatch("unequip")}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-accent-rose/40 px-3 py-1.5 text-xs font-semibold text-accent-rose transition hover:bg-accent-rose/10"
                >
                  <Icon name="disconnected" size="xs" /> 일괄 해제
                </button>
                <button
                  onClick={openFirst}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-hairline px-3 py-1.5 text-xs font-medium text-body transition hover:bg-surface-soft"
                >
                  <Icon name="eye" size="xs" /> 분석(첫 항목)
                </button>
              </div>
            )}
          </div>
        </Panel>
      )}
    </ReactFlow>
  );
}

export function GraphView() {
  return (
    <main className="h-[calc(100vh-3.5rem)] w-full">
      <ReactFlowProvider>
        <GraphCanvas />
      </ReactFlowProvider>
    </main>
  );
}
