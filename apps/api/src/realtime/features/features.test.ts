import { describe, expect, it } from "vitest";
import { countFillers } from "./fillers.js";
import { computeWpm } from "./wpm.js";

describe("countFillers", () => {
  it("독립된 간투사 토큰만 센다", () => {
    expect(countFillers("음 오늘은 어 발표를 하겠습니다")).toBe(2);
  });

  it("일반 단어 안의 글자는 세지 않는다", () => {
    expect(countFillers("어떻게 그래서 음식을 아니 그 사람이")).toBe(0);
  });

  it("문장부호가 붙은 간투사도 센다", () => {
    expect(countFillers("음... 어, 그러니까 저기 뭐")).toBe(4);
  });

  it("늘어진 간투사도 센다", () => {
    expect(countFillers("으음 아아 에 흠")).toBe(4);
  });
});

describe("computeWpm", () => {
  it("공백 제외 글자 수를 분당으로 환산한다", () => {
    expect(computeWpm("가나다 라마", 1000)).toBe(300);
  });
});
