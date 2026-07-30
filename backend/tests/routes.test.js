import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import http from 'node:http';

import config from '../src/config.js';
import { createApp } from '../src/server.js';

const testDir = mkdtempSync(join(tmpdir(), 'workspace-routes-test-'));
config.WORKSPACES_DIR = join(testDir, 'workspaces');
config.DATA_ROOT = testDir;

let server;
let baseUrl;

before(() => {
  const app = createApp();
  server = http.createServer(app);
  return new Promise((resolve) => {
    server.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://localhost:${port}`;
      server.unref();
      resolve();
    });
  });
});

after(() => {
  server.close();
  rmSync(testDir, { recursive: true, force: true });
});

async function req(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${baseUrl}${path}`, opts);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, body: data };
}

describe('API Routes', () => {
  describe('GET /api/health', () => {
    it('returns ok', async () => {
      const { status, body } = await req('GET', '/api/health');
      assert.strictEqual(status, 200);
      assert.strictEqual(body.ok, true);
    });
  });

  describe('Workspace CRUD', () => {
    let wsId;

    it('POST creates workspace', async () => {
      const { status, body } = await req('POST', '/api/workspaces', { name: 'API Test' });
      assert.strictEqual(status, 201);
      assert.strictEqual(body.ok, true);
      assert.ok(body.data.id.startsWith('ws_'));
      wsId = body.data.id;
    });

    it('POST rejects empty name', async () => {
      const { status } = await req('POST', '/api/workspaces', { name: '' });
      assert.strictEqual(status, 400);
    });

    it('GET lists workspaces', async () => {
      const { status, body } = await req('GET', '/api/workspaces');
      assert.strictEqual(status, 200);
      assert.ok(body.data.length >= 1);
    });

    it('GET :id gets workspace', async () => {
      const { status, body } = await req('GET', `/api/workspaces/${wsId}`);
      assert.strictEqual(status, 200);
      assert.strictEqual(body.data.name, 'API Test');
    });

    it('GET :id 404 for missing', async () => {
      const { status } = await req('GET', '/api/workspaces/ws_nonexistent');
      assert.strictEqual(status, 404);
    });

    it('PUT updates name', async () => {
      const { status } = await req('PUT', `/api/workspaces/${wsId}`, { name: 'Renamed' });
      assert.strictEqual(status, 200);
      const { body } = await req('GET', `/api/workspaces/${wsId}`);
      assert.strictEqual(body.data.name, 'Renamed');
    });

    it('PUT adds windows', async () => {
      const { status } = await req('PUT', `/api/workspaces/${wsId}`, {
        windows: [{
          id: 'wnd_route1', type: 'text', title: 'Test',
          x: 10, y: 20, width: 400, height: 300,
          zIndex: 1, minimized: false, maximized: false,
          file: null, filePath: null, metadata: {},
        }]
      });
      assert.strictEqual(status, 200);
      const { body } = await req('GET', `/api/workspaces/${wsId}`);
      assert.strictEqual(body.data.windows.length, 1);
    });
  });

  describe('File CRUD', () => {
    let wsId;

    before(async () => {
      const { body } = await req('POST', '/api/workspaces', { name: 'File WS' });
      wsId = body.data.id;
    });

    it('PUT writes file', async () => {
      const { status, body } = await req('PUT', `/api/workspaces/${wsId}/files/test.txt`, { content: 'hello' });
      assert.strictEqual(status, 200);
      assert.strictEqual(body.ok, true);
    });

    it('GET reads file', async () => {
      const { status, body } = await req('GET', `/api/workspaces/${wsId}/files/test.txt`);
      assert.strictEqual(status, 200);
      assert.strictEqual(body.data.content, 'hello');
    });

    it('GET lists directory', async () => {
      const { body } = await req('GET', `/api/workspaces/${wsId}/files`);
      assert.ok(body.ok);
      assert.ok(body.data.entries.some(e => e.name === 'test.txt'));
    });

    it('GET file 404', async () => {
      const { status } = await req('GET', `/api/workspaces/${wsId}/files/nope.txt`);
      assert.strictEqual(status, 404);
    });

    it('DELETE removes file', async () => {
      const { status, body } = await req('DELETE', `/api/workspaces/${wsId}/files/test.txt`);
      assert.strictEqual(status, 200);
      assert.strictEqual(body.ok, true);
    });
  });

  describe('404 handling', () => {
    it('returns ok:false for unknown routes', async () => {
      const { status, body } = await req('GET', '/api/nowhere');
      assert.strictEqual(status, 404);
      assert.strictEqual(body.ok, false);
    });
  });
});
