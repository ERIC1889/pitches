import numpy as np
from fastapi.testclient import TestClient

from pitches_emotion.server import create_app


class FakeModels:
    def __init__(self):
        self.calls = []

    def analyze(self, audio: np.ndarray) -> dict:
        self.calls.append(audio)
        return {"emotion": "NEUTRAL", "score": 0.9, "scores": {"NEUTRAL": 0.9},
                "event": "Speech", "language": "ko", "text": "안녕"}


def test_analyze는_int16_PCM을_float로_바꿔_모델에_넘긴다():
    models = FakeModels()
    pcm = (np.ones(16000, dtype=np.int16) * 16384).tobytes()  # 1초, 진폭 0.5
    with TestClient(create_app(models)) as client:
        res = client.post(
            "/analyze", content=pcm, headers={"content-type": "application/octet-stream"}
        )
    assert res.status_code == 200
    assert res.json()["emotion"] == "NEUTRAL"
    assert models.calls[0].dtype == np.float32
    assert abs(float(models.calls[0][0]) - 0.5) < 1e-3


def test_너무_짧은_오디오는_400():
    with TestClient(create_app(FakeModels())) as client:
        res = client.post("/analyze", content=b"\x00\x00" * 100)
    assert res.status_code == 400


def test_health():
    with TestClient(create_app(FakeModels())) as client:
        assert client.get("/health").json() == {"ok": True}
