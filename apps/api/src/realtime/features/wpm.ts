/**
 * 한국어 기준 분당 글자 수(CPM)를 WPM 프록시로 계산.
 * 공백 제외 글자 수 / 시간(초) × 60
 */
export function computeWpm(text: string, durationMs: number): number {
  if (durationMs <= 0) return 0;
  const chars = text.replace(/\s+/g, "").length;
  return (chars / (durationMs / 1000)) * 60;
}
