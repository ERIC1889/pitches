import type { Server as SocketIOServer } from "socket.io";
import type { FastifyInstance } from "fastify";
import {
  SessionJoinSchema,
  AudioChunkSchema,
  type SessionEndAck,
} from "@pitches/shared";
import { runPipeline } from "./pipeline.js";
import {
  flushBuffer,
  pushChunk,
  resetBuffer,
  type BufferResult,
} from "./chunkBuffer.js";
import { appendChunk, finishCapture, startCapture } from "./audioCapture.js";
import { queueReport } from "../services/reportJobs.js";

export function registerRealtimeGateway(
  io: SocketIOServer,
  app: FastifyInstance
) {
  const live = io.of("/live");

  live.on("connection", (socket) => {
    let sessionId: string | null = null;
    let userId: string | null = null;
    // session:end 처리 중 disconnect 가 끼어들어도 녹음을 건드리지 않도록 표시
    let ending = false;

    /** 5초 윈도우 하나를 판정해 앱에 보내고 DB에 남긴다 */
    const processWindow = async (sid: string, win: BufferResult) => {
      const { tick } = await runPipeline(win.pcm!, {
        seq: win.seq!,
        durationMs: win.durationMs!,
      });
      socket.emit("feedback:tick", tick);
      await app.prisma.feedbackTick
        .create({
          data: {
            sessionId: sid,
            offsetMs: win.offsetMs!,
            color: tick.color,
            speedWpm: tick.speedWpm,
            volumeDb: tick.volumeDb,
            fillerCnt: tick.fillerCnt,
            emotion: tick.emotion,
            emotionScore: tick.emotionScore,
            audioEvent: tick.audioEvent,
            tip: tick.tip,
          },
        })
        .catch((err) => app.log.warn({ err }, "failed to persist tick"));
    };

    /** 녹음 파일을 닫고 WAV 경로를 세션에 기록. 녹음 바이트 수 반환 */
    const saveRecording = async (sid: string): Promise<number> => {
      const capture = await finishCapture(sid);
      if (!capture) return 0;
      await app.prisma.session.update({
        where: { id: sid },
        data: { audioPath: capture.wavPath },
      });
      return capture.bytes;
    };

    socket.on("session:join", async (payload, ack) => {
      // 소켓 하나는 세션 하나만. 다시 join 하면 녹음 스트림을 새로 열지 않는다
      if (sessionId) {
        ack?.({ ok: false, error: "ALREADY_JOINED" });
        return;
      }
      let parsed: { sessionId: string; token: string };
      let decoded: { sub: string; sid: string };
      try {
        parsed = SessionJoinSchema.parse(payload);
        decoded = app.jwt.verify<{ sub: string; sid: string }>(parsed.token);
        if (decoded.sid !== parsed.sessionId) {
          throw new Error("session mismatch");
        }
      } catch (err) {
        ack?.({ ok: false, error: "INVALID_TOKEN" });
        socket.disconnect();
        return;
      }

      // 끝났거나 녹음이 이미 저장된 세션에 다시 붙으면 저장된 녹음을 덮어쓰게 된다
      const session = await app.prisma.session.findFirst({
        where: { id: parsed.sessionId, userId: decoded.sub },
        select: { status: true, audioPath: true },
      });
      if (!session || session.status !== "IN_PROGRESS" || session.audioPath) {
        ack?.({ ok: false, error: "SESSION_CLOSED" });
        return;
      }
      // 다른 소켓이 같은 세션을 녹음 중 (await 이후 다시 확인해야 경쟁 상태가 없다)
      if (sessionId || !startCapture(parsed.sessionId)) {
        ack?.({ ok: false, error: sessionId ? "ALREADY_JOINED" : "ALREADY_ACTIVE" });
        return;
      }
      sessionId = parsed.sessionId;
      userId = decoded.sub;
      socket.join(`session:${sessionId}`);
      ack?.({ ok: true });
      socket.emit("session:joined", { sessionId });
      app.log.info({ sessionId, userId }, "socket joined, capture started");
    });

    socket.on("audio:chunk", async (payload) => {
      if (!sessionId || ending) return;
      const currentSessionId = sessionId;
      try {
        const chunk = AudioChunkSchema.parse(payload);
        const pcm = Buffer.from(chunk.pcmBase64, "base64");

        // 1) 디스크에 원본 누적 (발표 종료 후 Whisper full STT용)
        appendChunk(currentSessionId, pcm);

        // 2) 5초 판정 버퍼에도 누적
        const res = pushChunk(currentSessionId, pcm, chunk.timestampMs);
        if (!res.ready || !res.pcm) return;
        await processWindow(currentSessionId, res);
      } catch (err) {
        socket.emit("error", {
          code: "CHUNK_FAILED",
          message: err instanceof Error ? err.message : "unknown",
        });
      }
    });

    socket.on("session:end", async (ack?: (res: SessionEndAck) => void) => {
      if (!sessionId || ending) {
        ack?.({ ok: false, error: "END_FAILED" });
        return;
      }
      ending = true;
      const currentSessionId = sessionId;

      try {
        // 1) 잔여 버퍼 flush → 마지막 tick
        const remainder = flushBuffer(currentSessionId);
        if (remainder?.pcm) {
          await processWindow(currentSessionId, remainder).catch((err) =>
            app.log.warn({ err }, "flush failed")
          );
        }

        // 2) 녹음 파일 확정 → 3) 보고서 잡 큐잉 (audioPath 기록 이후에만)
        const bytes = await saveRecording(currentSessionId);
        if (bytes === 0) {
          await app.prisma.session.update({
            where: { id: currentSessionId },
            data: { endedAt: new Date(), status: "FAILED" },
          });
          ack?.({ ok: false, error: "AUDIO_EMPTY" });
          return;
        }
        const jobId = await queueReport(app.prisma, currentSessionId);
        app.log.info({ sessionId: currentSessionId, jobId, bytes }, "report job queued");

        ack?.({ ok: true, jobId });
        socket.emit("session:ended", {
          sessionId: currentSessionId,
          reportJobId: jobId,
        });
      } catch (err) {
        app.log.error({ err, sessionId: currentSessionId }, "session end failed");
        ack?.({ ok: false, error: "END_FAILED" });
      } finally {
        resetBuffer(currentSessionId);
        socket.leave(`session:${currentSessionId}`);
        sessionId = null;
        userId = null;
        ending = false;
      }
    });

    socket.on("disconnect", () => {
      app.log.debug({ sessionId, ending }, "socket disconnected");
      if (!sessionId || ending) return;
      // 종료 신호 없이 끊김 (앱 강제 종료·네트워크 단절) → 녹음은 보존, 분석은 finalize 로 재개
      const currentSessionId = sessionId;
      sessionId = null;
      userId = null;
      resetBuffer(currentSessionId);
      saveRecording(currentSessionId).catch((err) =>
        app.log.warn({ err }, "failed to save recording on disconnect")
      );
    });
  });
}
