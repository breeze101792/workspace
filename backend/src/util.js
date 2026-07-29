export function ok(data) {
  return { ok: true, data };
}

export function err(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export function makeId(prefix = 'ws') {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${prefix}_${result}`;
}
