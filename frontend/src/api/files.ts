import { get, put, del, upload } from './client';
import type { FileEntry } from '../types';

export function listFiles(wsId: string, dir?: string) {
  const q = dir ? `?dir=${encodeURIComponent(dir)}` : '';
  return get<{ path: string; entries: FileEntry[] }>(`/api/workspaces/${wsId}/files${q}`);
}

export function readFile(wsId: string, filePath: string) {
  return get<{ content: string; mime: string }>(`/api/workspaces/${wsId}/files/${filePath}`);
}

export function writeFile(wsId: string, filePath: string, content: string) {
  return put<{ path: string; size: number; mime: string }>(
    `/api/workspaces/${wsId}/files/${filePath}`,
    { content }
  );
}

export function deleteFile(wsId: string, filePath: string) {
  return del<{ deleted: boolean }>(`/api/workspaces/${wsId}/files/${filePath}`);
}

export function uploadFile(wsId: string, file: File) {
  return upload<{ path: string; size: number; mime: string }>(`/api/workspaces/${wsId}/upload`, file);
}
