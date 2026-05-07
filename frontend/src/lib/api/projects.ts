import { apiClient } from "./client";
import type { Project } from "@/types";

export interface CreateProjectRequest {
  name: string;
  description?: string;
}

export const projectsApi = {
  list: () =>
    apiClient.get<Project[]>("/api/projects"),

  get: (projectId: string) =>
    apiClient.get<Project>(`/api/projects/${projectId}`),

  create: (data: CreateProjectRequest) =>
    apiClient.post<Project>("/api/projects", data),

  update: (projectId: string, data: Partial<CreateProjectRequest>) =>
    apiClient.patch<Project>(`/api/projects/${projectId}`, data),

  delete: (projectId: string) =>
    apiClient.delete(`/api/projects/${projectId}`),
};
