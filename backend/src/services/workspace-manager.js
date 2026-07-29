import { join } from 'path';
import config from '../config.js';
import { safePath, atomicWrite, readText, fileExists, ensureDir, listDir } from '../safe-fs.js';
import { ok, err, makeId } from '../util.js';

function workspaceDir(wsId) {
  return safePath(config.WORKSPACES_DIR, wsId);
}

function workspaceFile(wsId) {
  return join(workspaceDir(wsId), 'workspace.json');
}

function validateWindow(window, index) {
  const errors = [];
  if (!window.id) errors.push(`windows[${index}].id is required`);
  if (!window.type) errors.push(`windows[${index}].type is required`);
  if (typeof window.x !== 'number') errors.push(`windows[${index}].x must be a number`);
  if (typeof window.y !== 'number') errors.push(`windows[${index}].y must be a number`);
  if (typeof window.width !== 'number') errors.push(`windows[${index}].width must be a number`);
  if (typeof window.height !== 'number') errors.push(`windows[${index}].height must be a number`);
  return errors;
}

export async function listWorkspaces() {
  await ensureDir(config.WORKSPACES_DIR);
  const entries = await listDir(config.WORKSPACES_DIR);
  const workspaces = [];
  for (const entry of entries) {
    if (entry.type === 'directory') {
      try {
        const wsData = JSON.parse(await readText(workspaceFile(entry.name)));
        workspaces.push({
          id: entry.name,
          name: wsData.name || entry.name,
          updatedAt: wsData.updatedAt,
        });
      } catch {
        // skip invalid workspace dirs
      }
    }
  }
  return workspaces.sort((a, b) => b.updatedAt?.localeCompare(a.updatedAt));
}

export async function createWorkspace(name) {
  if (!name || typeof name !== 'string' || name.length > 200) {
    throw err('name is required (max 200 chars)', 400);
  }
  const id = makeId('ws');
  const dir = workspaceDir(id);
  await ensureDir(dir);

  const now = new Date().toISOString();
  const data = {
    version: 1,
    id,
    name: name.trim(),
    description: '',
    createdAt: now,
    updatedAt: now,
    windows: [],
    settings: {
      zoom: 1.0,
      viewportX: 0,
      viewportY: 0,
      snapToGrid: false,
      gridSize: 20,
    },
  };

  await atomicWrite(workspaceFile(id), JSON.stringify(data, null, 2));
  return { id, name: data.name, path: dir };
}

export async function getWorkspace(wsId) {
  const file = workspaceFile(wsId);
  if (!(await fileExists(file))) {
    throw err('Workspace not found', 404);
  }
  return JSON.parse(await readText(file));
}

export async function updateWorkspace(wsId, updates) {
  const ws = await getWorkspace(wsId);

  if (updates.name !== undefined) {
    if (typeof updates.name !== 'string' || updates.name.length > 200) {
      throw err('Invalid name', 400);
    }
    ws.name = updates.name.trim();
  }

  if (updates.description !== undefined) {
    ws.description = String(updates.description);
  }

  if (updates.windows !== undefined) {
    if (!Array.isArray(updates.windows)) {
      throw err('windows must be an array', 400);
    }
    const allErrors = [];
    updates.windows.forEach((w, i) => allErrors.push(...validateWindow(w, i)));
    if (allErrors.length > 0) {
      throw err(allErrors.join('; '), 400);
    }
    ws.windows = updates.windows;
  }

  if (updates.settings !== undefined) {
    if (typeof updates.settings !== 'object') {
      throw err('settings must be an object', 400);
    }
    ws.settings = { ...ws.settings, ...updates.settings };
  }

  ws.updatedAt = new Date().toISOString();
  await atomicWrite(workspaceFile(wsId), JSON.stringify(ws, null, 2));
  return { updatedAt: ws.updatedAt };
}

export async function deleteWorkspace(wsId) {
  const ws = await getWorkspace(wsId);
  const dir = workspaceDir(wsId);
  await rm(dir, { recursive: true, force: true });
  return { deleted: true };
}
