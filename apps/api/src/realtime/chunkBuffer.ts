/**
 * RN의 react-native-live-audio-stream 가 수백 ms 단위로 작은 PCM 조각을 흘려보낸다.
 * 실시간 판정은 5초 단위라서 여기서 세션별로 누적했다가 임계치에 도달하면 방출.
 *
 * 임계치: 5초 × 16kHz × 2 bytes(mono int16) = 160,000 bytes
 */

const SAMPLE_RATE = 16000;
const BYTES_PER_SAMPLE = 2;
const WINDOW_SEC = 5;
const THRESHOLD_BYTES = SAMPLE_RATE * BYTES_PER_SAMPLE * WINDOW_SEC;

interface SessionBuffer {
  pieces: Buffer[];
  bytes: number;
  windowStartMs: number;
  seq: number;
}

const buffers = new Map<string, SessionBuffer>();

export interface BufferResult {
  ready: boolean;
  pcm?: Buffer;
  offsetMs?: number;
  seq?: number;
  durationMs?: number;
}

export function pushChunk(
  sessionId: string,
  pcm: Buffer,
  timestampMs: number
): BufferResult {
  let buf = buffers.get(sessionId);
  if (!buf) {
    buf = { pieces: [], bytes: 0, windowStartMs: timestampMs, seq: 0 };
    buffers.set(sessionId, buf);
  }
  buf.pieces.push(pcm);
  buf.bytes += pcm.length;

  if (buf.bytes >= THRESHOLD_BYTES) {
    const aggregated = Buffer.concat(buf.pieces);
    const offsetMs = buf.windowStartMs;
    const seq = buf.seq++;
    const durationMs = (aggregated.length / (SAMPLE_RATE * BYTES_PER_SAMPLE)) * 1000;

    buf.pieces = [];
    buf.bytes = 0;
    buf.windowStartMs = timestampMs;

    return { ready: true, pcm: aggregated, offsetMs, seq, durationMs };
  }
  return { ready: false };
}

export function resetBuffer(sessionId: string): void {
  buffers.delete(sessionId);
}

/**
 * 세션 종료 시 남아있는 잔여 청크를 한 번에 flush.
 * 잔여가 없거나 매우 작으면 undefined.
 */
export function flushBuffer(sessionId: string): BufferResult | undefined {
  const buf = buffers.get(sessionId);
  if (!buf || buf.bytes < SAMPLE_RATE * BYTES_PER_SAMPLE) return undefined; // <1초
  const aggregated = Buffer.concat(buf.pieces);
  const offsetMs = buf.windowStartMs;
  const seq = buf.seq++;
  const durationMs =
    (aggregated.length / (SAMPLE_RATE * BYTES_PER_SAMPLE)) * 1000;
  buffers.delete(sessionId);
  return { ready: true, pcm: aggregated, offsetMs, seq, durationMs };
}
