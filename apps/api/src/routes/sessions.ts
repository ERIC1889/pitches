import type { FastifyPluginAsync } from "fastify";
import { CreateSessionRequestSchema } from "@pitches/shared";
import { queueReport } from "../services/reportJobs.js";
import { readAccuracy } from "../lib/speechMetrics.js";

export const sessionRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", async (req, reply) => {
    try {
      await req.jwtVerify();
    } catch {
      return reply.code(401).send({ error: "UNAUTHORIZED" });
    }
  });

  app.post("/", async (req) => {
    const body = CreateSessionRequestSchema.parse(req.body);
    const { sub: userId } = req.user as { sub: string };
    const session = await app.prisma.session.create({
      data: { userId, title: body.title },
    });
    const wsToken = app.jwt.sign(
      { sub: userId, sid: session.id },
      { expiresIn: "2h" }
    );
    return { sessionId: session.id, wsToken };
  });

  app.get("/", async (req) => {
    const { sub: userId } = req.user as { sub: string };
    const sessions = await app.prisma.session.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        report: { select: { id: true, overallScore: true, speechMetrics: true } },
      },
    });
    return {
      sessions: sessions.map(({ report, ...s }) => ({
        ...s,
        report: report ? { id: report.id, overallScore: report.overallScore } : null,
        accuracy: readAccuracy(report?.speechMetrics),
      })),
    };
  });

  app.get("/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { sub: userId } = req.user as { sub: string };
    const session = await app.prisma.session.findFirst({
      where: { id, userId },
      include: {
        report: true,
        ticks: { orderBy: { offsetMs: "asc" } },
      },
    });
    if (!session) return reply.code(404).send({ error: "NOT_FOUND" });
    return session;
  });

  app.post("/:id/finalize", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { sub: userId } = req.user as { sub: string };
    const session = await app.prisma.session.findFirst({
      where: { id, userId },
    });
    if (!session) return reply.code(404).send({ error: "NOT_FOUND" });
    if (session.status === "COMPLETED" || session.status === "ANALYZING") {
      return { ok: true, status: session.status };
    }
    // 녹음 파일은 소켓 session:end / disconnect 에서 기록된다
    if (!session.audioPath) {
      return reply.code(409).send({ error: "AUDIO_NOT_READY" });
    }

    const jobId = await queueReport(app.prisma, id);
    app.log.info({ sessionId: id, jobId }, "report job queued");

    return { ok: true, status: "ANALYZING", jobId };
  });
};
