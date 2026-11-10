import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { config } from "../config.js";

export interface ReportJobData {
  sessionId: string;
}

const connection = new Redis(config.REDIS_URL, {
  maxRetriesPerRequest: null,
});

export const reportQueue = new Queue<ReportJobData>(config.REPORT_QUEUE, {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

export async function closeQueue(): Promise<void> {
  await reportQueue.close();
  await connection.quit();
}
