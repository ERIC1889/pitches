import { describe, expect, it } from "vitest";
import { summarizeEmotions } from "@pitches/shared";
import { buildSpeechMetrics, computeAccuracy } from "./metrics.js";

describe("computeAccuracy", () => {
  it("green 1, yellow 0.5, red 0 평균을 백분율로 반올림한다", () => {
    expect(computeAccuracy(["green", "green", "yellow", "red"])).toBe(63);
  });

  it("tick이 없으면 null", () => {
    expect(computeAccuracy([])).toBeNull();
  });
});

describe("buildSpeechMetrics", () => {
  it("tick과 전사문을 합쳐 지표를 만든다", () => {
    const m = buildSpeechMetrics({
      ticks: [
        { offsetMs: 0, color: "green", speedWpm: 300, volumeDb: -20, fillerCnt: 0 },
        { offsetMs: 5000, color: "red", speedWpm: 0, volumeDb: -40, fillerCnt: 1 },
      ],
      transcript: "음 안녕하세요 어 발표를 시작하겠습니다",
      durationSec: 10,
    });
    expect(m.accuracy).toBe(50);
    expect(m.colorCounts).toEqual({ green: 1, yellow: 0, red: 1 });
    expect(m.fillerCount).toBe(2);
    expect(m.avgVolumeDb).toBe(-30);
    expect(m.wpmTimeline).toEqual([{ offsetMs: 0, wpm: 300 }]);
    expect(m.avgWpm).toBe(102); // 공백 제외 17자 / 10초
  });

  it("감정 분포와 소리 이벤트(말소리 제외)를 집계한다", () => {
    const base = { offsetMs: 0, color: "green", speedWpm: 280, volumeDb: -20, fillerCnt: 0 };
    const m = buildSpeechMetrics({
      ticks: [
        { ...base, emotion: "NEUTRAL", audioEvent: "Speech" },
        { ...base, emotion: "NEUTRAL", audioEvent: "Laughter" },
        { ...base, emotion: "HAPPY", audioEvent: "Speech" },
        { ...base, emotion: null, audioEvent: null },
      ],
      transcript: "안녕하세요",
      durationSec: 20,
    });
    expect(m.emotionCounts).toEqual({ NEUTRAL: 2, HAPPY: 1 });
    expect(m.audioEvents).toEqual({ Laughter: 1 });
  });
});

describe("summarizeEmotions", () => {
  it("대표 감정과 부정 감정 비율을 계산한다", () => {
    expect(summarizeEmotions({ NEUTRAL: 6, HAPPY: 1, FEARFUL: 3 })).toEqual({
      dominant: "NEUTRAL",
      ratio: 0.6,
      negativeRatio: 0.3,
      total: 10,
    });
  });

  it("데이터가 없으면 null", () => {
    expect(summarizeEmotions(undefined)).toBeNull();
    expect(summarizeEmotions({})).toBeNull();
  });
});
