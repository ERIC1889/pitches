import { describe, expect, it } from "vitest";
import { classify } from "./classify.js";

describe("classify", () => {
  it("이슈가 없으면 green", () => {
    expect(classify({ speedWpm: 280, volumeDb: -20, fillerCnt: 0 })).toEqual({
      color: "green",
      issues: [],
      tip: undefined,
    });
  });

  it("이슈 1개면 yellow", () => {
    const r = classify({ speedWpm: 380, volumeDb: -20, fillerCnt: 0 });
    expect(r.color).toBe("yellow");
    expect(r.issues).toEqual(["too_fast"]);
    expect(r.tip).toContain("천천히");
  });

  it("이슈 2개 이상이면 red", () => {
    const r = classify({ speedWpm: 150, volumeDb: -40, fillerCnt: 3 });
    expect(r.color).toBe("red");
    expect(r.issues).toEqual(["too_slow", "too_quiet", "fillers"]);
  });

  it("속도를 모르면(null) 속도 이슈를 내지 않는다", () => {
    const r = classify({ speedWpm: null, volumeDb: -20, fillerCnt: 0 });
    expect(r.issues).toEqual([]);
  });

  it("부정 감정이 확신도 0.5 이상이면 emotion_negative 이슈", () => {
    const r = classify({
      speedWpm: 280,
      volumeDb: -20,
      fillerCnt: 0,
      emotion: "FEARFUL",
      emotionScore: 0.8,
    });
    expect(r.color).toBe("yellow");
    expect(r.issues).toEqual(["emotion_negative"]);
  });

  it("확신도가 낮거나 없으면 감정 이슈를 내지 않는다", () => {
    expect(
      classify({ speedWpm: 280, volumeDb: -20, fillerCnt: 0, emotion: "SAD", emotionScore: 0.3 })
        .issues
    ).toEqual([]);
    expect(
      classify({ speedWpm: 280, volumeDb: -20, fillerCnt: 0, emotion: "ANGRY", emotionScore: null })
        .issues
    ).toEqual([]);
  });
});
