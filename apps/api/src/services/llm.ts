import OpenAI from "openai";
import {
  AUDIO_EVENT_LABEL_KO,
  EMOTION_LABEL_KO,
  TICK_THRESHOLDS,
  CoachingReportSchema,
  type Emotion,
  type CoachingReport,
  type SpeechMetrics,
} from "@pitches/shared";
import { config } from "../config.js";

const openai = new OpenAI({ apiKey: config.OPENAI_API_KEY });

const SYSTEM_PROMPT = `너는 한국어 발표 코칭 전문가다. 아래 데이터를 기반으로 아래 JSON 스키마에 정확히 맞춰 분석하라.
JSON 외 다른 텍스트는 출력하지 말 것.

[JSON 스키마]
{
  "overallScore": 0-100 정수,
  "summary": { "mainTopic": string, "keyMessages": string[] },
  "voiceAnalysis": { "tone": string, "speed": string, "clarity": string, "stability": string },
  "contentAnalysis": { "logic": string, "structure": string, "persuasiveness": string },
  "strengths": string[],
  "weaknesses": string[],
  "roadmap": { "shortTerm": string[], "longTerm": string[] }
}

평가 원칙:
- 과도한 칭찬 금지. 객관적 지표와 스크립트 근거를 들어 평가할 것.
- 약점은 구체적이고 실행 가능한 형태로.
- shortTerm 로드맵은 2주 내 실행 가능한 3개, longTerm은 3개월 이상의 목표 3개.
- voiceAnalysis.speed 는 구간별 속도 변화(초반/중반/후반)가 주어지면 그 흐름을 짚어서 서술.
- [발표 통계]는 발표자의 음성 전달 지표다. 발표 내용에 나오는 제품·서비스의 성능으로 해석하지 말 것.
- 음량은 괄호 안의 판정(적정/작음)을 따를 것. dB 숫자만 보고 크기를 판단하지 말 것.
- voiceAnalysis.tone 은 음성 감정 분포가 주어지면 "평균 톤: 중립적 톤 유지 (NEUTRAL)." 형식의 한 문장으로 시작하고, 이어서 감정 변화와 개선 방향을 서술할 것.
- 긴장·불안(FEARFUL)이나 슬픔(SAD) 비율이 높으면 weaknesses 와 roadmap 에 긴장 완화 방법을 포함할 것.
- 모든 문장은 한국어 존댓말로.`;

export interface ReportInput {
  transcript: string;
  metrics: SpeechMetrics;
}

export async function generateCoachingReport(
  input: ReportInput
): Promise<CoachingReport> {
  const userPrompt = buildUserPrompt(input);
  // JSON 이 잘리거나 스키마가 어긋나는 경우가 있어 1회 재시도
  for (let attempt = 1; ; attempt++) {
    // gpt-5 계열은 temperature 를 기본값(1)만 허용하므로 보내지 않는다
    const res = await openai.chat.completions.create({
      model: config.OPENAI_REPORT_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    });
    const raw = res.choices[0]?.message.content ?? "{}";
    try {
      return CoachingReportSchema.parse(JSON.parse(raw));
    } catch (err) {
      if (attempt >= 2) throw err;
    }
  }
}

function buildUserPrompt({ transcript, metrics }: ReportInput): string {
  const lines = [
    `- 발표 시간: ${Math.round(metrics.durationSec)}초`,
    `- 평균 말하기 속도: ${metrics.avgWpm.toFixed(0)}자/분 (적정 220~340자/분)`,
    `- 총 간투사 횟수: ${metrics.fillerCount}`,
    `- 평균 음량: ${metrics.avgVolumeDb.toFixed(1)}dB (${
      metrics.avgVolumeDb < TICK_THRESHOLDS.VOLUME_MIN_DB ? "작음" : "적정"
    })`,
  ];
  if (metrics.accuracy != null) {
    lines.push(
      `- 발표자 전달 점수: ${metrics.accuracy}점/100 (5초 구간별 속도·음량·간투사 판정 기반)`
    );
  }
  if (metrics.colorCounts) {
    const { green, yellow, red } = metrics.colorCounts;
    lines.push(`- 5초 구간 판정: 양호 ${green} / 주의 ${yellow} / 경고 ${red}`);
  }
  const emotions = Object.entries(metrics.emotionCounts ?? {}) as [Emotion, number][];
  if (emotions.length > 0) {
    const desc = emotions
      .sort((a, b) => b[1] - a[1])
      .map(([e, n]) => `${EMOTION_LABEL_KO[e]}(${e}) ${n}`)
      .join(" / ");
    lines.push(`- 음성 감정 분포(5초 구간 수, SenseVoice·emotion2vec+ 분석): ${desc}`);
  }
  const events = Object.entries(metrics.audioEvents ?? {});
  if (events.length > 0) {
    const desc = events
      .map(([e, n]) => `${AUDIO_EVENT_LABEL_KO[e] ?? e} ${n}회`)
      .join(", ");
    lines.push(`- 감지된 소리 이벤트: ${desc}`);
  }
  const phases = splitIntoThirds(metrics.wpmTimeline ?? []);
  if (phases) {
    lines.push(
      `- 구간별 평균 속도(자/분): 초반 ${phases[0]} / 중반 ${phases[1]} / 후반 ${phases[2]}`
    );
  }
  return `[발표 스크립트]
${transcript}

[발표 통계]
${lines.join("\n")}`;
}

/** 속도 추이를 초반·중반·후반 평균으로 요약. 구간이 3개 미만이면 null */
function splitIntoThirds(
  timeline: { offsetMs: number; wpm: number }[]
): [number, number, number] | null {
  if (timeline.length < 3) return null;
  const size = timeline.length / 3;
  const avg = (part: typeof timeline) =>
    Math.round(part.reduce((s, p) => s + p.wpm, 0) / part.length);
  return [
    avg(timeline.slice(0, Math.round(size))),
    avg(timeline.slice(Math.round(size), Math.round(size * 2))),
    avg(timeline.slice(Math.round(size * 2))),
  ];
}
