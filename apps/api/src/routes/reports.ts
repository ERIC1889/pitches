import type { FastifyPluginAsync } from "fastify";
import { createReadStream } from "node:fs";
import path from "node:path";

export const reportRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", async (req, reply) => {
    try {
      await req.jwtVerify();
    } catch {
      return reply.code(401).send({ error: "UNAUTHORIZED" });
    }
  });

  app.get("/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { sub: userId } = req.user as { sub: string };
    const report = await app.prisma.report.findFirst({
      where: { id, session: { userId } },
    });
    if (!report) return reply.code(404).send({ error: "NOT_FOUND" });
    return report;
  });

  app.get("/:id/pdf", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { sub: userId } = req.user as { sub: string };
    const report = await app.prisma.report.findFirst({
      where: { id, session: { userId } },
    });
    if (!report?.pdfPath) return reply.code(404).send({ error: "NOT_FOUND" });
    const stream = createReadStream(path.resolve(report.pdfPath));
    reply.type("application/pdf");
    return reply.send(stream);
  });
};
