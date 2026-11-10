import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CoachingReport,
  SessionStatus,
  SpeechMetrics,
  TickColor,
} from "@pitches/shared";
import { apiClient } from "./client";

export interface SessionSummary {
  id: string;
  title: string;
  status: SessionStatus;
  createdAt: string;
  durationSec: number | null;
  accuracy: number | null;
  report: { id: string; overallScore: number } | null;
}

export interface ReportDetail {
  id: string;
  overallScore: number;
  transcript: string;
  summary: CoachingReport;
  speechMetrics: SpeechMetrics;
  generatedAt: string;
}

export interface SessionDetail {
  id: string;
  title: string;
  status: SessionStatus;
  createdAt: string;
  durationSec: number | null;
  report: ReportDetail | null;
  ticks: { offsetMs: number; color: TickColor; speedWpm: number; fillerCnt: number }[];
}

export interface ProgressPoint {
  sessionId: string;
  title: string;
  date: string;
  accuracy: number | null;
  overallScore: number | null;
}

export const queryKeys = {
  sessions: ["sessions"] as const,
  session: (id: string) => ["session", id] as const,
  progress: ["progress"] as const,
};

export function useSessions() {
  return useQuery({
    queryKey: queryKeys.sessions,
    queryFn: async () =>
      (await apiClient.get<{ sessions: SessionSummary[] }>("/sessions")).data.sessions,
  });
}

/** 분석 중이면 3초마다 다시 조회해서 완료를 감지 */
export function useSession(id: string) {
  return useQuery({
    queryKey: queryKeys.session(id),
    queryFn: async () => (await apiClient.get<SessionDetail>(`/sessions/${id}`)).data,
    refetchInterval: (query) =>
      query.state.data?.status === "ANALYZING" ? 3000 : false,
  });
}

export function useProgress() {
  return useQuery({
    queryKey: queryKeys.progress,
    queryFn: async () =>
      (await apiClient.get<{ points: ProgressPoint[] }>("/stats/progress")).data.points,
  });
}

/** 실패했거나 중간에 끊긴 세션을 다시 분석 요청 */
export function useRetryAnalysis(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.post(`/sessions/${id}/finalize`),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.session(id) }),
  });
}
