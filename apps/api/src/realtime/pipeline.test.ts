import { describe, expect, it, vi } from "vitest";
import { runPipeline } from "./pipeline.js";

const SAMPLE_RATE = 16000;
const meta = { seq: 0, durationMs: 5000 };

function silence(sec: number): Buffer {
  return Buffer.alloc(SAMPLE_RATE * 2 * sec);
}

/** 진폭 0.3(약 -13dB)의 440Hz 사인파 */
function tone(sec: number): Buffer {
  const buf = Buffer.alloc(SAMPLE_RATE * 2 * sec);
  for (let i = 0; i < SAMPLE_RATE * sec; i++) {
    const v = Math.sin((2 * Math.PI * 440 * i) / SAMPLE_RATE) * 0.3;
    buf.writeInt16LE(Math.round(v * 32767), i * 2);
  }
  return buf;
}

describe("runPipeline", () => {
  it("무음이면 STT를 부르지 않고 silent tick을 낸다", async () => {
    const transcribe = vi.fn(async () => "아무 말");
    const { tick } = await runPipeline(silence(5), meta, { transcribe });
    expect(transcribe).not.toHaveBeenCalled();
    expect(tick.silent).toBe(true);
    expect(tick.issues).toEqual(["too_quiet"]);
  });

  it("STT가 타임아웃되면 음량만으로 판정한다", async () => {
    const transcribe = () =>
      new Promise<string>((r) => setTimeout(() => r("늦은 응답"), 5000));
    const { tick } = await runPipeline(tone(5), meta, {
      transcribe,
      sttTimeoutMs: 100,
    });
    expect(tick.silent).toBe(false);
    expect(tick.speedWpm).toBe(0);
    expect(tick.issues).toEqual([]);
    expect(tick.color).toBe("green");
  });

  it("STT 텍스트로 간투사와 속도를 계산한다", async () => {
    const { tick } = await runPipeline(tone(5), meta, {
      transcribe: async () => "음 어 발표를 시작하겠습니다",
    });
    expect(tick.fillerCnt).toBe(2);
    expect(tick.speedWpm).toBeGreaterThan(0);
    expect(tick.issues).toContain("fillers");
  });

  it("환각 문구는 빈 텍스트로 취급한다", async () => {
    const { tick } = await runPipeline(tone(5), meta, {
      transcribe: async () => "시청해주셔서 감사합니다.",
    });
    expect(tick.speedWpm).toBe(0);
    expect(tick.fillerCnt).toBe(0);
  });

  it("감정 분석 결과를 tick 에 싣고 판정에 반영한다", async () => {
    const { tick } = await runPipeline(tone(5), meta, {
      transcribe: async () => "오늘 발표를 시작하겠습니다 감사합니다 여러분",
      analyzeEmotion: async () => ({ emotion: "ANGRY", score: 0.9, event: "Speech" }),
    });
    expect(tick.emotion).toBe("ANGRY");
    expect(tick.emotionScore).toBe(0.9);
    expect(tick.audioEvent).toBe("Speech");
    expect(tick.issues).toContain("emotion_negative");
  });

  it("감정 서비스가 실패해도 tick 은 나온다", async () => {
    const { tick } = await runPipeline(tone(5), meta, {
      transcribe: async () => "",
      analyzeEmotion: async () => {
        throw new Error("ECONNREFUSED");
      },
    });
    expect(tick.emotion).toBeNull();
    expect(tick.color).toBe("green");
  });

  it("무음이면 감정 분석도 생략한다", async () => {
    const analyzeEmotion = vi.fn(async () => ({ emotion: null, score: null, event: null }));
    const { tick } = await runPipeline(silence(5), meta, { analyzeEmotion });
    expect(analyzeEmotion).not.toHaveBeenCalled();
    expect(tick.emotion).toBeNull();
  });

  it("Whisper 텍스트를 자막으로 싣는다", async () => {
    const { tick } = await runPipeline(tone(5), meta, {
      transcribe: async () => "오늘 발표를 시작하겠습니다.",
      analyzeEmotion: async () => ({ emotion: null, score: null, event: null, text: "다른 텍스트" }),
    });
    expect(tick.transcript).toBe("오늘 발표를 시작하겠습니다.");
  });

  it("Whisper 가 실패하면 SenseVoice 전사를 자막으로 쓰되 판정에는 쓰지 않는다", async () => {
    const { tick } = await runPipeline(tone(5), meta, {
      transcribe: async () => {
        throw new Error("429");
      },
      analyzeEmotion: async () => ({
        emotion: "NEUTRAL",
        score: 0.9,
        event: "Speech",
        text: "안녕 하세요 음 오늘 발표",
      }),
    });
    expect(tick.transcript).toBe("안녕 하세요 음 오늘 발표");
    expect(tick.speedWpm).toBe(0);
    expect(tick.fillerCnt).toBe(0);
  });

  it("환각 문구나 무음은 자막을 비운다", async () => {
    const hallucinated = await runPipeline(tone(5), meta, {
      transcribe: async () => "시청해주셔서 감사합니다.",
      analyzeEmotion: async () => ({ emotion: null, score: null, event: null, text: "구독과 좋아요" }),
    });
    expect(hallucinated.tick.transcript).toBeNull();
    const quiet = await runPipeline(silence(5), meta, {
      transcribe: async () => "들리면 안 됨",
    });
    expect(quiet.tick.transcript).toBeNull();
  });
});

