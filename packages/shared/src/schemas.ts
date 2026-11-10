import { z } from "zod";

// ============================================================
// 공통 enum
// ============================================================

export const TickColorSchema = z.enum(["green", "yellow", "red"]);
export type TickColor = z.infer<typeof TickColorSchema>;

export const SessionStatusSchema = z.enum([
  "IN_PROGRESS",
  "ANALYZING",
  "COMPLETED",
  "FAILED",
]);
export type SessionStatus = z.infer<typeof SessionStatusSchema>;

// ============================================================
// REST API DTO
// ============================================================

export const SignupRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
});
export type SignupRequest = z.infer<typeof SignupRequestSchema>;

export const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const AppleLoginRequestSchema = z.object({
  identityToken: z.string(),
  name: z.string().optional(),
});
export type AppleLoginRequest = z.infer<typeof AppleLoginRequestSchema>;

export const UserSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
});
export type User = z.infer<typeof UserSchema>;

export const AuthResponseSchema = z.object({
  token: z.string(),
  user: UserSchema,
});
export type AuthResponse = z.infer<typeof AuthResponseSchema>;

export const CreateSessionRequestSchema = z.object({
  title: z.string().min(1).max(200),
});
export type CreateSessionRequest = z.infer<typeof CreateSessionRequestSchema>;

export const CreateSessionResponseSchema = z.object({
  sessionId: z.string(),
  wsToken: z.string(),
});
export type CreateSessionResponse = z.infer<typeof CreateSessionResponseSchema>;

// ============================================================
// Socket.IO 이벤트 스키마 (/live 네임스페이스)
// ============================================================

export const SessionJoinSchema = z.object({
  sessionId: z.string().min(1),
  token: z.string().min(1),
});
export type SessionJoin = z.infer<typeof SessionJoinSchema>;

export const AudioChunkSchema = z.object({
  seq: z.number().int().nonnegative(),
  timestampMs: z.number().nonnegative(),
  pcmBase64: z.string(),
});
export type AudioChunk = z.infer<typeof AudioChunkSchema>;

export const EmotionSchema = z.enum([
  "NEUTRAL",
  "HAPPY",
  "SAD",
  "ANGRY",
  "FEARFUL",
  "DISGUSTED",
  "SURPRISED",
]);
export type Emotion = z.infer<typeof EmotionSchema>;

export const EMOTION_LABEL_KO: Record<Emotion, string> = {
  NEUTRAL: "중립",
  HAPPY: "기쁨",
  SAD: "슬픔",
  ANGRY: "화남",
  FEARFUL: "긴장·불안",
  DISGUSTED: "불쾌",
  SURPRISED: "놀람",
};

/** 발표 중 이 감정이 강하게 잡히면 피드백 대상 */
export const NEGATIVE_EMOTIONS: readonly Emotion[] = ["SAD", "ANGRY", "FEARFUL", "DISGUSTED"];

export const AUDIO_EVENT_LABEL_KO: Record<string, string> = {
  Laughter: "웃음",
  Applause: "박수",
  BGM: "배경음악",
  Cough: "기침",
  Cry: "울음",
  Sneeze: "재채기",
  Breath: "숨소리",
};

export const TickIssueSchema = z.enum([
  "too_fast",
  "too_slow",
  "too_quiet",
  "fillers",
  "emotion_negative",
]);
export type TickIssue = z.infer<typeof TickIssueSchema>;

export const FeedbackTickSchema = z.object({
  seq: z.number().int().nonnegative(),
  color: TickColorSchema,
  speedWpm: z.number(),
  volumeDb: z.number(),
  fillerCnt: z.number().int(),
  issues: z.array(TickIssueSchema),
  silent: z.boolean(),
  /** 감정 서비스(SenseVoice·emotion2vec+) 결과. 서비스가 꺼져 있거나 무음이면 null */
  emotion: EmotionSchema.nullable(),
  emotionScore: z.number().nullable(),
  /** SenseVoice 오디오 이벤트 (Speech, Laughter, Applause ...) */
  audioEvent: z.string().nullable(),
  /** 이번 5초 구간 자막. Whisper 전사, 실패하면 SenseVoice 전사. 무음·환각이면 null */
  transcript: z.string().nullable(),
  tip: z.string().optional(),
});
export type FeedbackTick = z.infer<typeof FeedbackTickSchema>;

export const SessionJoinedSchema = z.object({
  sessionId: z.string(),
});
export type SessionJoined = z.infer<typeof SessionJoinedSchema>;

export const SessionEndedSchema = z.object({
  sessionId: z.string(),
  reportJobId: z.string().optional(),
});
export type SessionEnded = z.infer<typeof SessionEndedSchema>;

/** `session:end` ack 응답 */
export type SessionEndAck =
  | { ok: true; jobId: string }
  | { ok: false; error: "AUDIO_EMPTY" | "END_FAILED" };

export const SocketErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
});
export type SocketError = z.infer<typeof SocketErrorSchema>;

// ============================================================
// 보고서 스키마 (GPT 출력)
// ============================================================

export const ReportSummarySchema = z.object({
  mainTopic: z.string(),
  keyMessages: z.array(z.string()),
});

export const VoiceAnalysisSchema = z.object({
  tone: z.string(),
  speed: z.string(),
  clarity: z.string(),
  stability: z.string(),
});

export const ContentAnalysisSchema = z.object({
  logic: z.string(),
  structure: z.string(),
  persuasiveness: z.string(),
});

export const CoachingReportSchema = z.object({
  overallScore: z.number().int().min(0).max(100),
  summary: ReportSummarySchema,
  voiceAnalysis: VoiceAnalysisSchema,
  contentAnalysis: ContentAnalysisSchema,
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  roadmap: z.object({
    shortTerm: z.array(z.string()),
    longTerm: z.array(z.string()),
  }),
});
export type CoachingReport = z.infer<typeof CoachingReportSchema>;

export const SpeechMetricsSchema = z.object({
  avgWpm: z.number(),
  fillerCount: z.number().int(),
  avgVolumeDb: z.number(),
  durationSec: z.number(),
  wpmTimeline: z.array(z.object({ offsetMs: z.number(), wpm: z.number() })).optional(),
  /** 실시간 tick 색상 기반 정확도 (green 1, yellow 0.5, red 0 평균 × 100). tick 없으면 null */
  accuracy: z.number().nullable().optional(),
  colorCounts: z
    .object({ green: z.number(), yellow: z.number(), red: z.number() })
    .optional(),
  /** 5초 구간별 감정 집계 (감정 서비스가 켜져 있을 때만) */
  emotionCounts: z.record(EmotionSchema, z.number()).optional(),
  /** 말소리(Speech)를 제외한 오디오 이벤트 횟수 */
  audioEvents: z.record(z.string(), z.number()).optional(),
});
export type SpeechMetrics = z.infer<typeof SpeechMetricsSchema>;

// ============================================================
// 판정 임계값 상수 (한국어 기준)
// ============================================================

export const TICK_THRESHOLDS = {
  SPEED_MIN_WPM: 220,
  SPEED_MAX_WPM: 340,
  VOLUME_MIN_DB: -35,
  FILLER_MAX_PER_CHUNK: 1,
  SILENCE_DB: -50,
  EMOTION_NEGATIVE_MIN_SCORE: 0.5,
} as const;

// ============================================================
// 감정 요약 (보고서·PDF·앱 공통)
// ============================================================

export interface EmotionSummary {
  dominant: Emotion;
  /** 대표 감정 비율 0~1 */
  ratio: number;
  /** 부정 감정(NEGATIVE_EMOTIONS) 비율 0~1 */
  negativeRatio: number;
  total: number;
}

export function summarizeEmotions(
  counts: Partial<Record<Emotion, number>> | undefined
): EmotionSummary | null {
  const entries = Object.entries(counts ?? {}) as [Emotion, number][];
  const total = entries.reduce((s, [, n]) => s + n, 0);
  if (total === 0) return null;
  const [dominant, top] = entries.reduce((a, b) => (b[1] > a[1] ? b : a));
  const negative = entries
    .filter(([e]) => NEGATIVE_EMOTIONS.includes(e))
    .reduce((s, [, n]) => s + n, 0);
  return { dominant, ratio: top / total, negativeRatio: negative / total, total };
}
