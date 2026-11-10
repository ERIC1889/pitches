import { TICK_THRESHOLDS, type FeedbackTick } from "@pitches/shared";
import { config } from "../config.js";
import { logger } from "../lib/logger.js";
import { transcribeChunk } from "../services/stt.js";
import { analyzeEmotion, type EmotionResult } from "../services/emotion.js";
import { classify } from "./classify.js";
import { isLikelyHallucination } from "./sttFilter.js";
import { computeRmsDb } from "./features/rms.js";
import { countFillers } from "./features/fillers.js";
import { computeWpm } from "./features/wpm.js";

const DEFAULT_STT_TIMEOUT_MS = 4000;
const EMOTION_TIMEOUT_MS = 3000;

export interface PipelineMeta {
  seq: number;
  durationMs: number;
}

export interface PipelineDeps {
  /** 미지정 시 REALTIME_STT=on 이면 Whisper 부분 전사, off 면 STT 생략 */
  transcribe?: (pcm: Buffer) => Promise<string>;
  sttTimeoutMs?: number;
  /** 미지정 시 EMOTION_URL 이 있으면 감정 서비스 호출, 비어 있으면 생략 */
  analyzeEmotion?: (pcm: Buffer) => Promise<EmotionResult>;
}

export interface PipelineResult {
  tick: FeedbackTick;
  /** 부분 전사 결과 (환각 필터 후). STT를 안 했거나 실패하면 null */
  text: string | null;
}

/**
 * 5초 누적된 PCM 버퍼를 받아 실시간 판정을 돌린다.
 *  1) RMS 음량 — 무음이면 여기서 끝 (STT 비용 + 환각 방지)
 *  2) 부분 STT → 말하기 속도(자/분) + 간투사 수   ┐ 병렬
 *     감정 서비스 → 감정(+확신도) + 오디오 이벤트  ┘
 *  3) 규칙 기반 색상 판정
 */
export async function runPipeline(
  pcm: Buffer,
  meta: PipelineMeta,
  deps: PipelineDeps = {}
): Promise<PipelineResult> {
  const volumeDb = computeRmsDb(pcm);
  const silent = volumeDb < TICK_THRESHOLDS.SILENCE_DB;

  const transcribe =
    deps.transcribe ??
    (config.REALTIME_STT === "on"
      ? (buf: Buffer) =>
          transcribeChunk(buf, {
            timeoutMs: deps.sttTimeoutMs ?? DEFAULT_STT_TIMEOUT_MS,
          })
      : undefined);

  const emotionOf =
    deps.analyzeEmotion ??
    (config.EMOTION_URL
      ? (buf: Buffer) => analyzeEmotion(buf, { timeoutMs: EMOTION_TIMEOUT_MS })
      : undefined);

  const [rawText, emo] = silent
    ? [null, null]
    : await Promise.all([
        transcribe
          ? withTimeout(transcribe(pcm), deps.sttTimeoutMs ?? DEFAULT_STT_TIMEOUT_MS).catch(
              (err) => {
                logger.warn({ err, seq: meta.seq }, "partial STT failed, volume only");
                return null;
              }
            )
          : null,
        emotionOf
          ? withTimeout(emotionOf(pcm), EMOTION_TIMEOUT_MS).catch((err) => {
              // 감정 서비스는 선택 사항 — 꺼져 있어도 판정은 계속
              logger.debug({ err, seq: meta.seq }, "emotion analysis skipped");
              return null;
            })
          : null,
      ]);
  const text = rawText !== null && isLikelyHallucination(rawText) ? "" : rawText;
  // 자막: Whisper 가 우선, 실패하면 감정 서비스의 SenseVoice 전사 (판정에는 쓰지 않음)
  const fallbackText = emo?.text && !isLikelyHallucination(emo.text) ? emo.text.trim() : "";
  const transcript = text || fallbackText || null;

  const speedWpm = text ? computeWpm(text, meta.durationMs) : null;
  const fillerCnt = text ? countFillers(text) : 0;
  const emotion = emo?.emotion ?? null;
  const emotionScore = emo?.score ?? null;
  const { color, issues, tip } = classify({
    speedWpm,
    volumeDb,
    fillerCnt,
    emotion,
    emotionScore,
  });

  return {
    tick: {
      seq: meta.seq,
      color,
      speedWpm: speedWpm ?? 0,
      volumeDb,
      fillerCnt,
      issues,
      silent,
      emotion,
      emotionScore,
      audioEvent: emo?.event ?? null,
      transcript,
      tip,
    },
    text,
  };
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout ${ms}ms`)), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      }
    );
  });
}
