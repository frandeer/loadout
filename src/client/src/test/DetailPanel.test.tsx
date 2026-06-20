import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { DetailPanel } from "../components/DetailPanel";
import { useStore } from "../hooks/useStore";
import { api } from "../lib/api";
import type { Item } from "../types";

vi.mock("../lib/api", () => ({
  api: { getContent: vi.fn(), equip: vi.fn(), unequip: vi.fn(), translate: vi.fn() },
}));

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: "item-1",
    name: "skill-creator",
    displayName: "skill-creator",
    description: "스킬을 처음부터 설계·생성",
    kind: "skill",
    rarity: "legendary",
    score: 84,
    stats: { popularity: 58, freshness: 99, power: 84, clarity: 79, weight: 71 },
    source: { repo: "r", owner: "o", root: "/", path: "/p" },
    ...overrides,
  };
}

describe("DetailPanel (docked 마스터-디테일)", () => {
  beforeEach(() => {
    vi.mocked(api.getContent).mockResolvedValue({ content: "" });
    useStore.setState({ items: [], selected: null, lang: "en", favorites: new Set() });
  });

  it("docked + 미선택 → 플레이스홀더 렌더", () => {
    render(<DetailPanel variant="docked" />);
    expect(screen.getByTestId("detail-placeholder")).toBeInTheDocument();
    expect(screen.getByText("카드를 선택하세요")).toBeInTheDocument();
    expect(screen.queryByTestId("detail-panel")).toBeNull();
  });

  it("overlay + 미선택 → 아무것도 렌더하지 않음(null)", () => {
    const { container } = render(<DetailPanel variant="overlay" />);
    expect(container.firstChild).toBeNull();
  });

  it("선택된 카드 → 이름·등급·kind 렌더(docked)", async () => {
    const item = makeItem();
    useStore.setState({ items: [item], selected: item.id });
    render(<DetailPanel variant="docked" />);
    expect(screen.getByTestId("detail-panel")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "skill-creator" })).toBeInTheDocument();
    expect(screen.getAllByText("S-Class").length).toBeGreaterThan(0); // 등급 배지
    expect(screen.getAllByText("84").length).toBeGreaterThan(0);      // 작전력 점수(헤더 점수 블록)
    expect(screen.getAllByText("작전력").length).toBeGreaterThan(0);   // 점수 라벨
    expect(screen.getByText("Skill")).toBeInTheDocument();            // kind(통일 라벨)
    await waitFor(() => expect(api.getContent).toHaveBeenCalled());
  });

  it("memory kind → 장착 CTA 숨김(읽기 전용)", async () => {
    const mem = makeItem({ id: "m1", kind: "memory", rarity: "common", layer: "index", tags: ["memory"] });
    useStore.setState({ items: [mem], selected: mem.id });
    render(<DetailPanel variant="docked" />);
    expect(screen.getByText(/읽기 전용/)).toBeInTheDocument();
    expect(screen.queryByText(/작전 투입/)).toBeNull();
  });
});
