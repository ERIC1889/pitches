import { EmotionSchema, type Emotion, type SpeechMetrics } from "@pitches/shared";
import { countFillers } from "../realtime/features/fillers.js";
import { computeWpm } from "../realtime/features/wpm.js";

export interface TickRow {
  offsetMs: number;
  color: string;
  speedWpm: number;
  volumeDb: number;
  fillerCnt: number;
  emotion?: string | null;
  audioEvent?: string | null;
}

const COLOR_SCORE: Record<string, number> = { green: 1, yellow: 0.5, red: 0 };

/** 실시간 tick 색상으로 계산한 "스피치 정확도" (0~100). tick이 없으면 null */
export function computeAccuracy(colors: string[]): number | null {
  if (colors.length === 0) return null;
  const sum = colors.reduce((s, c) => s + (COLOR_SCORE[c] ?? 0), 0);
  return Math.round((sum / colors.length) * 100);
}

export function buildSpeechMetrics(input: {
  ticks: TickRow[];
  transcript: string;
  durationSec: number;
}): SpeechMetrics {
  const { ticks, transcript, durationSec } = input;

  // 실시간(5초 단위)과 전체 전사 중 더 많이 잡힌 쪽을 채택
  const fillerFromTicks = ticks.reduce((s, t) => s + t.fillerCnt, 0);
  const fillerCount = Math.max(fillerFromTicks, countFillers(transcript));

  const avgVolumeDb = ticks.length
    ? ticks.reduce((s, t) => s + t.volumeDb, 0) / ticks.length
    : -60;

  const colorCounts = { green: 0, yellow: 0, red: 0 };
  for (const t of ticks) {
    if (t.color === "green" || t.color === "yellow" || t.color === "red") {
      colorCounts[t.color]++;
    }
  }

  const emotionCounts: Partial<Record<Emotion, number>> = {};
  const audioEvents: Record<string, number> = {};
  for (const t of ticks) {
    const emotion = EmotionSchema.safeParse(t.emotion);
    if (emotion.success) {
      emotionCounts[emotion.data] = (emotionCounts[emotion.data] ?? 0) + 1;
    }
    // 말소리는 당연히 있으니 웃음·박수 같은 특이 이벤트만 센다
    if (t.audioEvent && t.audioEvent !== "Speech") {
      audioEvents[t.audioEvent] = (audioEvents[t.audioEvent] ?? 0) + 1;
    }
  }

  return {
    avgWpm: computeWpm(transcript, durationSec * 1000),
    fillerCount,
    avgVolumeDb,
    durationSec,
    // speedWpm 0 은 무음·STT 미수행 구간이라 추이에서 제외
    wpmTimeline: ticks
      .filter((t) => t.speedWpm > 0)
      .map((t) => ({ offsetMs: t.offsetMs, wpm: t.speedWpm })),
    accuracy: computeAccuracy(ticks.map((t) => t.color)),
    colorCounts,
    emotionCounts,
    audioEvents,
  };
}
