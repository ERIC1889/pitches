import type { Prisma } from "@prisma/client";

/** Report.speechMetrics(JSON)에서 정확도를 꺼낸다. 이전 버전 보고서처럼 값이 없으면 null */
export function readAccuracy(speechMetrics: Prisma.JsonValue | undefined): number | null {
  if (!speechMetrics || typeof speechMetrics !== "object" || Array.isArray(speechMetrics)) {
    return null;
  }
  const v = (speechMetrics as Prisma.JsonObject).accuracy;
  return typeof v === "number" ? v : null;
}
