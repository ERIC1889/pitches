import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { closeQueue } from "../src/services/queue.js";

let built: Awaited<ReturnType<typeof buildApp>>;
const userIds: string[] = [];

async function signup(name: string): Promise<{ token: string; userId: string }> {
  const res = await built.app.inject({
    method: "POST",
    url: "/auth/signup",
    payload: { email: `stats-${name}-${Date.now()}@test.local`, password: "password123", name },
  });
  const body = res.json() as { token: string; user: { id: string } };
  userIds.push(body.user.id);
  return { token: body.token, userId: body.user.id };
}

async function completedSession(userId: string, title: string, accuracy: number, score: number) {
  await built.app.prisma.session.create({
    data: {
      userId,
      title,
      status: "COMPLETED",
      report: {
        create: {
          transcript: "테스트",
          overallScore: score,
          summary: {},
          speechMetrics: { avgWpm: 280, fillerCount: 0, avgVolumeDb: -20, durationSec: 60, accuracy },
        },
      },
    },
  });
}

beforeAll(async () => {
  built = await buildApp();
});

afterAll(async () => {
  await built.app.prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await built.app.close();
  await closeQueue();
});

describe("GET /stats/progress", () => {
  it("내 완료 세션의 정확도만 오래된 순으로 돌려준다", async () => {
    const me = await signup("me");
    const other = await signup("other");
    await completedSession(me.userId, "첫 발표", 60, 65);
    await completedSession(me.userId, "두 번째 발표", 80, 78);
    await completedSession(other.userId, "남의 발표", 99, 99);
    await built.app.prisma.session.create({ data: { userId: me.userId, title: "분석 중" } });

    const res = await built.app.inject({
      method: "GET",
      url: "/stats/progress",
      headers: { authorization: `Bearer ${me.token}` },
    });
    expect(res.statusCode).toBe(200);
    const { points } = res.json() as { points: { title: string; accuracy: number | null; overallScore: number }[] };
    expect(points.map((p) => [p.title, p.accuracy, p.overallScore])).toEqual([
      ["첫 발표", 60, 65],
      ["두 번째 발표", 80, 78],
    ]);
  });

  it("세션 목록에 정확도를 포함한다", async () => {
    const me = await signup("list");
    await completedSession(me.userId, "목록 발표", 72, 70);
    const res = await built.app.inject({
      method: "GET",
      url: "/sessions",
      headers: { authorization: `Bearer ${me.token}` },
    });
    const { sessions } = res.json() as { sessions: { title: string; accuracy: number | null }[] };
    expect(sessions[0]).toMatchObject({ title: "목록 발표", accuracy: 72 });
  });
});
