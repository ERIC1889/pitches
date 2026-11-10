import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { config } from "../config.js";
import { pcmFileToWav } from "../lib/wav.js";

const AUDIO_DIR = path.join(config.LOCAL_UPLOAD_DIR, "audio");
const FMT = { sampleRate: 16000, channels: 1, bitsPerSample: 16 } as const;

interface CaptureHandle {
  pcmPath: string;
  stream: fs.WriteStream;
  bytes: number;
}

export interface CaptureResult {
  wavPath: string;
  /** 녹음된 PCM 바이트 수 (헤더 제외) */
  bytes: number;
}

const captures = new Map<string, CaptureHandle>();

/**
 * 세션 녹음 파일을 연다. 이미 녹음 중이면 false — 두 번째 스트림이 앞 녹음을 덮어쓰거나
 * 닫히지 않은 파일 핸들이 쌓이지 않도록.
 */
export function startCapture(sessionId: string): boolean {
  if (captures.has(sessionId)) return false;
  fs.mkdirSync(AUDIO_DIR, { recursive: true });
  const pcmPath = path.join(AUDIO_DIR, `${sessionId}.pcm`);
  const stream = fs.createWriteStream(pcmPath);
  captures.set(sessionId, { pcmPath, stream, bytes: 0 });
  return true;
}

export function appendChunk(sessionId: string, pcm: Buffer): void {
  const h = captures.get(sessionId);
  if (!h) return;
  h.stream.write(pcm);
  h.bytes += pcm.length;
}

/**
 * PCM 스트림을 닫고 WAV로 변환한다. 성공 시 WAV 경로와 녹음 바이트 수를 반환.
 */
export async function finishCapture(
  sessionId: string
): Promise<CaptureResult | null> {
  const h = captures.get(sessionId);
  if (!h) return null;
  captures.delete(sessionId);

  await new Promise<void>((resolve) => h.stream.end(() => resolve()));

  const wavPath = h.pcmPath.replace(/\.pcm$/, ".wav");
  try {
    await pcmFileToWav(h.pcmPath, wavPath, FMT);
    await fsp.unlink(h.pcmPath).catch(() => {});
    return { wavPath, bytes: h.bytes };
  } catch (err) {
    // WAV 변환 실패해도 PCM은 남겨둠 (디버깅용)
    return null;
  }
}
