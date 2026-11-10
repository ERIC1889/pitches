"""감정 분석 HTTP 서비스. API 서버가 5초 PCM 구간마다 POST /analyze 로 호출한다.

    yarn workspace @pitches/emotion dev   # http://127.0.0.1:8001
"""

import time
from contextlib import asynccontextmanager
from typing import Protocol

import numpy as np
from fastapi import FastAPI, HTTPException, Request
from starlette.concurrency import run_in_threadpool

SAMPLE_RATE = 16000
MIN_SECONDS = 0.5


class Analyzer(Protocol):
    def analyze(self, audio: np.ndarray) -> dict: ...


def create_app(models: Analyzer | None = None) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        if models is None:
            from .models import EmotionModels  # torch/funasr 로딩은 실제 서버에서만

            app.state.models = EmotionModels()
        else:
            app.state.models = models
        yield

    app = FastAPI(title="Pitches Emotion", lifespan=lifespan)

    @app.get("/health")
    def health() -> dict:
        return {"ok": True}

    @app.post("/analyze")
    async def analyze(request: Request) -> dict:
        """본문: 16kHz mono 16-bit little-endian PCM (헤더 없음)"""
        body = await request.body()
        if len(body) < SAMPLE_RATE * 2 * MIN_SECONDS:
            raise HTTPException(400, f"오디오가 {MIN_SECONDS}초보다 짧습니다")
        pcm = np.frombuffer(body[: len(body) // 2 * 2], dtype="<i2")
        audio = pcm.astype(np.float32) / 32768.0
        started = time.perf_counter()
        # 추론은 CPU 바운드라 스레드풀에서 돌려 이벤트 루프를 막지 않는다
        result = await run_in_threadpool(request.app.state.models.analyze, audio)
        result["elapsedMs"] = round((time.perf_counter() - started) * 1000)
        return result

    return app


app = create_app()
