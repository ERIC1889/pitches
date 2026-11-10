import type { PrismaClient } from "@prisma/client";
import { reportQueue } from "./queue.js";

/**
 * 세션을 ANALYZING 으로 바꾸고 보고서 생성 잡을 큐잉한다. 잡 ID 반환.
 * 녹음 파일(audioPath)이 이미 기록된 뒤에만 호출할 것.
 */
export async function queueReport(
  prisma: PrismaClient,
  sessionId: string
): Promise<string> {
  await prisma.session.update({
    where: { id: sessionId },
    data: { endedAt: new Date(), status: "ANALYZING" },
  });
  const job = await reportQueue.add("generate", { sessionId });
  return job.id!;
}
