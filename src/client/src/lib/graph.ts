import type { Item } from "../types";
import { traitsOf } from "./traits";

/* ── 지식 그래프 빌더 (순수 함수, React 비의존) ───────────────────────────
   온톨로지/관계 그래프의 노드·엣지를 계산한다. React Flow가 소비할 형태로 반환.

   엣지 두 종류:
   - SAME_NAME (동명/변형): item.group(공유 nameKey 클러스터)이 같은 두 자산.
     희소하므로 항상 그린다. data.type="name".
   - SHARES_TRAIT (유사/연결): tags(특성) 교집합 크기 = weight. weight>=2 만 그린다.
     조밀하므로 헤어볼 방지 — 노드당 가장 강한 ~6개만 남긴다. data.type="trait".

   결정성: id 정렬로 입력 순서와 무관하게 같은 그래프를 만든다(레이아웃 안정성). */

export type GraphEdgeType = "name" | "trait";

export interface GraphNodeData extends Record<string, unknown> {
  item: Item;
}

export interface GraphEdgeData extends Record<string, unknown> {
  type: GraphEdgeType;
  weight: number;
}

export interface GraphNode {
  id: string;
  type: "asset";
  position: { x: number; y: number };
  data: GraphNodeData;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  data: GraphEdgeData;
}

export interface BuildGraphOpts {
  /** 동명(group) 엣지를 그릴지 */
  showName?: boolean;
  /** 특성(trait) 엣지를 그릴지 */
  showTrait?: boolean;
  /** SHARES_TRAIT 엣지: 노드당 최대 보존 개수(헤어볼 방지) */
  maxTraitPerNode?: number;
  /** SHARES_TRAIT 엣지로 인정할 최소 교집합 가중치 */
  minTraitWeight?: number;
}

export interface BuiltGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

const DEFAULTS: Required<BuildGraphOpts> = {
  showName: true,
  showTrait: true,
  maxTraitPerNode: 6,
  minTraitWeight: 2,
};

/** 자산의 특성 태그 키 집합 — traitsOf 휴리스틱을 한 번만 돌려 캐시. */
function tagKeySet(item: Item): Set<string> {
  return new Set(traitsOf(item).map((t) => t.key));
}

function undirectedKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/**
 * 자산 목록에서 지식 그래프(노드+엣지)를 만든다.
 * position은 0으로 초기화 — 레이아웃(d3-force)은 호출부(GraphView)가 계산해 덮어쓴다.
 */
export function buildGraph(items: Item[], opts: BuildGraphOpts = {}): BuiltGraph {
  const o = { ...DEFAULTS, ...opts };

  // 결정성: id 정렬.
  const sorted = [...items].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const nodes: GraphNode[] = sorted.map((item) => ({
    id: item.id,
    type: "asset",
    position: { x: 0, y: 0 },
    data: { item },
  }));

  const idSet = new Set(sorted.map((i) => i.id));
  const tagCache = new Map<string, Set<string>>();
  for (const it of sorted) tagCache.set(it.id, tagKeySet(it));

  // 무방향 중복 제거 — 같은 쌍을 한 번만 그린다(가장 강한 엣지 타입 우선).
  const edgeMap = new Map<string, GraphEdge>();
  const addEdge = (a: string, b: string, type: GraphEdgeType, weight: number) => {
    if (a === b || !idSet.has(a) || !idSet.has(b)) return;
    const key = undirectedKey(a, b);
    const existing = edgeMap.get(key);
    // 동명(name) 엣지가 특성(trait) 엣지를 우선한다. 같은 타입이면 더 큰 weight 보존.
    if (existing) {
      const upgrade =
        (type === "name" && existing.data.type !== "name") ||
        (type === existing.data.type && weight > existing.data.weight);
      if (!upgrade) return;
    }
    const [s, t] = a < b ? [a, b] : [b, a];
    edgeMap.set(key, {
      id: `${type}:${key}`,
      source: s,
      target: t,
      data: { type, weight },
    });
  };

  // ── SAME_NAME: 같은 group 값의 자산끼리 연결. 항상 보존(희소). ──
  if (o.showName) {
    const byGroup = new Map<string, Item[]>();
    for (const it of sorted) {
      if (!it.group) continue;
      const arr = byGroup.get(it.group);
      if (arr) arr.push(it);
      else byGroup.set(it.group, [it]);
    }
    for (const members of byGroup.values()) {
      if (members.length < 2) continue;
      // 클러스터 내 모든 쌍을 연결(이미 정렬돼 결정적).
      for (let i = 0; i < members.length; i++) {
        for (let j = i + 1; j < members.length; j++) {
          addEdge(members[i].id, members[j].id, "name", 1);
        }
      }
    }
  }

  // ── SHARES_TRAIT: 특성 교집합 weight>=min. 노드당 상위 maxTraitPerNode 만 보존. ──
  if (o.showTrait) {
    // 1) 후보 쌍의 weight 계산 — 태그 역색인(inverted index)으로 O(n²) 전수 비교를 회피.
    //    같은 태그를 공유하지 않는 쌍은 weight 0이므로 애초에 후보가 아니다.
    //    태그별 버킷에 등장한 자산쌍의 공유 카운트만 누적하면 교집합 크기를 얻는다.
    type Cand = { a: string; b: string; weight: number };

    // 태그 → 그 태그를 가진 자산 id 목록(정렬 순서 유지로 결정성 확보).
    const byTag = new Map<string, string[]>();
    for (const it of sorted) {
      const tags = tagCache.get(it.id)!;
      if (tags.size === 0) continue;
      for (const t of tags) {
        const arr = byTag.get(t);
        if (arr) arr.push(it.id);
        else byTag.set(t, [it.id]);
      }
    }

    // 공유 태그가 있는 쌍에 대해서만 교집합 weight 누적(undirectedKey로 무방향 집계).
    const pairWeight = new Map<string, number>();
    for (const ids of byTag.values()) {
      if (ids.length < 2) continue; // 단독 태그는 어떤 쌍도 만들지 않음.
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const key = undirectedKey(ids[i], ids[j]);
          pairWeight.set(key, (pairWeight.get(key) ?? 0) + 1);
        }
      }
    }

    const cands: Cand[] = [];
    for (const [key, w] of pairWeight) {
      if (w < o.minTraitWeight) continue;
      const sep = key.indexOf("|");
      cands.push({ a: key.slice(0, sep), b: key.slice(sep + 1), weight: w });
    }
    // 2) 노드별 상위 N 선정 — 양쪽 노드 중 하나라도 예산이 남으면 보존(undirected).
    //    강한 엣지 우선: weight desc, 그다음 id로 결정적 tie-break.
    cands.sort(
      (x, y) =>
        y.weight - x.weight ||
        (x.a < y.a ? -1 : x.a > y.a ? 1 : 0) ||
        (x.b < y.b ? -1 : x.b > y.b ? 1 : 0),
    );
    const used = new Map<string, number>();
    const cap = o.maxTraitPerNode;
    for (const c of cands) {
      const ua = used.get(c.a) ?? 0;
      const ub = used.get(c.b) ?? 0;
      if (ua >= cap && ub >= cap) continue;
      addEdge(c.a, c.b, "trait", c.weight);
      used.set(c.a, ua + 1);
      used.set(c.b, ub + 1);
    }
  }

  const edges = [...edgeMap.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { nodes, edges };
}

/**
 * 에고 필터 — focusId 자산 + 그 자산과 (hops 홉 내) 엣지로 이어진 이웃만 추린다.
 * 포커스 모드 / 기본 스코프(장착 자산 + 이웃) 계산에 사용.
 * focusIds 는 단일 id 또는 여러 시드(장착·상주 집합)를 받을 수 있다.
 *
 * prebuiltEdges: 호출부가 같은 items/opts로 이미 빌드한 엣지가 있으면 넘겨 중복 빌드를 피한다.
 *   (없으면 내부에서 buildGraph로 산출 — 기존 동작과 동일.)
 */
export function egoFilter(
  items: Item[],
  focusIds: string | string[],
  hops = 1,
  opts: BuildGraphOpts = {},
  prebuiltEdges?: GraphEdge[],
): Item[] {
  const seeds = Array.isArray(focusIds) ? focusIds : [focusIds];
  const seedSet = new Set(seeds.filter(Boolean));
  if (seedSet.size === 0) return [];

  const edges = prebuiltEdges ?? buildGraph(items, opts).edges;

  // 인접 리스트.
  const adj = new Map<string, Set<string>>();
  const link = (a: string, b: string) => {
    let s = adj.get(a);
    if (!s) adj.set(a, (s = new Set()));
    s.add(b);
  };
  for (const e of edges) {
    link(e.source, e.target);
    link(e.target, e.source);
  }

  // BFS 확장.
  const keep = new Set(seedSet);
  let frontier = [...seedSet];
  for (let h = 0; h < hops; h++) {
    const next: string[] = [];
    for (const id of frontier) {
      const nb = adj.get(id);
      if (!nb) continue;
      for (const n of nb) {
        if (!keep.has(n)) {
          keep.add(n);
          next.push(n);
        }
      }
    }
    frontier = next;
    if (frontier.length === 0) break;
  }

  return items.filter((i) => keep.has(i.id));
}
