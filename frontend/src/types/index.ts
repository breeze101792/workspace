export interface WindowState {
  id: string;
  type: string;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  minimized: boolean;
  maximized: boolean;
  file: string | null;
  filePath: string | null;
  metadata: Record<string, unknown>;
}

export interface Workspace {
  id: string;
  name: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
  windows: WindowState[];
  settings: WorkspaceSettings;
}

export interface WorkspaceSettings {
  zoom: number;
  viewportX: number;
  viewportY: number;
  snapToGrid: boolean;
  gridSize: number;
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  updatedAt?: string;
}

export interface FileEntry {
  name: string;
  type: 'file' | 'directory';
  size: number;
  mime?: string;
  updatedAt: string;
}

export interface ApiOk<T> {
  ok: true;
  data: T;
}

export interface ApiError {
  ok: false;
  error: string;
}

export type ApiResponse<T> = ApiOk<T> | ApiError;

export interface WSMessage {
  type: string;
  workspace: string;
  data: unknown;
  seq: number;
}
