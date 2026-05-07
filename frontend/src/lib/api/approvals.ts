import { apiClient } from "./client";
import type { ToolCall, ApprovalRequest, ApprovalDecision } from "@/types";

export const toolCallsApi = {
  get: (toolCallId: string) =>
    apiClient.get<ToolCall>(`/api/tool-calls/${toolCallId}`),

  listByRun: (runId: string) =>
    apiClient.get<{ tool_calls: ToolCall[] }>(`/api/runs/${runId}/tool-calls`),
};

export interface ApprovalDecisionRequest {
  decision: ApprovalDecision;
  edited_args?: Record<string, unknown>;
  reason?: string;
}

export const approvalsApi = {
  get: (approvalId: string) =>
    apiClient.get<ApprovalRequest>(`/api/approvals/${approvalId}`),

  pending: () =>
    apiClient.get<{ approvals: ApprovalRequest[] }>("/api/approvals/pending"),

  approve: (approvalId: string, reason?: string) =>
    apiClient.post<ApprovalRequest>(`/api/approvals/${approvalId}/approve`, { reason }),

  reject: (approvalId: string, reason?: string) =>
    apiClient.post<ApprovalRequest>(`/api/approvals/${approvalId}/reject`, { reason }),

  edit: (approvalId: string, editedArgs: Record<string, unknown>, reason?: string) =>
    apiClient.post<ApprovalRequest>(`/api/approvals/${approvalId}/edit`, { edited_args: editedArgs, reason }),
};
