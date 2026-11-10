from pitches_emotion.labels import merge_emotion, parse_emotion2vec, parse_sensevoice


def test_sensevoice_태그와_텍스트를_분리한다():
    r = parse_sensevoice("<|ko|><|HAPPY|><|Laughter|><|woitn|>안녕하세요 어 발표")
    assert r.language == "ko"
    assert r.emotion == "HAPPY"
    assert r.event == "Laughter"
    assert r.text == "안녕하세요 어 발표"


def test_sensevoice_EMO_UNKNOWN은_감정없음():
    r = parse_sensevoice("<|ko|><|EMO_UNKNOWN|><|Speech|><|woitn|>텍스트")
    assert r.emotion is None
    assert r.event == "Speech"


def test_emotion2vec_중국어_병기_라벨을_영문_대문자로():
    scores = parse_emotion2vec(
        ["生气/angry", "中立/neutral", "其他/other", "<unk>"], [0.1, 0.8, 0.05, 0.05]
    )
    assert scores == {"ANGRY": 0.1, "NEUTRAL": 0.8}


def test_emotion2vec_확신도가_충분하면_그_감정을_쓴다():
    assert merge_emotion({"SAD": 0.7, "NEUTRAL": 0.2}, "HAPPY") == ("SAD", 0.7)


def test_emotion2vec가_애매하면_sensevoice_감정으로_대체한다():
    assert merge_emotion({"SAD": 0.3, "NEUTRAL": 0.25}, "HAPPY") == ("HAPPY", None)


def test_둘다_모르면_None():
    assert merge_emotion({}, None) == (None, None)
