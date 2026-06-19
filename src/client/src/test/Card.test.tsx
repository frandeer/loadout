import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { Card } from "../components/Card";
import { useStore } from "../hooks/useStore";
import { RARITY_CONFIG } from "../types";
import type { Item } from "../types";

vi.mock("../lib/api", () => ({ api: { equip: vi.fn(), unequip: vi.fn() } }));

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: "c1",
    name: "builder-skill",
    displayName: "builder-skill",
    description: "코드 구현 도우미",
    kind: "skill",
    rarity: "legendary",
    score: 80,
    stats: { popularity: 50, freshness: 50, power: 60, clarity: 50, weight: 50 },
    source: { repo: "r", owner: "o", root: "/", path: "/p" },
    tags: ["build"],
    cost: 8000,
    ...overrides,
  };
}

describe("Card 시안 C ②③", () => {
  beforeEach(() => {
    useStore.setState({ selected: null, favorites: new Set(), picked: new Set(), lang: "ko" });
  });

  it("레어도 배지 — 등급 라벨 + 등급색 렌더", () => {
    render(<Card item={makeItem({ rarity: "legendary" })} />);
    const badge = screen.getByText("S-Class");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveStyle({ backgroundColor: RARITY_CONFIG.legendary.color });
  });

  it("점수(pt) 렌더", () => {
    render(<Card item={makeItem({ score: 80 })} />);
    expect(screen.getByText("80pt")).toBeInTheDocument();
  });

  it("특성 라벨 렌더 + 편성 임박 시 링크+ 배지", () => {
    // needKeys 없음 → 특성 라벨만 표시, 링크+ 배지는 없음
    const { rerender } = render(<Card item={makeItem({ tags: ["build"] })} />);
    expect(screen.getByText("구축")).toBeInTheDocument();
    expect(screen.queryByText("링크+")).toBeNull();

    // needKeys에 특성(build) 포함 + 미장착 → 발동 임박 "링크+" 배지
    rerender(<Card item={makeItem({ tags: ["build"], equipped: false })} needKeys={new Set(["build"])} />);
    expect(screen.getByText("링크+")).toBeInTheDocument();
  });
});
