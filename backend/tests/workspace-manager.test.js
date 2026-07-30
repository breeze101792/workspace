import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Override config before importing services
const testDir = mkdtempSync(join(tmpdir(), 'workspace-mgr-test-'));
const originalEnv = { ...process.env };
process.env.WORKSPACE_DIR = testDir;

// We need to dynamically import after setting up the test dir
import config from '../src/config.js';
import * as wsManager from '../src/services/workspace-manager.js';

// Point config to test dir
config.WORKSPACES_DIR = join(testDir, 'workspaces');
config.DATA_ROOT = testDir;
config.CONFIG_FILE = join(testDir, 'config.json');

after(() => {
  rmSync(testDir, { recursive: true, force: true });
});

describe('workspaceManager', () => {
  it('lists empty when no workspaces', async () => {
    const list = await wsManager.listWorkspaces();
    assert.deepStrictEqual(list, []);
  });

  it('creates a workspace', async () => {
    const ws = await wsManager.createWorkspace('My Project');
    assert.ok(ws.id.startsWith('ws_'));
    assert.strictEqual(ws.name, 'My Project');
    assert.ok(existsSync(join(config.WORKSPACES_DIR, ws.id, 'workspace.json')));
  });

  it('rejects empty name', async () => {
    await assert.rejects(
      () => wsManager.createWorkspace(''),
      { status: 400 }
    );
  });

  it('rejects name longer than 200 chars', async () => {
    await assert.rejects(
      () => wsManager.createWorkspace('x'.repeat(201)),
      { status: 400 }
    );
  });

  it('lists created workspaces', async () => {
    await wsManager.createWorkspace('WS A');
    await wsManager.createWorkspace('WS B');
    const list = await wsManager.listWorkspaces();
    assert.ok(list.length >= 2);
    const names = list.map(w => w.name);
    assert.ok(names.includes('WS A'));
    assert.ok(names.includes('WS B'));
  });

  it('gets a workspace by id', async () => {
    const created = await wsManager.createWorkspace('Gettable');
    const ws = await wsManager.getWorkspace(created.id);
    assert.strictEqual(ws.name, 'Gettable');
    assert.ok(Array.isArray(ws.windows));
    assert.ok(ws.settings);
  });

  it('throws 404 for non-existent workspace', async () => {
    await assert.rejects(
      () => wsManager.getWorkspace('ws_nonexistent'),
      { status: 404 }
    );
  });

  it('updates workspace name', async () => {
    const created = await wsManager.createWorkspace('Original');
    await wsManager.updateWorkspace(created.id, { name: 'Updated' });
    const ws = await wsManager.getWorkspace(created.id);
    assert.strictEqual(ws.name, 'Updated');
  });

  it('rejects invalid name on update', async () => {
    const created = await wsManager.createWorkspace('Valid');
    await assert.rejects(
      () => wsManager.updateWorkspace(created.id, { name: 'x'.repeat(201) }),
      { status: 400 }
    );
  });

  it('adds windows to workspace', async () => {
    const created = await wsManager.createWorkspace('With Windows');
    await wsManager.updateWorkspace(created.id, {
      windows: [{
        id: 'wnd_test1',
        type: 'markdown',
        title: 'Test',
        x: 100, y: 100,
        width: 600, height: 400,
        zIndex: 1,
        minimized: false, maximized: false,
        file: null, filePath: null,
        metadata: {},
      }]
    });
    const ws = await wsManager.getWorkspace(created.id);
    assert.strictEqual(ws.windows.length, 1);
    assert.strictEqual(ws.windows[0].title, 'Test');
  });

  it('rejects invalid windows array', async () => {
    const created = await wsManager.createWorkspace('Bad Windows');
    await assert.rejects(
      () => wsManager.updateWorkspace(created.id, { windows: 'not-array' }),
      { status: 400 }
    );
  });

  it('rejects window missing required fields', async () => {
    const created = await wsManager.createWorkspace('Missing Fields');
    await assert.rejects(
      () => wsManager.updateWorkspace(created.id, {
        windows: [{ id: 'wnd_bad' }]  // missing type, x, y, width, height
      }),
      { status: 400 }
    );
  });

  it('updates settings', async () => {
    const created = await wsManager.createWorkspace('Settings');
    await wsManager.updateWorkspace(created.id, {
      settings: { zoom: 2.0, viewportX: 100, viewportY: 200 }
    });
    const ws = await wsManager.getWorkspace(created.id);
    assert.strictEqual(ws.settings.zoom, 2.0);
    assert.strictEqual(ws.settings.viewportX, 100);
  });

  it('updates updatedAt on every change', async () => {
    const created = await wsManager.createWorkspace('Time Test');
    const original = await wsManager.getWorkspace(created.id);
    const origUpdated = original.updatedAt;

    await new Promise(r => setTimeout(r, 10));
    await wsManager.updateWorkspace(created.id, { name: 'Time Test Renamed' });
    const updated = await wsManager.getWorkspace(created.id);
    assert.notStrictEqual(updated.updatedAt, origUpdated);
  });
});
