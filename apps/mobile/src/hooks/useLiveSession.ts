import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import {
  currentSentence,
  type FeedbackTick,
  type SessionEndAck,
  type TickColor,
} from "@pitches/shared";
import { apiClient } from "../api/client";
import { createLiveSocket } from "../socket/client";
import { useAudioStream } from "../audio/useAudioStream";

export interface LiveSessionState {
  status: "idle" | "starting" | "recording" | "stopping" | "ended" | "error";
  sessionId: string | null;
  color: TickColor;
  tip: string;
  lastTick: FeedbackTick | null;
  error: string | null;
}

interface StartOptions {
  title?: string;
}

const END_ACK_TIMEOUT_MS = 10_000;
// 자막은 한 문장만 보여주므로 최근 조각 몇 개만 들고 있으면 된다
const CAPTION_CHUNKS = 4;

/**
 * 발표 세션 전체 라이프사이클을 묶어주는 훅.
 *  1. POST /sessions 로 세션 + wsToken 발급
 *  2. Socket.IO /live 연결 + session:join
 *  3. 마이크 PCM 청크를 audio:chunk 로 전송
 *  4. feedback:tick 수신 → color / tip 상태 업데이트
 *  5. stop(): 녹음 중지 → session:end ack 를 기다린 뒤 연결 해제 (서버가 보고서 잡까지 큐잉)
 *     ack 를 못 받으면 POST /sessions/:id/finalize 로 폴백
 */
export function useLiveSession() {
  const [state, setState] = useState<LiveSessionState>({
    status: "idle",
    sessionId: null,
    color: "green",
    tip: "준비되면 발표를 시작하세요",
    lastTick: null,
    error: null,
  });
  const [elapsedMs, setElapsedMs] = useState(0);
  const [captionChunks, setCaptionChunks] = useState<string[]>([]);

  const socketRef = useRef<Socket | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const seqRef = useRef(0);
  const startedAtRef = useRef<number>(0);

  const handleChunk = useCallback((base64Pcm: string) => {
    const sock = socketRef.current;
    if (!sock?.connected) return;
    const seq = seqRef.current++;
    const timestampMs = Date.now() - startedAtRef.current;
    sock.emit("audio:chunk", { seq, timestampMs, pcmBase64: base64Pcm });
  }, []);

  const { start: startAudio, stop: stopAudio, error: audioError } =
    useAudioStream({ onChunk: handleChunk });

  const start = useCallback(
    async ({ title = "새 발표" }: StartOptions = {}) => {
      setState((s) => ({ ...s, status: "starting", error: null }));
      try {
        const { data } = await apiClient.post("/sessions", { title });
        const { sessionId, wsToken } = data as {
          sessionId: string;
          wsToken: string;
        };

        const sock = createLiveSocket();
        socketRef.current = sock;

        await new Promise<void>((resolve, reject) => {
          sock.once("connect", () => resolve());
          sock.once("connect_error", (err) => reject(err));
          sock.connect();
        });

        const joinResult = (await sock.emitWithAck("session:join", {
          sessionId,
          token: wsToken,
        })) as { ok: boolean; error?: string };
        if (!joinResult?.ok) {
          throw new Error(joinResult?.error ?? "세션 참가 실패");
        }

        sock.on("feedback:tick", (tick: FeedbackTick) => {
          setState((s) => ({
            ...s,
            lastTick: tick,
            color: tick.color,
            tip: tick.tip ?? (tick.color === "green" ? "지금 잘 하고 있어요!" : s.tip),
          }));
          const text = tick.transcript;
          if (text) setCaptionChunks((c) => [...c, text].slice(-CAPTION_CHUNKS));
        });

        sock.on("error", (err: { code: string; message: string }) => {
          setState((s) => ({ ...s, error: `${err.code}: ${err.message}` }));
        });

        seqRef.current = 0;
        startedAtRef.current = Date.now();
        sessionIdRef.current = sessionId;

        const started = await startAudio();
        if (!started) throw new Error("녹음을 시작할 수 없습니다");

        setElapsedMs(0);
        setCaptionChunks([]);
        setState((s) => ({
          ...s,
          status: "recording",
          sessionId,
          tip: "지금 말해보세요",
        }));
      } catch (e) {
        const message = e instanceof Error ? e.message : "세션 시작 실패";
        setState((s) => ({ ...s, status: "error", error: message }));
        socketRef.current?.disconnect();
        socketRef.current = null;
      }
    },
    [startAudio]
  );

  /** 분석 요청에 성공하면 sessionId, 녹음이 비었거나 실패하면 null */
  const stop = useCallback(async (): Promise<string | null> => {
    setState((s) => ({ ...s, status: "stopping" }));
    await stopAudio();

    const sock = socketRef.current;
    socketRef.current = null;
    const sessionId = sessionIdRef.current;

    let ack: SessionEndAck | null = null;
    if (sock?.connected) {
      try {
        // ack 전에 끊으면 서버가 session:end 를 버린다 (socket.io 는 끊긴 뒤 도착한 이벤트 무시)
        ack = (await sock
          .timeout(END_ACK_TIMEOUT_MS)
          .emitWithAck("session:end")) as SessionEndAck;
      } catch {
        // 타임아웃 → 아래 finalize 폴백
      }
    }
    sock?.disconnect();

    if (ack && !ack.ok && ack.error === "AUDIO_EMPTY") {
      setState((s) => ({
        ...s,
        status: "error",
        error: "녹음된 음성이 없어요. 마이크를 확인해주세요.",
      }));
      return null;
    }

    const queued = ack?.ok || (sessionId ? await finalizeWithRetry(sessionId) : false);
    if (!queued) {
      setState((s) => ({
        ...s,
        status: "error",
        error: "분석 요청에 실패했어요. 기록 탭에서 다시 시도해주세요.",
      }));
      return null;
    }
    setState((s) => ({ ...s, status: "ended" }));
    return sessionId;
  }, [stopAudio]);

  useEffect(() => {
    if (state.status !== "recording") return;
    const timer = setInterval(
      () => setElapsedMs(Date.now() - startedAtRef.current),
      500
    );
    return () => clearInterval(timer);
  }, [state.status]);

  useEffect(() => {
    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (audioError) {
      setState((s) => ({ ...s, error: audioError }));
    }
  }, [audioError]);

  const caption = useMemo(() => currentSentence(captionChunks), [captionChunks]);

  return { ...state, elapsedMs, caption, start, stop };
}

/**
 * 소켓이 비정상 종료되면 서버가 녹음 파일을 저장하는 데 잠깐 걸린다 (그동안 409 AUDIO_NOT_READY).
 */
export async function finalizeWithRetry(sessionId: string, tries = 3): Promise<boolean> {
  for (let i = 0; i < tries; i++) {
    try {
      await apiClient.post(`/sessions/${sessionId}/finalize`);
      return true;
    } catch (err: any) {
      if (err?.response?.status !== 409) return false;
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  return false;
}
