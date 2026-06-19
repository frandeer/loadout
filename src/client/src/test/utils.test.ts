import { describe, it, expect } from "vitest";
import { iconFor, summarize, computeLevel } from "../lib/utils";
import type { Item } from "../types";

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: "test-1",
    name: "test-skill",
    displayName: "Test Skill",
    description: "A test skill for testing",
    kind: "skill",
    rarity: "common",
    score: 50,
    stats: { popularity: 50, freshness: 50, power: 50, clarity: 50, weight: 50 },
    source: { repo: "test/repo", owner: "test", root: "/", path: "/test" },
    ...overrides,
  };
}

describe("iconFor", () => {
  it("returns 'agent' for agent kind", () => {
    expect(iconFor(makeItem({ kind: "agent" }))).toBe("agent");
  });

  it("returns 'module' for mcp kind", () => {
    expect(iconFor(makeItem({ kind: "mcp" }))).toBe("module");
  });

  it("returns category-based icon for skills", () => {
    expect(iconFor(makeItem({ name: "pdf-reader" }))).toBe("docs");
    expect(iconFor(makeItem({ name: "debug-tool" }))).toBe("debug");
    expect(iconFor(makeItem({ name: "security-scanner", description: "security audit tool" }))).toBe("security");
  });

  it("returns 'util' as fallback", () => {
    expect(iconFor(makeItem({ name: "foobar", description: "nothing here" }))).toBe("util");
  });
});

describe("summarize", () => {
  it("returns empty string for empty input", () => {
    expect(summarize("")).toBe("");
  });

  it("truncates long text with ellipsis", () => {
    const long = "A".repeat(200);
    const result = summarize(long, 50);
    expect(result.length).toBeLessThanOrEqual(50);
    expect(result.endsWith("\u2026")).toBe(true);
  });

  it("strips 'Use when' clauses", () => {
    const text = "Does something useful. Use when you need it.";
    expect(summarize(text)).not.toContain("Use when");
  });

  it("respects max length and truncates", () => {
    const text = "Short intro. " + "A".repeat(200);
    const result = summarize(text, 80);
    expect(result.length).toBeLessThanOrEqual(80);
  });
});

describe("computeLevel", () => {
  it("returns null when there is no real usage", () => {
    expect(computeLevel(0)).toBeNull();
    expect(computeLevel(undefined)).toBeNull();
  });

  it("scales level with real usage count (uses)", () => {
    const low = computeLevel(12);
    const high = computeLevel(96);
    expect(low).not.toBeNull();
    expect(high).not.toBeNull();
    expect(high!).toBeGreaterThan(low!);
  });
});
