import { isFillerToken } from "@pitches/shared";

const TOKEN_SEPARATOR = /[\s.,!?…~·"'()]+/;

/** STT 텍스트의 간투사 수. 판정 규칙은 @pitches/shared 의 isFillerToken (앱 자막 강조와 공통) */
export function countFillers(text: string): number {
  return text.split(TOKEN_SEPARATOR).filter(isFillerToken).length;
}
