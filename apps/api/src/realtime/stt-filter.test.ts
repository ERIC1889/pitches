import { describe, expect, it } from "vitest";
import { isLikelyHallucination } from "./sttFilter.js";

describe("isLikelyHallucination", () => {
  it.each([
    "시청해주셔서 감사합니다.",
    "구독과 좋아요 부탁드립니다",
    "MBC 뉴스 이덕영입니다.",
    "   ",
  ])("무음 환각 문구를 걸러낸다: %s", (text) => {
    expect(isLikelyHallucination(text)).toBe(true);
  });

  it("정상 발화는 통과시킨다", () => {
    expect(isLikelyHallucination("오늘 발표 주제는 AI입니다")).toBe(false);
  });
});
