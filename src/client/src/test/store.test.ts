import { describe, it, expect, beforeEach } from "vitest";
import { useStore } from "../hooks/useStore";
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
      filters: { kind: "all", rarity: "all", q: "", sort: "score", dupOnly: false, equipOnly: false, favOnly: false },
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
