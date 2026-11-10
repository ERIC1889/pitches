/** "2025년 4월 27일 10시 53분" (발표자료 시안 형식) */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${d.getHours()}시 ${d.getMinutes()}분`;
}

/** 경과 시간 "mm:ss" */
export function formatClock(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = String(Math.floor(total / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${m}:${s}`;
}

/** 발표 길이 "3분 12초" */
export function formatDuration(sec: number | null | undefined): string {
  if (!sec) return "-";
  return sec >= 60 ? `${Math.floor(sec / 60)}분 ${sec % 60}초` : `${sec}초`;
}
