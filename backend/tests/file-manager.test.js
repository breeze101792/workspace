import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import config from '../src/config.js';
import * as wsManager from '../src/services/workspace-manager.js';
import * as fileManager from '../src/services/file-manager.js';

const testDir = mkdtempSync(join(tmpdir(), 'workspace-file-test-'));
config.WORKSPACES_DIR = join(testDir, 'workspaces');
config.DATA_ROOT = testDir;

let wsId;

before(async () => {
  const ws = await wsManager.createWorkspace('File Test WS');
  wsId = ws.id;
});

after(() => {
  rmSync(testDir, { recursive: true, force: true });
});

describe('fileManager', () => {
  describe('writeWorkspaceFile', () => {
    it('writes text content to a file', async () => {
      const result = await fileManager.writeWorkspaceFile(wsId, 'hello.txt', 'Hello World', config.WORKSPACES_DIR);
      assert.ok(result.path.endsWith('hello.txt'));
      assert.ok(result.size > 0);
      assert.strictEqual(result.mime, 'text/plain');
    });

    it('creates subdirectories automatically', async () => {
      const result = await fileManager.writeWorkspaceFile(wsId, 'markdown/note.md', '# Markdown', config.WORKSPACES_DIR);
      assert.strictEqual(result.mime, 'text/markdown');
    });

    it('strips path traversal and writes within root', async () => {
      const result = await fileManager.writeWorkspaceFile(wsId, '../../../evil.txt', 'bad', config.WORKSPACES_DIR);
      assert.ok(result.path.endsWith('evil.txt'));
    });
  });

  describe('readWorkspaceFile', () => {
    it('reads back a written file', async () => {
      await fileManager.writeWorkspaceFile(wsId, 'readtest.txt', 'read me', config.WORKSPACES_DIR);
      const result = await fileManager.readWorkspaceFile(wsId, 'readtest.txt', config.WORKSPACES_DIR);
      assert.strictEqual(result.content, 'read me');
      assert.strictEqual(result.isText, true);
    });

    it('returns 404 for missing file', async () => {
      await assert.rejects(
        () => fileManager.readWorkspaceFile(wsId, 'nope.txt', config.WORKSPACES_DIR),
        { status: 404 }
      );
    });
  });

  describe('deleteWorkspaceFile', () => {
    it('deletes an existing file', async () => {
      await fileManager.writeWorkspaceFile(wsId, 'todelete.txt', 'delete me', config.WORKSPACES_DIR);
      const result = await fileManager.deleteWorkspaceFile(wsId, 'todelete.txt', config.WORKSPACES_DIR);
      assert.strictEqual(result.deleted, true);

      await assert.rejects(
        () => fileManager.readWorkspaceFile(wsId, 'todelete.txt', config.WORKSPACES_DIR),
        { status: 404 }
      );
    });

    it('returns 404 when deleting non-existent file', async () => {
      await assert.rejects(
        () => fileManager.deleteWorkspaceFile(wsId, 'ghost.txt', config.WORKSPACES_DIR),
        { status: 404 }
      );
    });
  });

  describe('listWorkspaceFiles', () => {
    it('lists files at root', async () => {
      await fileManager.writeWorkspaceFile(wsId, 'a.txt', 'a', config.WORKSPACES_DIR);
      await fileManager.writeWorkspaceFile(wsId, 'b.txt', 'b', config.WORKSPACES_DIR);

      const entries = await fileManager.listWorkspaceFiles(wsId, '', config.WORKSPACES_DIR);
      const names = entries.map(e => e.name);
      assert.ok(names.includes('a.txt'));
      assert.ok(names.includes('b.txt'));
    });

    it('lists files in subdirectory', async () => {
      await fileManager.writeWorkspaceFile(wsId, 'docs/readme.md', '# Docs', config.WORKSPACES_DIR);
      const entries = await fileManager.listWorkspaceFiles(wsId, 'docs', config.WORKSPACES_DIR);
      assert.strictEqual(entries.length, 1);
      assert.strictEqual(entries[0].name, 'readme.md');
    });

    it('returns 404 for non-existent directory', async () => {
      await assert.rejects(
        () => fileManager.listWorkspaceFiles(wsId, 'nonexistent', config.WORKSPACES_DIR),
        { status: 404 }
      );
    });
  });

  describe('uploadWorkspaceFile', () => {
    it('stores uploaded file content', async () => {
      const buffer = Buffer.from('image data');
      const result = await fileManager.uploadWorkspaceFile(wsId, 'photo.png', buffer, config.WORKSPACES_DIR);
      assert.ok(result.path.startsWith('images/'));
      assert.strictEqual(result.mime, 'image/png');
      assert.strictEqual(result.size, 10);

      const { existsSync } = await import('node:fs');
      const { join } = await import('node:path');
      assert.ok(existsSync(join(config.WORKSPACES_DIR, wsId, result.path)));
    });

    it('places unknown extensions in files/', async () => {
      const buffer = Buffer.from('binary');
      const result = await fileManager.uploadWorkspaceFile(wsId, 'data.bin', buffer, config.WORKSPACES_DIR);
      assert.ok(result.path.startsWith('files/'));
    });
  });
});
