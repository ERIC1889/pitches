import type { FastifyPluginAsync } from "fastify";
import { readAccuracy } from "../lib/speechMetrics.js";

export const statsRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", async (req, reply) => {
    try {
      await req.jwtVerify();
    } catch {
      return reply.code(401).send({ error: "UNAUTHORIZED" });
    }
  });

  /** 정확도 추이 그래프용. 완료된 최근 30개 세션을 오래된 순으로 */
  app.get("/progress", async (req) => {
    const { sub: userId } = req.user as { sub: string };
    const sessions = await app.prisma.session.findMany({
      where: { userId, status: "COMPLETED", report: { isNot: null } },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { report: { select: { overallScore: true, speechMetrics: true } } },
    });
    const points = sessions.reverse().map((s) => ({
      sessionId: s.id,
      title: s.title,
      date: s.createdAt.toISOString(),
      accuracy: readAccuracy(s.report?.speechMetrics),
      overallScore: s.report?.overallScore ?? null,
    }));
    return { points };
  });
};
