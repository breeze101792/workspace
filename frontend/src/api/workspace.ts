import { get, post, put, del } from './client';
import type { Workspace, WorkspaceSummary } from '../types';

export function listWorkspaces() {
  return get<WorkspaceSummary[]>('/api/workspaces');
}

export function createWorkspace(name: string) {
  return post<{ id: string; name: string; path: string }>('/api/workspaces', { name });
}

export function getWorkspace(id: string) {
  return get<Workspace>(`/api/workspaces/${id}`);
}

export function updateWorkspace(id: string, data: Partial<Workspace>) {
  return put<{ updatedAt: string }>(`/api/workspaces/${id}`, data);
}

export function deleteWorkspace(id: string) {
  return del<{ deleted: boolean }>(`/api/workspaces/${id}`);
}
