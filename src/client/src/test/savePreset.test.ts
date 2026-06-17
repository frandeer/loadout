import { describe, it, expect, vi, beforeEach } from "vitest";
import { useStore } from "../hooks/useStore";
import { api } from "../lib/api";

vi.mock("../lib/api", () => ({
  api: { saveTeams: vi.fn() },
}));

/* 레이스 회귀 방지: savePreset은 서버 저장(api.saveTeams)이 완료된 뒤에야
   id를 resolve해야 한다. 그래야 후속 export 요청이 teams.json 기록 전에
   도착해 404가 나는 일이 없다. */
describe("savePreset 저장-완료 순서 보장", () => {
  beforeEach(() => {
    vi.mocked(api.saveTeams).mockReset();
    useStore.setState({ slots: { build: "x" }, presets: {} });
  });

  it("awaits api.saveTeams before resolving the id", async () => {
    let resolveSave!: () => void;
    let savedDone = false;
    vi.mocked(api.saveTeams).mockReturnValue(
      new Promise<{ ok: boolean; count: number }>((res) => {
        resolveSave = () => {
          savedDone = true;
          res({ ok: true, count: 1 });
        };
      }),
    );

    const p = useStore.getState().savePreset("팀");
    let presetResolved = false;
    void p.then(() => { presetResolved = true; });

    // saveTeams 미완료 시점에는 savePreset이 resolve되면 안 된다.
    await Promise.resolve();
    expect(savedDone).toBe(false);
    expect(presetResolved).toBe(false);

    // 서버 저장 완료 → 그제서야 savePreset resolve.
    resolveSave();
    const id = await p;
    expect(savedDone).toBe(true);
    expect(presetResolved).toBe(true);
    expect(typeof id).toBe("string");
    expect(api.saveTeams).toHaveBeenCalledTimes(1);
  });
});
