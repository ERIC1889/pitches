import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    // 기본 의존성(Whisper·감정 서비스)이 실제로 호출되지 않도록 끈다. 필요한 테스트는 deps 로 주입
    env: { REALTIME_STT: "off", EMOTION_URL: "" },
  },
});
