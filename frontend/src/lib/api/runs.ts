import { apiClient } from "./client";
import type { Run, RunStatus } from "@/types";

export interface CreateRunRequest {
  session_id: string;
  model?: string;
  messages: Array<{ role: string; content: string }>;
}

export interface RunListResponse {
  runs: Run[];
  total: number;
}

export const runsApi = {
  list: (sessionId?: string) =>
    apiClient.get<RunListResponse>("/api/runs", sessionId ? { session_id: sessionId } : undefined),

  get: (runId: string) =>
    apiClient.get<Run>(`/api/runs/${runId}`),

  create: (data: CreateRunRequest) =>
    apiClient.post<Run>("/api/runs", data),

  cancel: (runId: string) =>
    apiClient.post<Run>(`/api/runs/${runId}/cancel`),

  events: (runId: string) =>
    `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/runs/${runId}/events`,
};
