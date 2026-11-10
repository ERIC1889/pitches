/**
 * Whisper는 무음·잡음 구간에서 학습 데이터(유튜브 자막)에 흔한 문구를 지어내는 경향이 있다.
 * 이런 텍스트가 속도·간투사 계산에 섞이지 않도록 걸러낸다.
 */
const HALLUCINATION_PHRASES = [
  "시청해주셔서감사합니다",
  "시청해주셔서고맙습니다",
  "끝까지시청",
  "구독과좋아요",
  "좋아요와구독",
  "구독좋아요",
  "다음영상에서",
  "자막제공",
  "자막by",
  "mbc뉴스",
  "kbs뉴스",
  "sbs뉴스",
  "이덕영입니다",
];

export function isLikelyHallucination(text: string): boolean {
  const normalized = text.replace(/[\s.,!?…~]+/g, "").toLowerCase();
  if (normalized.length === 0) return true;
  return HALLUCINATION_PHRASES.some((p) => normalized.includes(p));
}
