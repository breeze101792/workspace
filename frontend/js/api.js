const BASE = '';

async function request(method, path, body) {
  const opts = { method, headers: {} };
  if (body instanceof FormData) {
    opts.body = body;
  } else if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(BASE + path, opts);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { ok: false, error: text };
  }
}

export function get(path) { return request('GET', path); }
export function post(path, body) { return request('POST', path, body); }
export function put(path, body) { return request('PUT', path, body); }
export function patch(path, body) { return request('PATCH', path, body); }
export function del(path) { return request('DELETE', path); }

export function upload(wsId, file, subdir) {
  const fd = new FormData();
  fd.append('file', file);
  if (subdir) fd.append('path', subdir);
  return request('POST', `/api/workspaces/${wsId}/upload`, fd);
}
