import fs from "node:fs/promises";

export interface WavFormat {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
}

/**
 * PCM raw 데이터에 RIFF/WAVE 헤더를 붙여 표준 WAV 포맷으로 만든다.
 * Whisper API는 PCM raw를 받지 않지만 WAV는 지원.
 */
export function buildWavHeader(fmt: WavFormat, dataSize: number): Buffer {
  const { sampleRate, channels, bitsPerSample } = fmt;
  const byteRate = (sampleRate * channels * bitsPerSample) / 8;
  const blockAlign = (channels * bitsPerSample) / 8;
  const buf = Buffer.alloc(44);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16); // fmt chunk size
  buf.writeUInt16LE(1, 20); // format = PCM
  buf.writeUInt16LE(channels, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(byteRate, 28);
  buf.writeUInt16LE(blockAlign, 32);
  buf.writeUInt16LE(bitsPerSample, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(dataSize, 40);
  return buf;
}

export async function pcmFileToWav(
  pcmPath: string,
  wavPath: string,
  fmt: WavFormat
): Promise<void> {
  const pcm = await fs.readFile(pcmPath);
  const header = buildWavHeader(fmt, pcm.length);
  await fs.writeFile(wavPath, Buffer.concat([header, pcm]));
}
