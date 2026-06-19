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

  it("레어도 — 등급색 테두리 프레임 + 이름 title에 등급 라벨", () => {
    // 스킬 카드는 등급을 가시 텍스트 배지가 아니라 (1) 등급색 테두리 프레임과
    // (2) 이름 헤더의 title 속성에 등급 라벨을 담아 표현한다.
    render(<Card item={makeItem({ rarity: "legendary", name: "builder-skill" })} />);
    // 이름 헤더: title에 등급 라벨(S-Class) 포함
    const heading = screen.getByRole("heading", { name: "builder-skill" });
    expect(heading).toHaveAttribute("title", expect.stringContaining(RARITY_CONFIG.legendary.ko));
    // 카드 루트: 등급색 테두리 프레임 적용
    const card = heading.closest("div.reveal") as HTMLElement;
    expect(card).not.toBeNull();
    expect(card.style.borderColor).not.toBe("");
  });

  it("점수(pt) 렌더", () => {
    render(<Card item={makeItem({ score: 80 })} />);
    expect(screen.getByText("80pt")).toBeInTheDocument();
  });

  it("특성 라벨 렌더(트레잇 칩)", () => {
    // tags=["build"] → "구축" 특성 칩이 표시된다. (게임 보드 제거로 링크+ 배지는 더 이상 없음)
    render(<Card item={makeItem({ tags: ["build"] })} />);
    expect(screen.getByText("구축")).toBeInTheDocument();
    expect(screen.queryByText("링크+")).toBeNull();
  });
});
