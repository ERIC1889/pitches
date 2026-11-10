"""SenseVoiceSmall · emotion2vec+ 출력 파싱과 두 모델 결과 병합 (모델 없이 테스트 가능한 순수 함수)."""

import re
from dataclasses import dataclass

EMOTIONS = ("NEUTRAL", "HAPPY", "SAD", "ANGRY", "FEARFUL", "DISGUSTED", "SURPRISED")

# SenseVoice 오디오 이벤트 태그 (기술 보고서의 "박수·웃음 등 오디오 이벤트 탐지")
AUDIO_EVENTS = ("Speech", "BGM", "Applause", "Laughter", "Cry", "Sneeze", "Breath", "Cough")

# emotion2vec+ 확신도가 이보다 낮으면 SenseVoice 감정 태그로 대체
MIN_E2V_CONFIDENCE = 0.4

_TAG = re.compile(r"<\|([^|]+)\|>")


@dataclass
class SenseVoiceResult:
    language: str | None
    emotion: str | None
    event: str | None
    text: str


def parse_sensevoice(raw: str) -> SenseVoiceResult:
    """'<|ko|><|NEUTRAL|><|Speech|><|woitn|>본문' → 언어·감정·이벤트·본문"""
    tags = _TAG.findall(raw)
    return SenseVoiceResult(
        language=tags[0] if tags else None,
        emotion=next((t for t in tags if t in EMOTIONS), None),
        event=next((t for t in tags if t in AUDIO_EVENTS), None),
        text=_TAG.sub("", raw).strip(),
    )


def parse_emotion2vec(labels: list[str], scores: list[float]) -> dict[str, float]:
    """'生气/angry' 같은 중·영 병기 라벨을 EMOTIONS 로 매핑. other·<unk> 는 버린다."""
    out: dict[str, float] = {}
    for label, score in zip(labels, scores):
        name = label.split("/")[-1].upper()
        if name in EMOTIONS:
            out[name] = float(score)
    return out


def merge_emotion(
    e2v_scores: dict[str, float], sv_emotion: str | None
) -> tuple[str | None, float | None]:
    """emotion2vec+ 를 우선 쓰고(확신도 포함), 애매하면 SenseVoice 태그(확신도 없음)."""
    if e2v_scores:
        top = max(e2v_scores, key=e2v_scores.__getitem__)
        if e2v_scores[top] >= MIN_E2V_CONFIDENCE:
            return top, round(e2v_scores[top], 4)
    if sv_emotion:
        return sv_emotion, None
    return None, None
