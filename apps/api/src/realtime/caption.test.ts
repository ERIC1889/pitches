import { describe, expect, it } from "vitest";
import { currentSentence, splitCaptionTokens } from "@pitches/shared";

describe("currentSentence", () => {
  it("여러 5초 조각을 이어 붙여 마지막 문장을 고른다", () => {
    expect(currentSentence(["안녕하세요. 오늘은", "피치스를 소개하겠습니다"])).toBe(
      "오늘은 피치스를 소개하겠습니다."
    );
  });

  it("마지막 조각이 너무 짧으면 바로 앞 문장을 유지한다", () => {
    expect(currentSentence(["오늘은 피치스를 소개합니다. 발표 중에"])).toBe(
      "오늘은 피치스를 소개합니다."
    );
  });

  it("문장부호가 없어도(SenseVoice) 한국어 종결 어미에서 문장을 나눈다", () => {
    expect(currentSentence(["소개 하 려고 합니다 발표 를 하다 보면 음 말이 빨라 지거나"])).toBe(
      "소개 하 려고 합니다."
    );
    expect(currentSentence(["작 아 지는 경 우가 많 습니다"])).toBe("작 아 지는 경 우가 많 습니다.");
  });

  it("어미가 아닌 단어(필요)에서는 나누지 않는다", () => {
    expect(currentSentence(["이 부분은 정말 필요 없는 말이에요"])).toBe(
      "이 부분은 정말 필요 없는 말이에요."
    );
  });

  it("문장부호도 어미도 없으면 조각 전체를 한 문장으로 본다", () => {
    expect(currentSentence(["오늘 저는 어 피치스라는 서비스를"])).toBe("오늘 저는 어 피치스라는 서비스를");
  });

  it("실제 SenseVoice 5초 조각을 차례로 받으면 완성된 문장을 하나씩 보여준다", () => {
    const chunks = [
      "안녕 하 세요오늘 저는 어 피치스 라는 에이아 스피치 코칭 서비스",
      "소개 하 려고 합니다 발표 를 하다 보면 음 말이 빨라 지거나 목소 리가",
      "작 아 지는 경 우가 많 습니다 피치스 는 발표 중 5 초 마다 음성 을 분석 해서",
      "조록 노랑 빨간색 으로 바로 알려 줍니다 감사 합니다",
    ];
    const shown = chunks.map((_, i) => currentSentence(chunks.slice(0, i + 1)));
    expect(shown).toEqual([
      "안녕 하 세요오늘 저는 어 피치스 라는 에이아 스피치 코칭 서비스",
      "안녕 하 세요오늘 저는 어 피치스 라는 에이아 스피치 코칭 서비스 소개 하 려고 합니다.",
      "발표 를 하다 보면 음 말이 빨라 지거나 목소 리가 작 아 지는 경 우가 많 습니다.",
      "피치스 는 발표 중 5 초 마다 음성 을 분석 해서 조록 노랑 빨간색 으로 바로 알려 줍니다.",
    ]);
  });

  it("빈 입력은 빈 문자열", () => {
    expect(currentSentence([])).toBe("");
    expect(currentSentence(["  "])).toBe("");
  });
});

describe("splitCaptionTokens", () => {
  it("간투사 토큰을 표시하고 공백·문장부호는 그대로 둔다", () => {
    const tokens = splitCaptionTokens("음 오늘은, 어 발표");
    expect(tokens.map((t) => t.text).join("")).toBe("음 오늘은, 어 발표");
    expect(tokens.filter((t) => t.filler).map((t) => t.text)).toEqual(["음", "어"]);
  });
});
