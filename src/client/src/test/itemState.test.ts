import { describe, it, expect } from "vitest";
import { isActive, isAmbient, isLive, isInClaudeDir, isEquippable } from "../lib/itemState";
import type { Item } from "../types";

/* lib/itemState — 활성/설치 베이스/라이브/디렉터리 존재 술어의 단일 출처 검증.
   대시보드 KPI·인벤토리 섹션·그래프 앵커가 이 정의를 공유하므로, 여기서 정의가 흔들리면
   화면 간 분류가 어긋난다(H#1·M#2 부류). server.mjs 오버레이 불변식을 fixture 로 못 박는다:
   - 미관리 상주 ⟹ ambient=true · equipped=false   (server.mjs: unmanaged resident → ambient)
   - 관리 상주     ⟹ divergent=true · equipped=false (server.mjs: managed resident → divergent)
   - 의도적 장착   ⟹ claudeState="link"             (관리) 또는 equipped+claudeState=null(레거시) */

function item(over: Partial<Item> = {}): Item {
  return {
    id: "x",
    name: "x",
    displayName: "X",
    description: "",
    kind: "skill",
    rarity: "common",
    score: 50,
    stats: { popularity: 50, freshness: 50, power: 50, clarity: 50, weight: 50 },
    source: { repo: "r/r", owner: "r", root: "/", path: "/x" },
    ...over,
  };
}

describe("isEquippable", () => {
  it("memory 만 장착 불가(skill/agent/mcp 는 가능)", () => {
    expect(isEquippable("skill")).toBe(true);
    expect(isEquippable("agent")).toBe(true);
    expect(isEquippable("mcp")).toBe(true);
    expect(isEquippable("memory")).toBe(false);
  });
});

describe("isActive — 의도적 장착(로드아웃)", () => {
  it("우리 링크(claudeState=link)는 활성", () => {
    expect(isActive(item({ claudeState: "link" }))).toBe(true);
  });
  it("레거시 장착(미관리·equipped·claudeState 미확정)은 활성", () => {
    expect(isActive(item({ equipped: true, managed: false }))).toBe(true);
  });
  it("설치 베이스(ambient)는 활성 아님", () => {
    expect(isActive(item({ ambient: true, claudeState: "resident" }))).toBe(false);
  });
  it("분기(divergent)는 활성 아님", () => {
    expect(isActive(item({ claudeState: "link", divergent: true }))).toBe(false);
  });
  it("보관(absent)은 활성 아님", () => {
    expect(isActive(item({ managed: true, claudeState: "absent" }))).toBe(false);
  });
  it("memory 는 equipped 라도 활성 아님(장착 개념 없음)", () => {
    expect(isActive(item({ kind: "memory", equipped: true }))).toBe(false);
  });
  // 리뷰 Open Question: equipped+resident+!ambient+!divergent 는 server 불변식상 도달 불가지만,
  // 만에 하나 생겨도 활성으로 세지 않는다(인벤토리 정의와 일치 — 의도적 장착이 아님).
  it("도달 불가 상태(equipped+resident)도 활성으로 세지 않음", () => {
    expect(isActive(item({ equipped: true, claudeState: "resident" }))).toBe(false);
  });
});

describe("isAmbient — 설치 베이스", () => {
  it("ambient=true·비분기 는 설치 베이스", () => {
    expect(isAmbient(item({ ambient: true, claudeState: "resident" }))).toBe(true);
  });
  it("분기면 설치 베이스 아님(분기 최우선)", () => {
    expect(isAmbient(item({ ambient: true, divergent: true }))).toBe(false);
  });
  it("memory 는 ambient 라도 설치 베이스 아님", () => {
    expect(isAmbient(item({ kind: "memory", ambient: true }))).toBe(false);
  });
  it("활성(link)은 설치 베이스 아님", () => {
    expect(isAmbient(item({ claudeState: "link" }))).toBe(false);
  });
});

describe("isLive = 활성 ∪ 설치 베이스 (상시 컨텍스트 부하 모집단)", () => {
  it("활성도 설치 베이스도 라이브", () => {
    expect(isLive(item({ claudeState: "link" }))).toBe(true);
    expect(isLive(item({ ambient: true, claudeState: "resident" }))).toBe(true);
  });
  it("보관·분기·비장착은 라이브 아님", () => {
    expect(isLive(item({ managed: true, claudeState: "absent" }))).toBe(false);
    expect(isLive(item({ ambient: true, divergent: true }))).toBe(false);
    expect(isLive(item({}))).toBe(false);
  });
  it("isLive 는 정확히 isActive 또는 isAmbient (Dashboard/Inventory 의 [...active,...ambient] 와 동치)", () => {
    const samples = [
      item({ claudeState: "link" }),
      item({ ambient: true, claudeState: "resident" }),
      item({ managed: true, claudeState: "absent" }),
      item({ divergent: true }),
      item({ kind: "memory", ambient: true }),
      item({ equipped: true, managed: false }),
    ];
    for (const s of samples) {
      expect(isLive(s)).toBe(isActive(s) || isAmbient(s));
    }
  });
});

describe("isInClaudeDir — 물리적 존재(그래프 앵커, 분기 포함)", () => {
  it("link/resident/equipped 는 디렉터리 존재", () => {
    expect(isInClaudeDir(item({ claudeState: "link" }))).toBe(true);
    expect(isInClaudeDir(item({ claudeState: "resident" }))).toBe(true);
    expect(isInClaudeDir(item({ equipped: true }))).toBe(true);
  });
  it("isLive 와 달리 분기(divergent resident)도 포함 — 여전히 로드됨", () => {
    const div = item({ claudeState: "resident", divergent: true });
    expect(isInClaudeDir(div)).toBe(true);
    expect(isLive(div)).toBe(false);
  });
  it("보관(absent)은 디렉터리에 없음", () => {
    expect(isInClaudeDir(item({ managed: true, claudeState: "absent" }))).toBe(false);
  });
});
