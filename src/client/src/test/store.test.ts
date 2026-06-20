import { describe, it, expect, beforeEach } from "vitest";
import { useStore } from "../hooks/useStore";
import { isEquippable, KIND_LABELS } from "../types";
import type { Item } from "../types";

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: `item-${Math.random().toString(36).slice(2, 6)}`,
    name: "test",
    displayName: "Test",
    description: "desc",
    kind: "skill",
    rarity: "common",
    score: 50,
    stats: { popularity: 50, freshness: 50, power: 50, clarity: 50, weight: 50 },
    source: { repo: "r", owner: "o", root: "/", path: "/p" },
    ...overrides,
  };
}

describe("useStore", () => {
  beforeEach(() => {
    useStore.setState({
      items: [],
      meta: null,
      filters: { kind: "all", rarity: "all", category: "all", q: "", sort: "score", dupOnly: false, equipOnly: false, favOnly: false },
      selected: null,
      favorites: new Set(),
      picked: new Set(),
      lang: "en",
      loading: false,
      engines: ["heuristic"],
    });
  });

  it("sets and clears selection", () => {
    useStore.getState().setSelected("abc");
    expect(useStore.getState().selected).toBe("abc");
    useStore.getState().setSelected(null);
    expect(useStore.getState().selected).toBeNull();
  });

  it("toggles favorites", () => {
    useStore.getState().toggleFavorite("x");
    expect(useStore.getState().favorites.has("x")).toBe(true);
    useStore.getState().toggleFavorite("x");
    expect(useStore.getState().favorites.has("x")).toBe(false);
  });

  it("toggles and clears picks", () => {
    useStore.getState().togglePick("a");
    useStore.getState().togglePick("b");
    expect(useStore.getState().picked.size).toBe(2);
    useStore.getState().clearPicks();
    expect(useStore.getState().picked.size).toBe(0);
  });

  it("filters by kind", () => {
    const items = [makeItem({ kind: "skill" }), makeItem({ kind: "agent" }), makeItem({ kind: "mcp" })];
    useStore.setState({ items });
    useStore.getState().setFilter("kind", "agent");
    expect(useStore.getState().filtered().length).toBe(1);
    expect(useStore.getState().filtered()[0].kind).toBe("agent");
  });

  it("filters by memory kind and treats it as read-only (no equip)", () => {
    const items = [
      makeItem({ kind: "skill" }),
      makeItem({ kind: "memory", layer: "index", tags: ["memory"] }),
      makeItem({ kind: "memory", layer: "note", tags: ["memory"] }),
    ];
    useStore.setState({ items });
    useStore.getState().setFilter("kind", "memory");
    const result = useStore.getState().filtered();
    expect(result.length).toBe(2);
    expect(result.every((i) => i.kind === "memory")).toBe(true);
    // memory 카드는 장착 개념이 없는 읽기 전용 — 뱃지 라벨은 통일된 "Memory"
    expect(result.every((i) => !isEquippable(i.kind))).toBe(true);
    expect(KIND_LABELS.memory).toBe("Memory");
    // 기존 kind는 장착 가능 — 분기 미파손 확인
    expect(isEquippable("skill")).toBe(true);
  });

  it("filters by search query", () => {
    const items = [
      makeItem({ name: "alpha-tool", description: "useful" }),
      makeItem({ name: "beta-widget", description: "helpful" }),
    ];
    useStore.setState({ items });
    useStore.getState().setFilter("q", "alpha");
    expect(useStore.getState().filtered().length).toBe(1);
  });

  it("sorts by name", () => {
    const items = [
      makeItem({ name: "zebra", score: 10 }),
      makeItem({ name: "apple", score: 90 }),
    ];
    useStore.setState({ items });
    useStore.getState().setFilter("sort", "name");
    const sorted = useStore.getState().filtered();
    expect(sorted[0].name).toBe("apple");
    expect(sorted[1].name).toBe("zebra");
  });

  it("sorts by score descending", () => {
    const items = [
      makeItem({ name: "low", score: 10 }),
      makeItem({ name: "high", score: 90 }),
    ];
    useStore.setState({ items });
    useStore.getState().setFilter("sort", "score");
    const sorted = useStore.getState().filtered();
    expect(sorted[0].name).toBe("high");
  });

  it("filters favOnly", () => {
    const a = makeItem({ name: "a" });
    const b = makeItem({ name: "b" });
    useStore.setState({ items: [a, b], favorites: new Set([a.id]) });
    useStore.getState().setFilter("favOnly", true);
    const result = useStore.getState().filtered();
    expect(result.length).toBe(1);
    expect(result[0].id).toBe(a.id);
  });

  it("filters equipOnly", () => {
    const items = [makeItem({ equipped: true }), makeItem({ equipped: false })];
    useStore.setState({ items });
    useStore.getState().setFilter("equipOnly", true);
    expect(useStore.getState().filtered().length).toBe(1);
  });
});
