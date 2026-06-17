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

  it("레어도 컬러 스트립(3px, 등급색) 렌더", () => {
    render(<Card item={makeItem({ rarity: "legendary" })} />);
    const strip = screen.getByTestId("rarity-strip");
    expect(strip).toBeInTheDocument();
    expect(strip).toHaveStyle({ backgroundColor: RARITY_CONFIG.legendary.color });
  });

  it("코스트 보석 — cost 있으면 표시(축약), 없으면 미표시", () => {
    const { rerender } = render(<Card item={makeItem({ cost: 8000 })} />);
    expect(screen.getByTestId("cost-gem")).toHaveTextContent("8.0k");
    rerender(<Card item={makeItem({ cost: undefined })} />);
    expect(screen.queryByTestId("cost-gem")).toBeNull();
  });

  it("연결 시너지 +1 인라인 + 편성 임박 특성 강조", () => {
    // 임박 아님 — 일반 시너지 칩
    const { rerender } = render(<Card item={makeItem({ tags: ["build"] })} />);
    const chip = screen.getByTestId("trait-chip");
    expect(chip).toHaveTextContent("구축 +1");
    expect(chip.getAttribute("title")).toMatch(/연결 시너지/);

    // needKeys에 포함 + 미장착 → 강조(임박 타이틀)
    rerender(<Card item={makeItem({ tags: ["build"], equipped: false })} needKeys={new Set(["build"])} />);
    expect(screen.getByTestId("trait-chip").getAttribute("title")).toMatch(/발동 임박/);
  });
});
