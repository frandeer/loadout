import { describe, it, expect } from "vitest";
import { buildGraph, egoFilter, traitEdgeLabel } from "../lib/graph";
import type { GraphEdgeData } from "../lib/graph";
import type { Item } from "../types";

/* GraphView 폴리시(호버 강조·포커스·엣지 라벨)가 의존하는 순수 그래프 로직 검증.
   - traitKeys: 엣지에 공유 특성 key가 실리는가(호버 라벨의 원천).
   - traitEdgeLabel: key → 한글 라벨 포맷(상위 3 + "+N").
   - egoFilter: 단일 시드 1홉 에고(더블클릭 포커스 모드의 스코프). */

function makeItem(over: Partial<Item> = {}): Item {
  return {
    id: "x",
    name: "x",
    displayName: "X",
    description: "",
    kind: "skill",
    rarity: "common",
    score: 50,
    stats: { popularity: 50, freshness: 50, power: 50, clarity: 50, weight: 50 },
    source: { repo: "r/r", owner: "r", root: "/", path: "/x" },
    ...over,
  };
}

// tags를 직접 부여하면 traitsOf가 그걸 신뢰 → 휴리스틱 정규식 의존 제거(결정적 fixture).
function withTags(id: string, tags: string[], over: Partial<Item> = {}): Item {
  return makeItem({ id, name: id, displayName: id, tags, ...over });
}

describe("buildGraph — trait edges carry shared trait keys", () => {
  it("trait 엣지의 traitKeys = 두 자산의 공유 태그(weight = 개수)", () => {
    // a,b는 build·recon·audit 3개 공유(weight 3), c는 build 1개만 → weight<2라 엣지 없음.
    const items = [
      withTags("a", ["build", "recon", "audit"]),
      withTags("b", ["build", "recon", "audit"]),
      withTags("c", ["build"]),
    ];
    const { edges } = buildGraph(items, { showName: false, showTrait: true });
    const ab = edges.find((e) => e.id === "trait:a|b");
    expect(ab).toBeDefined();
    const data = ab!.data as GraphEdgeData;
    expect(data.type).toBe("trait");
    expect(data.weight).toBe(3);
    expect([...data.traitKeys].sort()).toEqual(["audit", "build", "recon"]);
    // a–c는 공유 1개라 minTraitWeight(2) 미달 → 엣지 없음.
    expect(edges.find((e) => e.id === "trait:a|c")).toBeUndefined();
  });

  it("name 엣지의 traitKeys는 빈 배열", () => {
    const items = [
      withTags("p", [], { group: "g1" }),
      withTags("q", [], { group: "g1" }),
    ];
    const { edges } = buildGraph(items, { showName: true, showTrait: false });
    const e = edges.find((x) => x.data.type === "name");
    expect(e).toBeDefined();
    expect((e!.data as GraphEdgeData).traitKeys).toEqual([]);
  });

  it("결정성 — 같은 입력은 같은 traitKeys 순서를 낸다(태그 정렬 기반)", () => {
    const items = [
      withTags("a", ["recon", "audit", "build"]),
      withTags("b", ["audit", "build", "recon"]),
    ];
    const r1 = buildGraph(items, { showName: false, showTrait: true });
    const r2 = buildGraph([...items].reverse(), { showName: false, showTrait: true });
    const k1 = (r1.edges[0].data as GraphEdgeData).traitKeys;
    const k2 = (r2.edges[0].data as GraphEdgeData).traitKeys;
    expect(k1).toEqual(k2);
  });
});

describe("traitEdgeLabel", () => {
  it("빈 입력 → 빈 문자열", () => {
    expect(traitEdgeLabel([])).toBe("");
  });

  it("key를 한글 라벨로 변환해 ·로 연결", () => {
    expect(traitEdgeLabel(["build", "recon"])).toBe("구축·정찰");
  });

  it("3개 초과는 상위 3 + '+N'", () => {
    const label = traitEdgeLabel(["build", "recon", "audit", "archive", "deploy"]);
    expect(label).toBe("구축·정찰·감찰 +2");
  });

  it("미지의 key는 key 자체를 라벨로 사용(폴백)", () => {
    expect(traitEdgeLabel(["nonexistent"])).toBe("nonexistent");
  });
});

describe("egoFilter — 단일 시드 1홉 에고(포커스 모드 스코프)", () => {
  it("포커스 자산 + 직접 이웃만 남긴다", () => {
    // a–b–c 체인(특성 공유), d는 고립. a 포커스 → a,b만(1홉). c는 2홉이라 제외.
    const items = [
      withTags("a", ["build", "recon"]),
      withTags("b", ["build", "recon"]), // a와 2개 공유
      withTags("c", ["recon", "audit"]), // b와는 recon만(1개) → 엣지 없음 → c는 에고 밖
      withTags("d", ["deploy", "plan"]), // 고립
    ];
    const opts = { showName: false, showTrait: true };
    const { edges } = buildGraph(items, opts);
    const ego = egoFilter(items, "a", 1, opts, edges).map((i) => i.id).sort();
    expect(ego).toContain("a");
    expect(ego).toContain("b");
    expect(ego).not.toContain("d");
  });

  it("빈 시드 → 빈 결과", () => {
    const items = [withTags("a", ["build", "recon"])];
    expect(egoFilter(items, "", 1)).toEqual([]);
  });
});
