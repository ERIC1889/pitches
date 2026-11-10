import OpenAI, { toFile } from "openai";
import fs from "node:fs";
import { config } from "../config.js";
import { buildWavHeader } from "../lib/wav.js";

const openai = new OpenAI({ apiKey: config.OPENAI_API_KEY });

// Whisper는 기본적으로 "음/어"를 지워버린다. 간투사가 섞인 예시 문장을 프롬프트로 주면 그대로 받아적는다.
const FILLER_PROMPT = "음, 어, 그러니까... 저기, 뭐, 음 제가 오늘 발표할 내용은 어...";

/**
 * 실시간 판정용 5초 PCM(16kHz mono int16) 부분 전사.
 * 지연이 판정 주기를 넘지 않도록 재시도 없이 timeoutMs 안에 끝낸다.
 */
export async function transcribeChunk(
  pcm: Buffer,
  opts: { timeoutMs: number }
): Promise<string> {
  const header = buildWavHeader(
    { sampleRate: 16000, channels: 1, bitsPerSample: 16 },
    pcm.length
  );
  const file = await toFile(Buffer.concat([header, pcm]), "chunk.wav", {
    type: "audio/wav",
  });
  const res = await openai.audio.transcriptions.create(
    {
      file,
      model: config.OPENAI_STT_MODEL,
      language: "ko",
      prompt: FILLER_PROMPT,
      response_format: "json",
    },
    { timeout: opts.timeoutMs, maxRetries: 0 }
  );
  return res.text.trim();
}

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

export interface TranscriptResult {
  text: string;
  segments: TranscriptSegment[];
  language: string;
  duration: number;
}

/**
 * Whisper API로 파일 전체 전사. 발표 종료 후 호출.
 */
export async function transcribeFile(
  filePath: string,
  language = "ko"
): Promise<TranscriptResult> {
  const res = await openai.audio.transcriptions.create({
    file: fs.createReadStream(filePath),
    model: "whisper-1",
    language,
    response_format: "verbose_json",
  });

  // SDK 타입이 좁아서 any 경유
  const raw = res as unknown as {
    text: string;
    language: string;
    duration: number;
    segments: Array<{ start: number; end: number; text: string }>;
  };

  return {
    text: raw.text,
    language: raw.language,
    duration: raw.duration,
    segments: (raw.segments ?? []).map((s) => ({
      start: s.start,
      end: s.end,
      text: s.text,
    })),
  };
}
