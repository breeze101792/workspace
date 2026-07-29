import type { ApiResponse } from '../types';

async function request<T>(path: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(path, {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    const body = await res.json();
    return body as ApiResponse<T>;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Network error' };
  }
}

export async function get<T>(path: string): Promise<ApiResponse<T>> {
  return request<T>(path);
}

export async function post<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
  return request<T>(path, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
}

export async function put<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
  return request<T>(path, {
    method: 'PUT',
    body: body ? JSON.stringify(body) : undefined,
  });
}

export async function del<T>(path: string): Promise<ApiResponse<T>> {
  return request<T>(path, { method: 'DELETE' });
}

export async function upload<T>(path: string, file: File): Promise<ApiResponse<T>> {
  try {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(path, {
      method: 'POST',
      credentials: 'same-origin',
      body: form,
    });
    const body = await res.json();
    return body as ApiResponse<T>;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Upload failed' };
  }
}
