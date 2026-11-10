import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  API_PORT: z.coerce.number().default(3000),
  API_HOST: z.string().default("0.0.0.0"),
  DATABASE_URL: z.string(),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  // 통합 테스트는 별도 큐를 써서 개발용 워커가 테스트 잡을 집어가지 않게 한다
  REPORT_QUEUE: z.string().default("reports"),
  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default("7d"),
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_STT_MODEL: z.string().default("whisper-1"),
  OPENAI_REPORT_MODEL: z.string().default("gpt-5-nano"),
  REALTIME_STT: z.enum(["on", "off"]).default("on"),
  // apps/emotion (SenseVoice·emotion2vec+) 주소. 빈 문자열이면 감정 분석 생략
  EMOTION_URL: z.string().default("http://127.0.0.1:8001"),
  STORAGE_DRIVER: z.enum(["local"]).default("local"),
  LOCAL_UPLOAD_DIR: z.string().default("./uploads"),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("❌ 환경변수 검증 실패:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;
export type Config = typeof config;
