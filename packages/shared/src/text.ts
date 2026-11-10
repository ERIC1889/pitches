/**
 * 한국어 발화 텍스트 처리 (서버 간투사 집계 · 앱 자막 표시 공통)
 */

/**
 * 토큰 전체가 간투사일 때만 간투사로 본다. 부분 매칭은 "어떻게", "음식"까지 잡아내서 쓰지 않는다.
 * 단독 "그"는 관형사("그 사람")와 구분이 안 돼서 늘어진 형태("그으", "그그")만 센다.
 */
const FILLER_TOKEN = /^(으*음+|어+|아+|에+|흠+|저기|그[그으]+|뭐)$/;
const PUNCTUATION = /[.,!?…~·"'()]/g;

export function isFillerToken(token: string): boolean {
  return FILLER_TOKEN.test(token.replace(PUNCTUATION, ""));
}

export interface CaptionToken {
  text: string;
  filler: boolean;
}

/** 자막 강조용. 공백을 그대로 보존해서 이어 붙이면 원문이 된다 */
export function splitCaptionTokens(text: string): CaptionToken[] {
  return text
    .split(/(\s+)/)
    .filter((t) => t.length > 0)
    .map((t) => ({ text: t, filler: !/^\s+$/.test(t) && isFillerToken(t) }));
}

/** 이보다 짧은 마지막 조각("발표 중에")은 아직 말하는 중이라 직전 문장을 계속 보여준다 */
const MIN_SENTENCE_CHARS = 6;

/**
 * 발표에서 흔한 존댓말 종결 어미. 문장부호가 없는 전사(SenseVoice)도 여기서 문장을 나눈다.
 * "요" 단독은 "필요" 같은 명사까지 잡아서 앞 글자와 묶은 형태만 쓴다.
 */
const SENTENCE_ENDING = /(니다|[어아에예해세네군]요|까요|니까|죠)(?=\s|$)/g;

const markEndings = (s: string) =>
  s.replace(/\s+/g, " ").trim().replace(SENTENCE_ENDING, "$1.");
const TERMINAL = /[.?!…]/;

/**
 * 5초 단위로 들어온 전사 조각들을 이어 붙여 지금 보여줄 한 문장을 고른다.
 *  - 최신 조각에서 문장이 끝났으면 → 방금 끝난 완성 문장
 *  - 아직 끝나지 않았으면 → 말하고 있는 문장 (여러 조각에 걸칠 수 있음)
 * 문장부호나 종결 어미가 없으면 남은 조각 전체를 한 문장으로 본다.
 */
export function currentSentence(chunks: string[]): string {
  const joined = markEndings(chunks.join(" "));
  if (!joined) return "";
  // lookbehind 없이 "문장 + 끝 부호" 단위로 자른다 (앱 JS 엔진 호환)
  const sentences = (joined.match(/[^.?!…]+[.?!…]*/g) ?? [])
    .map((s) => s.trim())
    .filter(Boolean);
  if (sentences.length === 0) return "";
  const last = sentences[sentences.length - 1]!;
  const prev = sentences[sentences.length - 2];
  const lastDone = TERMINAL.test(last.slice(-1));
  const newestEnds = TERMINAL.test(markEndings(chunks[chunks.length - 1] ?? ""));
  if (prev && !lastDone && newestEnds) return prev;
  if (prev && last.replace(/[\s.?!…]/g, "").length < MIN_SENTENCE_CHARS) return prev;
  return last;
}
