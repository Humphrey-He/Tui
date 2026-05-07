import { apiClient } from "./client";
import type { Run, RunStatus, ToolCall, AgentStep, FileDiff } from "@/types";

export interface CreateRunRequest {
  session_id: string;
  model?: string;
  messages: Array<{ role: string; content: string }>;
}

export interface RunListResponse {
  runs: Run[];
  total: number;
}

export interface ToolCallListResponse {
  tool_calls: ToolCall[];
}

export interface AgentStepListResponse {
  steps: AgentStep[];
}

export interface FileDiffListResponse {
  diffs: FileDiff[];
}

export const runsApi = {
  list: (sessionId?: string, status?: RunStatus) =>
    apiClient.get<RunListResponse>("/api/runs", {
      ...(sessionId && { session_id: sessionId }),
      ...(status && { status }),
    }),

  get: (runId: string) =>
    apiClient.get<Run>(`/api/runs/${runId}`),

  create: (data: CreateRunRequest) =>
    apiClient.post<Run>("/api/runs", data),

  cancel: (runId: string) =>
    apiClient.post<Run>(`/api/runs/${runId}/cancel`),

  events: (runId: string) =>
    `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/runs/${runId}/events`,

  // Tool calls
  toolCalls: (runId: string) =>
    apiClient.get<ToolCallListResponse>(`/api/runs/${runId}/tool-calls`),

  // Steps
  steps: (runId: string) =>
    apiClient.get<AgentStepListResponse>(`/api/runs/${runId}/steps`),

  // File diffs
  diffs: (runId: string) =>
    apiClient.get<FileDiffListResponse>(`/api/runs/${runId}/diffs`),
};
