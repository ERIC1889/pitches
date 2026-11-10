import { useCallback, useEffect, useRef, useState } from "react";
import {
  AudioStudioModule,
  useAudioRecorder,
  type AudioDataEvent,
} from "@siteed/audio-studio";

export interface AudioStreamOptions {
  onChunk?: (base64Pcm: string) => void;
}

/**
 * @siteed/audio-studio(Expo Modules, New Architecture 지원) 래퍼.
 * 16kHz · mono · 16-bit PCM 을 250ms 마다 base64 로 방출한다. 서버 5초 버퍼 = 20개 청크.
 */
export function useAudioStream(opts: AudioStreamOptions = {}) {
  const { onChunk } = opts;
  const { startRecording, stopRecording, isRecording } = useAudioRecorder();
  const [error, setError] = useState<string | null>(null);
  const onChunkRef = useRef(onChunk);

  useEffect(() => {
    onChunkRef.current = onChunk;
  }, [onChunk]);

  const start = useCallback(async () => {
    try {
      const perm = await AudioStudioModule.requestPermissionsAsync();
      if (!perm.granted) {
        setError("마이크 권한이 필요합니다");
        return false;
      }
      await startRecording({
        sampleRate: 16000,
        channels: 1,
        encoding: "pcm_16bit",
        interval: 250,
        keepAwake: true,
        // 원본은 서버가 저장하므로 기기에 WAV 를 남기지 않음 (켜면 오프라인 백업으로 활용 가능)
        output: { primary: { enabled: false } },
        onAudioStream: async (event: AudioDataEvent) => {
          if (typeof event.data === "string") onChunkRef.current?.(event.data);
        },
      });
      setError(null);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "녹음 시작 실패");
      return false;
    }
  }, [startRecording]);

  const stop = useCallback(async () => {
    try {
      await stopRecording();
    } catch {
      // 이미 멈춘 경우 무시
    }
  }, [stopRecording]);

  return { recording: isRecording, error, start, stop };
}
