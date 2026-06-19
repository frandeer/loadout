import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { TeamAbPanel } from "../components/TeamAbPanel";
import { useStore } from "../hooks/useStore";
import { api } from "../lib/api";
import type { TeamAbResp, TeamEvalResult } from "../types";

vi.mock("../lib/api", () => ({ api: { teamAb: vi.fn() } }));

const mkResult = (total: number): TeamEvalResult => ({
  total,
  scores: { coverage: 80, synergy: 70, balance: 60 },
  comment: `총평 ${total}`,
  engine: "claude",
});

const AB: TeamAbResp = {
  ok: true,
  a: { teamId: "t1", name: "알파", result: mkResult(82) },
  b: { teamId: "t2", name: "브라보", result: mkResult(75) },
  winner: "a",
  delta: 7,
  elo: { a: 1516, b: 1484 },
};

describe("TeamAbPanel (A/B 대전)", () => {
  beforeEach(() => {
    vi.mocked(api.teamAb).mockReset();
  });

  it("저장된 작전이 2개 미만이면 대전 버튼 비활성", () => {
    useStore.setState({ presets: { t1: { name: "알파", slots: {}, at: 1, elo: 1500 } } });
    render(<TeamAbPanel engines={["claude", "heuristic"]} />);
    expect(screen.getByText("대전 개시")).toBeDisabled();
    expect(screen.getByText(/2개 이상이어야/)).toBeInTheDocument();
  });

  it("두 작전 선택 후 대전 → 결과(총점·승자·Elo 변동) 렌더", async () => {
    useStore.setState({
      presets: {
        t1: { name: "알파", slots: {}, at: 2, elo: 1500 },
        t2: { name: "브라보", slots: {}, at: 1, elo: 1500 },
      },
    });
    vi.mocked(api.teamAb).mockResolvedValue(AB);
    render(<TeamAbPanel engines={["claude", "heuristic"]} />);

    fireEvent.change(screen.getByLabelText("팀 A"), { target: { value: "t1" } });
    fireEvent.change(screen.getByLabelText("팀 B"), { target: { value: "t2" } });

    const btn = screen.getByText("대전 개시");
    expect(btn).not.toBeDisabled();
    fireEvent.click(btn);

    await waitFor(() => expect(screen.getByTestId("team-ab-result")).toBeInTheDocument());
    const panel = within(screen.getByTestId("team-ab-result"));
    expect(panel.getByText("82")).toBeInTheDocument();
    expect(panel.getByText("75")).toBeInTheDocument();
    // 승자 표시: 트로피 아이콘(SVG) + 방향 라벨(← 팀 A)
    expect(panel.getByTestId("ab-verdict").querySelector("svg")).toBeTruthy();
    expect(panel.getByText("← 팀 A")).toBeInTheDocument();
    // Elo 변동: 1500→1516 / 1500→1484
    expect(panel.getByText("1516")).toBeInTheDocument();
    expect(panel.getByText("1484")).toBeInTheDocument();

    expect(vi.mocked(api.teamAb)).toHaveBeenCalledWith("t1", "t2", "범용 코딩 작업", "claude");
    // 서버 영속 Elo가 로컬 presets에 반영됐는지
    expect(useStore.getState().presets.t1.elo).toBe(1516);
    expect(useStore.getState().presets.t2.elo).toBe(1484);
  });

  it("실패 시 한국어 에러", async () => {
    useStore.setState({
      presets: {
        t1: { name: "알파", slots: {}, at: 2, elo: 1500 },
        t2: { name: "브라보", slots: {}, at: 1, elo: 1500 },
      },
    });
    vi.mocked(api.teamAb).mockRejectedValue(new Error("boom"));
    render(<TeamAbPanel engines={["heuristic"]} />);
    fireEvent.change(screen.getByLabelText("팀 A"), { target: { value: "t1" } });
    fireEvent.change(screen.getByLabelText("팀 B"), { target: { value: "t2" } });
    fireEvent.click(screen.getByText("대전 개시"));
    await waitFor(() => expect(screen.getByText(/대전 요청이 실패했습니다/)).toBeInTheDocument());
  });
});
