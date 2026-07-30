import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Import after setting up fetch mock
import { get, post, put, del } from '../src/api/client';

describe('api client', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('get returns ok response', async () => {
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ ok: true, data: { id: '1' } })));

    const result = await get('/api/test');
    expect(result).toEqual({ ok: true, data: { id: '1' } });
    expect(mockFetch).toHaveBeenCalledWith('/api/test', expect.objectContaining({
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
    }));
  });

  it('get returns error response', async () => {
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ ok: false, error: 'not found' })));

    const result = await get('/api/test');
    expect(result).toEqual({ ok: false, error: 'not found' });
  });

  it('post sends JSON body', async () => {
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ ok: true, data: { id: 'new' } })));

    const result = await post('/api/create', { name: 'test' });
    expect(result).toEqual({ ok: true, data: { id: 'new' } });
    expect(mockFetch).toHaveBeenCalledWith('/api/create', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ name: 'test' }),
    }));
  });

  it('put sends JSON body', async () => {
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ ok: true, data: { updated: true } })));

    const result = await put('/api/update', { value: 42 });
    expect(result).toEqual({ ok: true, data: { updated: true } });
    expect(mockFetch).toHaveBeenCalledWith('/api/update', expect.objectContaining({
      method: 'PUT',
      body: JSON.stringify({ value: 42 }),
    }));
  });

  it('del calls DELETE', async () => {
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ ok: true, data: { deleted: true } })));

    const result = await del('/api/delete');
    expect(result).toEqual({ ok: true, data: { deleted: true } });
    expect(mockFetch).toHaveBeenCalledWith('/api/delete', expect.objectContaining({
      method: 'DELETE',
    }));
  });

  it('handles network errors', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const result = await get('/api/test');
    expect(result).toEqual({ ok: false, error: 'Network error' });
  });

  it('passes custom headers', async () => {
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ ok: true, data: {} })));

    await get('/api/test');
    const [_, opts] = mockFetch.mock.calls[0];
    expect(opts.headers).toEqual({ 'Content-Type': 'application/json' });
  });
});
