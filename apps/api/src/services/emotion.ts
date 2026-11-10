import { z } from "zod";
import { EmotionSchema, type Emotion } from "@pitches/shared";
import { config } from "../config.js";

export interface EmotionResult {
  emotion: Emotion | null;
  /** emotion2vec+ 확신도. SenseVoice 태그로 대체된 경우 null */
  score: number | null;
  event: string | null;
  /** SenseVoice 전사 (문장부호 없음). Whisper 를 못 쓸 때 자막 대체용 */
  text?: string | null;
}

const ResponseSchema = z.object({
  emotion: EmotionSchema.nullable(),
  score: z.number().nullable(),
  event: z.string().nullable(),
  text: z.string().nullable().optional(),
});

/**
 * apps/emotion 서비스에 5초 PCM(16kHz mono int16, 헤더 없음)을 보내 감정·오디오 이벤트를 받는다.
 */
export async function analyzeEmotion(
  pcm: Buffer,
  opts: { timeoutMs: number }
): Promise<EmotionResult> {
  const res = await fetch(`${config.EMOTION_URL}/analyze`, {
    method: "POST",
    headers: { "content-type": "application/octet-stream" },
    body: pcm,
    signal: AbortSignal.timeout(opts.timeoutMs),
  });
  if (!res.ok) throw new Error(`emotion service ${res.status}`);
  return ResponseSchema.parse(await res.json());
}
