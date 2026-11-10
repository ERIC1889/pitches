import { defineConfig } from "vitest/config";

// Docker(Postgres/Redis)가 떠 있어야 하는 통합 테스트
export default defineConfig({
  test: {
    include: ["test/**/*.int.test.ts"],
    environment: "node",
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
    env: { REALTIME_STT: "off", EMOTION_URL: "", REPORT_QUEUE: "reports-test" },
  },
});
