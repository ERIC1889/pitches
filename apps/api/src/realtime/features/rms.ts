/**
 * 16-bit PCM little-endian 버퍼에서 RMS 음량(dB) 계산.
 */
export function computeRmsDb(pcm: Buffer): number {
  if (pcm.length < 2) return -100;
  const samples = pcm.length / 2;
  let sumSquares = 0;
  for (let i = 0; i < pcm.length; i += 2) {
    const s = pcm.readInt16LE(i) / 32768;
    sumSquares += s * s;
  }
  const rms = Math.sqrt(sumSquares / samples);
  if (rms === 0) return -100;
  return 20 * Math.log10(rms);
}
