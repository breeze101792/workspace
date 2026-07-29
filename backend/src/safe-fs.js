import { mkdir, writeFile, rename, readFile, unlink, readdir, stat } from 'fs/promises';
import { join, resolve, relative, normalize } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

export function safePath(root, userPath) {
  const normalized = normalize(userPath || '').replace(/^(\.\.(\/|\\|$))+/, '');
  const resolved = resolve(root, normalized);
  if (!resolved.startsWith(resolve(root))) {
    throw Object.assign(new Error('Path traversal detected'), { status: 422 });
  }
  return resolved;
}

export async function atomicWrite(filePath, data) {
  const tmp = join(tmpdir(), `tmp_${randomUUID()}`);
  await ensureDir(filePath);
  await writeFile(tmp, data, 'utf-8');
  await rename(tmp, filePath);
}

export async function ensureDir(filePath) {
  const dir = filePath.includes('/') ? filePath.substring(0, filePath.lastIndexOf('/')) : '.';
  if (dir !== '.') {
    await mkdir(dir, { recursive: true });
  }
}

export async function readText(filePath) {
  return await readFile(filePath, 'utf-8');
}

export async function writeText(filePath, content) {
  await atomicWrite(filePath, content);
}

export async function deleteFile(filePath) {
  await unlink(filePath);
}

export async function listDir(dirPath) {
  let entries;
  try {
    entries = await readdir(dirPath, { withFileTypes: true });
  } catch (e) {
    if (e.code === 'ENOENT') return [];
    throw e;
  }
  const results = [];
  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name);
    const s = await stat(fullPath);
    results.push({
      name: entry.name,
      type: entry.isDirectory() ? 'directory' : 'file',
      size: entry.isDirectory() ? 0 : s.size,
      updatedAt: s.mtime.toISOString(),
    });
  }
  results.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return results;
}

export async function fileExists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}
