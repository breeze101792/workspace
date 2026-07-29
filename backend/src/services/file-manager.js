import { join, extname } from 'path';
import { safePath, readText, writeText, deleteFile, listDir, fileExists, ensureDir } from '../safe-fs.js';
import { err } from '../util.js';

const TEXT_EXTENSIONS = new Set([
  '.md', '.mdx', '.txt', '.html', '.htm', '.json',
  '.css', '.js', '.mjs', '.ts', '.tsx', '.jsx',
  '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf',
  '.log', '.env', '.sh', '.bash', '.zshrc',
  '.xml', '.svg', '.csv', '.sql',
]);

const MIME_MAP = {
  '.md': 'text/markdown',
  '.mdx': 'text/markdown',
  '.txt': 'text/plain',
  '.html': 'text/html',
  '.htm': 'text/html',
  '.json': 'application/json',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.ts': 'application/x-typescript',
  '.tsx': 'application/x-typescript',
  '.jsx': 'application/javascript',
  '.yaml': 'text/yaml',
  '.yml': 'text/yaml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
};

function workspaceDir(wsId, baseDir) {
  return safePath(baseDir, wsId);
}

function resolveFilePath(wsId, userPath, baseDir) {
  const wsRoot = workspaceDir(wsId, baseDir);
  return safePath(wsRoot, userPath);
}

export async function readWorkspaceFile(wsId, filePath, baseDir) {
  const fullPath = resolveFilePath(wsId, filePath, baseDir);
  if (!(await fileExists(fullPath))) {
    throw err('File not found', 404);
  }
  const ext = extname(filePath).toLowerCase();
  const mime = MIME_MAP[ext] || 'application/octet-stream';
  const isText = TEXT_EXTENSIONS.has(ext);

  let content;
  if (isText) {
    content = await readText(fullPath);
  } else {
    content = ''; // binary files streamed separately
  }

  return { content, mime, isText };
}

export async function writeWorkspaceFile(wsId, filePath, content, baseDir) {
  const fullPath = resolveFilePath(wsId, filePath, baseDir);
  await ensureDir(fullPath);
  await writeText(fullPath, content);

  let size;
  const ext = extname(filePath).toLowerCase();
  const mime = MIME_MAP[ext] || 'application/octet-stream';

  return { path: filePath, size: new TextEncoder().encode(content).length, mime };
}

export async function deleteWorkspaceFile(wsId, filePath, baseDir) {
  const fullPath = resolveFilePath(wsId, filePath, baseDir);
  if (!(await fileExists(fullPath))) {
    throw err('File not found', 404);
  }
  await deleteFile(fullPath);
  return { deleted: true };
}

export async function listWorkspaceFiles(wsId, dirPath, baseDir) {
  const fullPath = dirPath
    ? resolveFilePath(wsId, dirPath, baseDir)
    : workspaceDir(wsId, baseDir);

  if (!(await fileExists(fullPath))) {
    throw err('Directory not found', 404);
  }

  return await listDir(fullPath);
}

export async function uploadWorkspaceFile(wsId, fileName, buffer, baseDir) {
  const ext = extname(fileName).toLowerCase();
  const subdir = MIME_MAP[ext]?.startsWith('image/') ? 'images' : 'files';
  const filePath = `${subdir}/${fileName}`;
  const fullPath = resolveFilePath(wsId, filePath, baseDir);

  await ensureDir(fullPath);
  const { writeFile } = await import('fs/promises');
  await writeFile(fullPath, buffer);

  const mime = MIME_MAP[ext] || 'application/octet-stream';
  return { path: filePath, size: buffer.length, mime };
}
