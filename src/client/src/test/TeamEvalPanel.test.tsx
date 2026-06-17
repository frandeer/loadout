import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { TeamEvalPanel } from "../components/TeamEvalPanel";
import { api } from "../lib/api";
import type { TeamEvalResult } from "../types";

vi.mock("../lib/api", () => ({
  api: { teamVerify: vi.fn() },
}));

const RESULT: TeamEvalResult = {
  total: 82,
  scores: { coverage: 90, synergy: 75, balance: 60 },
  comment: "구축·정찰 균형이 우수한 팀입니다.",
  engine: "claude",
};

describe("TeamEvalPanel", () => {
  beforeEach(() => {
    vi.mocked(api.teamVerify).mockReset();
  });

  it("renders eval result (total + gauges + comment + engine badge) after evaluating", async () => {
    vi.mocked(api.teamVerify).mockResolvedValue({ ok: true, result: RESULT });

    const slots = { 분석관: "a", 정찰관: "b", 구축관: null };
    render(<TeamEvalPanel slots={slots} engines={["claude", "heuristic"]} />);
    fireEvent.click(screen.getByText("팀 평가"));

    await waitFor(() => expect(screen.getByTestId("team-eval-result")).toBeInTheDocument());
    const panel = within(screen.getByTestId("team-eval-result"));
    expect(panel.getByText("82")).toBeInTheDocument();
    expect(panel.getByText("커버리지")).toBeInTheDocument();
    expect(panel.getByText("시너지")).toBeInTheDocument();
    expect(panel.getByText("균형")).toBeInTheDocument();
    expect(panel.getByText(RESULT.comment)).toBeInTheDocument();
    // engine 뱃지 — 결과 패널 외부(헤더)에 렌더되므로 전체에서 조회
    expect(screen.getAllByText("claude").length).toBeGreaterThanOrEqual(1);

    // 역할명→itemId 맵 + 기본 시나리오 폴백 확인
    expect(vi.mocked(api.teamVerify)).toHaveBeenCalledWith(
      expect.objectContaining({ slots, scenario: "범용 코딩 작업", engine: "claude" }),
    );
  });

  it("shows korean error when evaluation fails", async () => {
    vi.mocked(api.teamVerify).mockRejectedValue(new Error("boom"));

    render(<TeamEvalPanel slots={{ 분석관: "a" }} engines={["heuristic"]} />);
    fireEvent.click(screen.getByText("팀 평가"));

    await waitFor(() =>
      expect(screen.getByText(/평가 요청이 실패했습니다/)).toBeInTheDocument(),
    );
  });

  it("disables button with no members", () => {
    render(<TeamEvalPanel slots={{ 분석관: null, 정찰관: null }} engines={["heuristic"]} />);
    expect(screen.getByText("팀 평가")).toBeDisabled();
  });
});
