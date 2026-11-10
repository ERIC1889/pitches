"""SenseVoiceSmall + emotion2vec+ 로딩과 추론. 첫 실행 시 ModelScope 에서 약 1.3GB 내려받는다."""

import os
import threading
import time

import numpy as np
from funasr import AutoModel

from .labels import merge_emotion, parse_emotion2vec, parse_sensevoice

HUB = os.getenv("EMOTION_MODEL_HUB", "ms")  # ms(ModelScope) | hf(Hugging Face)
DEVICE = os.getenv("EMOTION_DEVICE", "cpu")
MODEL_IDS = {
    "ms": ("iic/SenseVoiceSmall", "iic/emotion2vec_plus_base"),
    "hf": ("FunAudioLLM/SenseVoiceSmall", "emotion2vec/emotion2vec_plus_base"),
}


class EmotionModels:
    def __init__(self) -> None:
        sense_voice_id, emotion2vec_id = MODEL_IDS[HUB]
        common = {"hub": HUB, "device": DEVICE, "disable_update": True}
        self.sense_voice = AutoModel(model=sense_voice_id, **common)
        self.emotion2vec = AutoModel(model=emotion2vec_id, **common)
        # torch 모델을 여러 스레드에서 동시에 돌리지 않도록 직렬화
        self._lock = threading.Lock()

    def analyze(self, audio: np.ndarray) -> dict:
        """16kHz mono float32 [-1, 1] 오디오 한 구간의 감정·오디오 이벤트"""
        with self._lock:
            sv_raw = self.sense_voice.generate(
                input=audio, cache={}, language="ko", use_itn=False, ban_emo_unk=False
            )[0]["text"]
            e2v = self.emotion2vec.generate(
                audio, granularity="utterance", extract_embedding=False
            )[0]

        sv = parse_sensevoice(sv_raw)
        scores = parse_emotion2vec(e2v["labels"], e2v["scores"])
        emotion, score = merge_emotion(scores, sv.emotion)
        return {
            "emotion": emotion,
            "score": score,
            "scores": {k: round(v, 4) for k, v in scores.items()},
            "event": sv.event,
            "language": sv.language,
            "text": sv.text,
        }


if __name__ == "__main__":
    # yarn workspace @pitches/emotion download — 모델을 미리 받아두고 워밍업
    started = time.time()
    models = EmotionModels()
    print(f"모델 로드 완료 ({time.time() - started:.1f}s, hub={HUB}, device={DEVICE})")
    print(models.analyze(np.zeros(16000, dtype=np.float32)))
