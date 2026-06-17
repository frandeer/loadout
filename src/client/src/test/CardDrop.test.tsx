import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CardDrop } from "../components/CardDrop";
import { useStore } from "../hooks/useStore";
import { api } from "../lib/api";

vi.mock("../lib/api", () => ({
  api: {
    drop: vi.fn(),
    getIndex: vi.fn().mockResolvedValue({ items: [], total: 0, counts: {}, dupGroups: 0, scanned: "" }),
  },
}));

describe("CardDrop", () => {
  beforeEach(() => {
    vi.mocked(api.drop).mockReset();
    vi.mocked(api.getIndex).mockResolvedValue({ items: [], total: 0, counts: {} as never, dupGroups: 0, scanned: "" });
    useStore.setState({ engines: ["claude", "heuristic"], items: [], selected: null });
  });

  it("opens reveal modal with new card after drop", async () => {
    vi.mocked(api.drop).mockResolvedValue({
      ok: true,
      card: { id: "_drops/win", name: "win-pattern", kind: "skill" },
      skillPath: "sources/_drops/win/SKILL.md",
      note: "휴리스틱 폴백으로 추출됨",
    });

    render(<CardDrop />);
    fireEvent.click(screen.getByText("카드 드랍"));

    await waitFor(() => expect(screen.getByTestId("card-drop-reveal")).toBeInTheDocument());
    expect(screen.getByText("신규 카드 획득!")).toBeInTheDocument();
    expect(screen.getByText("win-pattern")).toBeInTheDocument();
    expect(screen.getByText("휴리스틱 폴백으로 추출됨")).toBeInTheDocument();
    expect(vi.mocked(api.drop)).toHaveBeenCalledWith("claude");
  });

  it("highlights the dropped card on close (setSelected)", async () => {
    vi.mocked(api.drop).mockResolvedValue({
      ok: true,
      card: { id: "_drops/win", name: "win-pattern", kind: "skill" },
      skillPath: "p",
    });

    render(<CardDrop />);
    fireEvent.click(screen.getByText("카드 드랍"));
    await waitFor(() => expect(screen.getByTestId("card-drop-reveal")).toBeInTheDocument());
    fireEvent.click(screen.getByText("덱에 보관"));

    await waitFor(() => expect(screen.queryByTestId("card-drop-reveal")).not.toBeInTheDocument());
    expect(useStore.getState().selected).toBe("_drops/win");
  });

  it("shows korean error on failure", async () => {
    vi.mocked(api.drop).mockRejectedValue(new Error("no engine"));

    render(<CardDrop />);
    fireEvent.click(screen.getByText("카드 드랍"));

    await waitFor(() => expect(screen.getByText(/드랍 요청이 실패했습니다/)).toBeInTheDocument());
  });
});
