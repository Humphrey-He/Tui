import { apiClient } from "./client";
import type { Session, Message } from "@/types";

export interface CreateSessionRequest {
  project_id: string;
  name?: string;
}

export interface SessionListResponse {
  sessions: Session[];
  total: number;
}

export const sessionsApi = {
  list: (projectId?: string) =>
    apiClient.get<SessionListResponse>("/api/sessions", projectId ? { project_id: projectId } : undefined),

  get: (sessionId: string) =>
    apiClient.get<Session>(`/api/sessions/${sessionId}`),

  create: (data: CreateSessionRequest) =>
    apiClient.post<Session>("/api/sessions", data),

  messages: (sessionId: string) =>
    apiClient.get<{ messages: Message[] }>(`/api/sessions/${sessionId}/messages`),

  addMessage: (sessionId: string, content: string, role: string = "user") =>
    apiClient.post<Message>(`/api/sessions/${sessionId}/messages`, { content, role }),
};
