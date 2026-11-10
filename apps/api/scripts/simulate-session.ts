/**
 * 폰 없이 실시간 파이프라인 전체를 돌려보는 개발용 스크립트.
 * 16kHz mono 16-bit WAV 파일을 앱과 똑같이 256ms 조각으로 실시간 속도에 맞춰 전송하고,
 * tick 을 출력한 뒤 보고서가 완성될 때까지 기다린다. (API 서버 + 워커가 떠 있어야 함)
 *
 *   yarn workspace @pitches/api simulate ./sample.wav
 *
 * 변환 예) afconvert -f WAVE -d LEI16@16000 -c 1 input.m4a sample.wav
 */
import fs from "node:fs/promises";
import { io } from "socket.io-client";
import type { FeedbackTick, SessionEndAck } from "@pitches/shared";

const API = process.env.API_URL ?? "http://localhost:3000";
const EMAIL = process.env.SIM_EMAIL ?? "sim@pitches.local";
const PASSWORD = process.env.SIM_PASSWORD ?? "simulate1234";
const CHUNK_BYTES = 8192; // 256ms @ 16kHz int16

async function main() {
  const wavPath = process.argv[2];
  if (!wavPath) throw new Error("사용법: simulate <16kHz-mono-16bit.wav>");
  const pcm = readPcm(await fs.readFile(wavPath));
  console.log(`🎙  ${wavPath} (${(pcm.length / 32000).toFixed(1)}초)`);

  const token = await authenticate();
  const { sessionId, wsToken } = await call<{ sessionId: string; wsToken: string }>(
    token,
    "POST",
    "/sessions",
    { title: `시뮬레이션 ${new Date().toLocaleString("ko-KR")}` }
  );

  const sock = io(`${API}/live`, { transports: ["websocket"] });
  sock.on("feedback:tick", (t: FeedbackTick) => {
    const mark = { green: "🟢", yellow: "🟡", red: "🔴" }[t.color];
    console.log(
      `${mark} #${t.seq} 속도 ${Math.round(t.speedWpm)}자/분 · 음량 ${t.volumeDb.toFixed(1)}dB · 간투사 ${t.fillerCnt}` +
        (t.emotion ? ` · 감정 ${t.emotion}(${t.emotionScore ?? "-"})` : "") +
        (t.audioEvent && t.audioEvent !== "Speech" ? ` · ${t.audioEvent}` : "") +
        (t.tip ? ` → ${t.tip}` : "") +
        (t.transcript ? `\n   💬 ${t.transcript}` : "")
    );
  });
  const joined = await sock.emitWithAck("session:join", { sessionId, token: wsToken });
  if (!joined?.ok) throw new Error(`join 실패: ${JSON.stringify(joined)}`);

  const started = Date.now();
  for (let off = 0, seq = 0; off < pcm.length; off += CHUNK_BYTES, seq++) {
    sock.emit("audio:chunk", {
      seq,
      timestampMs: Date.now() - started,
      pcmBase64: pcm.subarray(off, off + CHUNK_BYTES).toString("base64"),
    });
    await sleep(256);
  }

  const ack = (await sock.timeout(15_000).emitWithAck("session:end")) as SessionEndAck;
  sock.disconnect();
  if (!ack.ok) throw new Error(`종료 실패: ${ack.error}`);
  console.log(`⏳ 보고서 생성 중 (job ${ack.jobId})`);

  for (;;) {
    await sleep(2000);
    const s = await call<{ status: string; report: any }>(token, "GET", `/sessions/${sessionId}`);
    if (s.status === "FAILED") throw new Error("보고서 생성 실패 — 워커 로그 확인");
    if (s.status === "COMPLETED") {
      const { report } = s;
      console.log(`\n✅ 종합 ${report.overallScore}점 · 정확도 ${report.speechMetrics.accuracy ?? "-"}%`);
      console.log(`📝 ${report.transcript}`);
      console.log(`💪 ${report.summary.strengths.join(" / ")}`);
      console.log(`🛠  ${report.summary.weaknesses.join(" / ")}`);
      console.log(`📄 ${report.pdfPath}`);
      return;
    }
  }
}

/** RIFF 청크를 훑어 "data" 청크만 꺼낸다. 16kHz mono 16-bit 가 아니면 에러 */
function readPcm(wav: Buffer): Buffer {
  if (wav.toString("ascii", 0, 4) !== "RIFF") throw new Error("WAV 파일이 아닙니다");
  let off = 12;
  let fmtOk = false;
  while (off + 8 <= wav.length) {
    const id = wav.toString("ascii", off, off + 4);
    const size = wav.readUInt32LE(off + 4);
    if (id === "fmt ") {
      fmtOk =
        wav.readUInt16LE(off + 10) === 1 &&
        wav.readUInt32LE(off + 12) === 16000 &&
        wav.readUInt16LE(off + 22) === 16;
    }
    if (id === "data") {
      if (!fmtOk) throw new Error("16kHz mono 16-bit WAV 만 지원합니다");
      return wav.subarray(off + 8, off + 8 + size);
    }
    off += 8 + size + (size % 2);
  }
  throw new Error("data 청크가 없습니다");
}

async function authenticate(): Promise<string> {
  const login = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (login.ok) return ((await login.json()) as { token: string }).token;
  const { token } = await call<{ token: string }>(null, "POST", "/auth/signup", {
    email: EMAIL,
    password: PASSWORD,
    name: "시뮬레이터",
  });
  return token;
}

async function call<T>(token: string | null, method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

main().catch((err) => {
  console.error(`❌ ${err.message}`);
  process.exit(1);
});
