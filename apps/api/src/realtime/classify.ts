import {
  NEGATIVE_EMOTIONS,
  TICK_THRESHOLDS,
  type Emotion,
  type TickColor,
  type TickIssue,
} from "@pitches/shared";

export interface TickFeatures {
  /** 자/분. STT 결과가 없으면 null (속도 판정 생략) */
  speedWpm: number | null;
  volumeDb: number;
  fillerCnt: number;
  /** 감정 서비스가 꺼져 있으면 생략 */
  emotion?: Emotion | null;
  emotionScore?: number | null;
}

export interface Classification {
  color: TickColor;
  issues: TickIssue[];
  tip?: string;
}

// 이슈가 여러 개면 이 순서대로 첫 번째 팁을 보여준다
const TIPS: Record<TickIssue, string> = {
  too_fast: "속도가 빨라졌어요. 조금 천천히 말해보세요",
  too_slow: "속도가 느려요. 조금 더 빠르게 말해보세요",
  too_quiet: "목소리를 조금 더 크게 해주세요",
  fillers: "간투사(음, 어)를 줄여보세요",
  emotion_negative: "목소리에 긴장감이 느껴져요. 호흡을 가다듬고 차분하게 말해보세요",
};

export function classify(f: TickFeatures): Classification {
  const issues: TickIssue[] = [];
  if (f.speedWpm !== null) {
    if (f.speedWpm > TICK_THRESHOLDS.SPEED_MAX_WPM) issues.push("too_fast");
    else if (f.speedWpm < TICK_THRESHOLDS.SPEED_MIN_WPM) issues.push("too_slow");
  }
  if (f.volumeDb < TICK_THRESHOLDS.VOLUME_MIN_DB) issues.push("too_quiet");
  if (f.fillerCnt > TICK_THRESHOLDS.FILLER_MAX_PER_CHUNK) issues.push("fillers");
  // SenseVoice 태그로 대체된 감정(확신도 없음)은 오탐 위험이 있어 판정에 쓰지 않는다
  if (
    f.emotion &&
    NEGATIVE_EMOTIONS.includes(f.emotion) &&
    (f.emotionScore ?? 0) >= TICK_THRESHOLDS.EMOTION_NEGATIVE_MIN_SCORE
  ) {
    issues.push("emotion_negative");
  }

  const color: TickColor =
    issues.length === 0 ? "green" : issues.length === 1 ? "yellow" : "red";

  return { color, issues, tip: issues[0] ? TIPS[issues[0]] : undefined };
}
