import { Worker } from "bullmq";
import { Redis } from "ioredis";
import { PrismaClient, Prisma } from "@prisma/client";
import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../config.js";
import { logger } from "../lib/logger.js";
import { transcribeFile } from "../services/stt.js";
import { generateCoachingReport } from "../services/llm.js";
import { renderReportPdf } from "../services/pdf.js";
import { buildSpeechMetrics } from "../services/metrics.js";
import type { ReportJobData } from "../services/queue.js";

const connection = new Redis(config.REDIS_URL, {
  maxRetriesPerRequest: null,
});
const prisma = new PrismaClient();

export const reportWorker = new Worker<ReportJobData>(
  config.REPORT_QUEUE,
  async (job) => {
    const { sessionId } = job.data;
    logger.info({ jobId: job.id, sessionId }, "processing report job");

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });
    if (!session) throw new Error("session not found");
    if (!session.audioPath) throw new Error("audio file missing");

    // 0) WAV 파일이 너무 짧으면 (헤더 44 + 16kHz 16bit mono 1초 = 32044 bytes) Whisper에 못 보냄
    const audioStat = await fs.stat(session.audioPath);
    if (audioStat.size < 32_000) {
      logger.warn(
        { sessionId, size: audioStat.size },
        "audio too short, skipping transcription"
      );
      await prisma.session.update({
        where: { id: sessionId },
        data: { status: "FAILED" },
      });
      return { ok: false, reason: "audio_too_short", size: audioStat.size };
    }

    // 1) Whisper 풀 STT
    const stt = await transcribeFile(session.audioPath, "ko");

    // 2) 실시간 tick 들 집계 + 텍스트 기반 보정
    const ticks = await prisma.feedbackTick.findMany({
      where: { sessionId },
      orderBy: { offsetMs: "asc" },
    });

    const durationSec = stt.duration || 0;
    const metrics = buildSpeechMetrics({
      ticks,
      transcript: stt.text,
      durationSec,
    });

    // 3) LLM 보고서
    const report = await generateCoachingReport({
      transcript: stt.text,
      metrics,
    });

    // 4) PDF 렌더
    const reportsDir = path.join(config.LOCAL_UPLOAD_DIR, "reports");
    await fs.mkdir(reportsDir, { recursive: true });
    const pdfPath = path.join(reportsDir, `${sessionId}.pdf`);
    await renderReportPdf(
      {
        title: session.title,
        report,
        metrics,
        generatedAt: new Date(),
      },
      pdfPath
    );

    // 5) DB 저장
    await prisma.report.upsert({
      where: { sessionId },
      create: {
        sessionId,
        transcript: stt.text,
        overallScore: report.overallScore,
        summary: report as unknown as Prisma.InputJsonValue,
        speechMetrics: metrics as unknown as Prisma.InputJsonValue,
        pdfPath,
      },
      update: {
        transcript: stt.text,
        overallScore: report.overallScore,
        summary: report as unknown as Prisma.InputJsonValue,
        speechMetrics: metrics as unknown as Prisma.InputJsonValue,
        pdfPath,
        generatedAt: new Date(),
      },
    });

    await prisma.session.update({
      where: { id: sessionId },
      data: {
        status: "COMPLETED",
        durationSec: Math.round(durationSec),
      },
    });

    return { ok: true, sessionId };
  },
  { connection, concurrency: 2 }
);

reportWorker.on("completed", (job) => {
  logger.info({ jobId: job.id }, "report job completed");
});

reportWorker.on("failed", async (job, err) => {
  logger.error({ jobId: job?.id, err }, "report job failed");
  if (job?.data.sessionId) {
    await prisma.session
      .update({
        where: { id: job.data.sessionId },
        data: { status: "FAILED" },
      })
      .catch(() => {});
  }
});

logger.info(`📬 Report worker listening on queue '${config.REPORT_QUEUE}'`);
