import { describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { renderReportPdf } from "./pdf.js";

describe("renderReportPdf", () => {
  it("한글 폰트(Pretendard)를 임베드한 PDF를 만든다", async () => {
    const out = path.join(os.tmpdir(), `pitches-pdf-test-${Date.now()}.pdf`);
    await renderReportPdf(
      {
        title: "한글 발표 테스트",
        generatedAt: new Date("2026-10-29T12:00:00Z"),
        metrics: {
          avgWpm: 280,
          fillerCount: 3,
          avgVolumeDb: -22,
          durationSec: 95,
          accuracy: 84,
          colorCounts: { green: 15, yellow: 3, red: 1 },
          emotionCounts: { NEUTRAL: 14, HAPPY: 3, FEARFUL: 2 },
          audioEvents: { Laughter: 1 },
        },
        report: {
          overallScore: 78,
          summary: { mainTopic: "감정 인식 기술", keyMessages: ["핵심 메시지"] },
          voiceAnalysis: { tone: "중립적", speed: "적절", clarity: "명료", stability: "안정" },
          contentAnalysis: { logic: "논리적", structure: "서론-본론-결론", persuasiveness: "보통" },
          strengths: ["또렷한 발음"],
          weaknesses: ["간투사 사용"],
          roadmap: { shortTerm: ["녹음 후 다시 듣기"], longTerm: ["청중 앞 발표 10회"] },
        },
      },
      out
    );
    const buf = await fs.readFile(out);
    await fs.rm(out, { force: true });
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(buf.includes("Pretendard")).toBe(true);
  });
});
