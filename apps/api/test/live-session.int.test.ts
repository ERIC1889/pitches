import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { io as connect, type Socket } from "socket.io-client";
import type { SessionEndAck } from "@pitches/shared";
import { buildApp } from "../src/app.js";
import { closeQueue, reportQueue } from "../src/services/queue.js";

const SAMPLE_RATE = 16000;
const CHUNK_BYTES = 8192; // 256ms

let built: Awaited<ReturnType<typeof buildApp>>;
let baseUrl: string;
let token: string;
let userId: string;

/** 진폭 0.3의 440Hz 사인파 (16kHz mono int16) */
function tone(sec: number): Buffer {
  const buf = Buffer.alloc(SAMPLE_RATE * 2 * sec);
  for (let i = 0; i < SAMPLE_RATE * sec; i++) {
    const v = Math.sin((2 * Math.PI * 440 * i) / SAMPLE_RATE) * 0.3;
    buf.writeInt16LE(Math.round(v * 32767), i * 2);
  }
  return buf;
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  });
  return (await res.json()) as T;
}

async function startLiveSession(): Promise<{ sessionId: string; sock: Socket }> {
  const { sessionId, wsToken } = await api<{ sessionId: string; wsToken: string }>(
    "/sessions",
    { method: "POST", body: JSON.stringify({ title: "통합 테스트" }) }
  );
  const sock = connect(`${baseUrl}/live`, { transports: ["websocket"] });
  const joined = await sock.emitWithAck("session:join", { sessionId, token: wsToken });
  expect(joined).toEqual({ ok: true });
  return { sessionId, sock };
}

function streamAudio(sock: Socket, pcm: Buffer) {
  for (let off = 0, seq = 0; off < pcm.length; off += CHUNK_BYTES, seq++) {
    sock.emit("audio:chunk", {
      seq,
      timestampMs: (off / (SAMPLE_RATE * 2)) * 1000,
      pcmBase64: pcm.subarray(off, off + CHUNK_BYTES).toString("base64"),
    });
  }
}

async function waitFor<T>(fn: () => Promise<T | null | undefined>, ms = 5000): Promise<T> {
  const until = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > until) throw new Error("waitFor timeout");
    await new Promise((r) => setTimeout(r, 100));
  }
}

beforeAll(async () => {
  built = await buildApp();
  await built.app.listen({ port: 0, host: "127.0.0.1" });
  const { port } = built.app.server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;
  const auth = await api<{ token: string; user: { id: string } }>("/auth/signup", {
    method: "POST",
    body: JSON.stringify({
      email: `int-${Date.now()}@test.local`,
      password: "password123",
      name: "통합테스트",
    }),
  });
  token = auth.token;
  userId = auth.user.id;
});

afterAll(async () => {
  // 테스트 전용 큐(reports-test)는 통째로 비운다
  await reportQueue.obliterate({ force: true });
  const sessions = await built.app.prisma.session.findMany({ where: { userId } });
  for (const s of sessions) if (s.audioPath) await fs.rm(s.audioPath, { force: true });
  await built.app.prisma.user.delete({ where: { id: userId } });
  built.io.disconnectSockets(true);
  await built.app.close();
  await closeQueue();
});

describe("live session", () => {
  it("5초마다 tick을 보내고 종료 ack 안에서 녹음 확정 + 보고서 잡을 큐잉한다", async () => {
    const { sessionId, sock } = await startLiveSession();
    const firstTick = new Promise<{ seq: number; color: string }>((r) =>
      sock.once("feedback:tick", r)
    );
    streamAudio(sock, tone(6));
    const tick = await firstTick;
    expect(tick.seq).toBe(0);
    expect(["green", "yellow"]).toContain(tick.color);

    const ack = (await sock.emitWithAck("session:end")) as SessionEndAck;
    expect(ack.ok).toBe(true);
    sock.disconnect();

    const session = await built.app.prisma.session.findUniqueOrThrow({
      where: { id: sessionId },
    });
    expect(session.status).toBe("ANALYZING");
    expect((await fs.stat(session.audioPath!)).size).toBeGreaterThan(190_000);
    const ticks = await built.app.prisma.feedbackTick.count({ where: { sessionId } });
    expect(ticks).toBeGreaterThanOrEqual(1);
  });

  // socket.io 서버는 이벤트를 nextTick 에 디스패치하고 끊긴 뒤 도착한 이벤트는 버린다.
  // 그래서 ack 전에 끊기면 session:end 가 유실될 수 있다 → 녹음 보존 + finalize 폴백이 계약.
  it("종료 ack 전에 끊겨도 녹음은 보존되고 finalize 폴백으로 분석을 이어간다", async () => {
    const { sessionId, sock } = await startLiveSession();
    streamAudio(sock, tone(6));
    sock.emit("session:end");
    sock.disconnect();

    const session = await waitFor(() =>
      built.app.prisma.session.findFirst({
        where: { id: sessionId, audioPath: { not: null } },
      })
    );
    // 끊기기 직전 전송 중이던 청크는 유실될 수 있다. 핵심은 이미 받은 녹음을 지우지 않는 것
    expect((await fs.stat(session.audioPath!)).size).toBeGreaterThan(44);

    const res = await api<{ ok: boolean; status: string; jobId?: string }>(
      `/sessions/${sessionId}/finalize`,
      { method: "POST", body: "{}" }
    );
    expect(res.ok).toBe(true);
    expect(res.status).toBe("ANALYZING");
  });

  it("종료 없이 끊기면 녹음은 보존하고 finalize로 이어서 분석할 수 있다", async () => {
    const { sessionId, sock } = await startLiveSession();
    streamAudio(sock, tone(2));
    await new Promise((r) => setTimeout(r, 300));
    sock.disconnect();

    const session = await waitFor(() =>
      built.app.prisma.session.findFirst({
        where: { id: sessionId, audioPath: { not: null } },
      })
    );
    expect(session.status).toBe("IN_PROGRESS");

    const res = await api<{ ok: boolean; jobId: string }>(
      `/sessions/${sessionId}/finalize`,
      { method: "POST", body: "{}" }
    );
    expect(res.ok).toBe(true);
    expect(res.jobId).toBeTruthy();
  });

  it("녹음이 없으면 finalize는 409를 돌려준다", async () => {
    const { sessionId } = await api<{ sessionId: string }>("/sessions", {
      method: "POST",
      body: JSON.stringify({ title: "빈 세션" }),
    });
    const res = await fetch(`${baseUrl}/sessions/${sessionId}/finalize`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: "{}",
    });
    expect(res.status).toBe(409);
  });
});
