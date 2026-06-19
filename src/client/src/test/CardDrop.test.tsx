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

  it("does NOT call onReveal on drop success — fires only when reveal is dismissed", async () => {
    // 회귀 방어: onReveal을 드랍 성공 시점에 호출하면 부모 모달(SourceManager)이
    // 즉시 언마운트되어 CardDrop과 그 자식 리빌 오버레이가 같은 렌더에서 사라진다.
    // onReveal은 리빌이 닫힐 때만 호출되어, 리빌이 사용자 액션까지 살아남아야 한다.
    vi.mocked(api.drop).mockResolvedValue({
      ok: true,
      card: { id: "_drops/win", name: "win-pattern", kind: "skill" },
      skillPath: "p",
    });
    const onReveal = vi.fn();

    render(<CardDrop onReveal={onReveal} />);
    fireEvent.click(screen.getByText("카드 드랍"));

    // 드랍 성공 후 리빌은 살아 있고 onReveal은 아직 호출되지 않아야 한다.
    await waitFor(() => expect(screen.getByTestId("card-drop-reveal")).toBeInTheDocument());
    expect(onReveal).not.toHaveBeenCalled();

    // "덱에 보관"으로 닫으면 그제서야 setSelected → onReveal 순으로 실행된다.
    fireEvent.click(screen.getByText("덱에 보관"));
    await waitFor(() => expect(screen.queryByTestId("card-drop-reveal")).not.toBeInTheDocument());
    expect(useStore.getState().selected).toBe("_drops/win");
    expect(onReveal).toHaveBeenCalledTimes(1);
  });

  it("shows korean error on failure", async () => {
    vi.mocked(api.drop).mockRejectedValue(new Error("no engine"));

    render(<CardDrop />);
    fireEvent.click(screen.getByText("카드 드랍"));

    await waitFor(() => expect(screen.getByText(/드랍 요청이 실패했습니다/)).toBeInTheDocument());
  });
});
