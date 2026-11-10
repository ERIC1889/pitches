import type { TickColor } from "@pitches/shared";

export const colors = {
  brand: "#4F46E5",
  brandDark: "#312E81",
  text: "#111827",
  muted: "#6B7280",
  subtle: "#9CA3AF",
  border: "#E5E7EB",
  surface: "#F3F4F6",
  background: "#FFFFFF",
  danger: "#EF4444",
};

/** Pitches Circle 색상 (발표자료 시안 기준) */
export const tickColors: Record<TickColor, string> = {
  green: "#10B981",
  yellow: "#F59E0B",
  red: "#EF4444",
};

/** 정확도(0~100)를 실시간 판정과 같은 3색으로 */
export function accuracyColor(accuracy: number): string {
  if (accuracy >= 75) return tickColors.green;
  if (accuracy >= 50) return tickColors.yellow;
  return tickColors.red;
}
