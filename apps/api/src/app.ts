import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import jwt from "@fastify/jwt";
import { Server as SocketIOServer } from "socket.io";
import { config } from "./config.js";
import { logger } from "./lib/logger.js";
import { prismaPlugin } from "./plugins/prisma.js";
import { healthRoutes } from "./routes/health.js";
import { authRoutes } from "./routes/auth.js";
import { sessionRoutes } from "./routes/sessions.js";
import { reportRoutes } from "./routes/reports.js";
import { statsRoutes } from "./routes/stats.js";
import { registerRealtimeGateway } from "./realtime/gateway.js";

/**
 * Fastify + Socket.IO 인스턴스를 조립한다. listen 은 호출하지 않는다 (테스트에서 port 0으로 띄우기 위함).
 */
export async function buildApp() {
  // loggerInstance 타입이 너무 좁아서 pino 인스턴스를 강제 캐스팅
  const app = Fastify({ loggerInstance: logger as any });

  await app.register(helmet);
  await app.register(cors, { origin: true, credentials: true });
  await app.register(jwt, {
    secret: config.JWT_SECRET,
    sign: { expiresIn: config.JWT_EXPIRES_IN },
  });
  await app.register(prismaPlugin);

  await app.register(healthRoutes);
  await app.register(authRoutes, { prefix: "/auth" });
  await app.register(sessionRoutes, { prefix: "/sessions" });
  await app.register(reportRoutes, { prefix: "/reports" });
  await app.register(statsRoutes, { prefix: "/stats" });

  await app.ready();

  const io = new SocketIOServer(app.server, {
    cors: { origin: true, credentials: true },
    path: "/socket.io",
    maxHttpBufferSize: 2 * 1024 * 1024, // 5초 PCM 청크 수용
  });
  registerRealtimeGateway(io, app);

  return { app, io };
}
