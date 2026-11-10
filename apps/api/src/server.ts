import { config } from "./config.js";
import { logger } from "./lib/logger.js";
import { buildApp } from "./app.js";

async function bootstrap() {
  try {
    const { app } = await buildApp();
    await app.listen({ port: config.API_PORT, host: config.API_HOST });
    logger.info(
      `🚀 API listening on http://${config.API_HOST}:${config.API_PORT}`
    );
    logger.info("🔌 Socket.IO gateway registered on /live");
  } catch (err) {
    logger.error(err);
    process.exit(1);
  }
}

bootstrap();
