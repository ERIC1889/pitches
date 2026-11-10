import type { FastifyPluginAsync } from "fastify";

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get("/health", async () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "pitches-api",
  }));

  app.get("/health/deep", async () => {
    const dbOk = await app.prisma
      .$queryRaw`SELECT 1`
      .then(() => true)
      .catch(() => false);
    return {
      status: dbOk ? "ok" : "degraded",
      db: dbOk ? "up" : "down",
      timestamp: new Date().toISOString(),
    };
  });
};
