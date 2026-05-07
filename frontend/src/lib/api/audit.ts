import { apiClient } from "./client";
import type { AuditLog } from "@/types";

export interface AuditLogListResponse {
  logs: AuditLog[];
  total: number;
}

export const auditApi = {
  list: (params?: {
    project_id?: string;
    action?: string;
    actor_id?: string;
    limit?: number;
    offset?: number;
  }) =>
    apiClient.get<AuditLogListResponse>("/api/audit-logs", params as Record<string, string>),

  get: (logId: string) =>
    apiClient.get<AuditLog>(`/api/audit-logs/${logId}`),
};
