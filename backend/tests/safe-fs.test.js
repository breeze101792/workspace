import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  safePath, atomicWrite, readText, writeText, deleteFile, listDir, fileExists, ensureDir
} from '../src/safe-fs.js';

let tmpDir;

before(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'workspace-test-'));
});

after(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('safePath', () => {
  it('resolves a normal path within root', () => {
    const result = safePath(tmpDir, 'foo/bar.txt');
    assert.ok(result.startsWith(tmpDir));
    assert.ok(result.endsWith('foo/bar.txt'));
  });

  it('strips path traversal and returns path within root', () => {
    const result = safePath(tmpDir, '../etc/passwd');
    assert.ok(result.startsWith(tmpDir));
  });

  it('strips deeply nested traversal', () => {
    const result = safePath(tmpDir, 'foo/../../etc/passwd');
    assert.ok(result.startsWith(tmpDir));
  });

  it('allows empty path (resolves to root)', () => {
    const result = safePath(tmpDir, '');
    assert.strictEqual(result, tmpDir);
  });

  it('strips leading ../ sequences', () => {
    const result = safePath(tmpDir, '../../../etc/passwd');
    assert.strictEqual(result, join(tmpDir, 'etc/passwd'));
  });

  it('allows null/undefined path', () => {
    const result = safePath(tmpDir, null);
    assert.strictEqual(result, tmpDir);
  });
});

describe('atomicWrite', () => {
  it('writes a file and can read it back', async () => {
    const fp = join(tmpDir, 'test.txt');
    await atomicWrite(fp, 'hello world');
    assert.ok(existsSync(fp));
    assert.strictEqual(readFileSync(fp, 'utf-8'), 'hello world');
  });

  it('overwrites existing file atomically', async () => {
    const fp = join(tmpDir, 'overwrite.txt');
    await atomicWrite(fp, 'first');
    await atomicWrite(fp, 'second');
    assert.strictEqual(readFileSync(fp, 'utf-8'), 'second');
  });

  it('creates parent directories', async () => {
    const fp = join(tmpDir, 'a', 'b', 'c', 'deep.txt');
    await atomicWrite(fp, 'deep');
    assert.ok(existsSync(fp));
    assert.strictEqual(readFileSync(fp, 'utf-8'), 'deep');
  });
});

describe('readText / writeText', () => {
  it('round-trips text content', async () => {
    const fp = join(tmpDir, 'roundtrip.txt');
    await writeText(fp, 'some content');
    const content = await readText(fp);
    assert.strictEqual(content, 'some content');
  });

  it('throws on non-existent file', async () => {
    await assert.rejects(() => readText(join(tmpDir, 'nope.txt')));
  });
});

describe('deleteFile', () => {
  it('deletes an existing file', async () => {
    const fp = join(tmpDir, 'todelete.txt');
    await writeText(fp, 'delete me');
    assert.ok(existsSync(fp));
    await deleteFile(fp);
    assert.ok(!existsSync(fp));
  });
});

describe('listDir', () => {
  it('returns empty for non-existent directory', async () => {
    const entries = await listDir(join(tmpDir, 'nonexistent'));
    assert.deepStrictEqual(entries, []);
  });

  it('lists files and directories sorted', async () => {
    const subDir = join(tmpDir, 'listsort');
    await writeText(join(subDir, 'b.txt'), 'b');
    await writeText(join(subDir, 'a.txt'), 'a');
    await ensureDir(join(subDir, 'subdir', 'dummy'));

    const entries = await listDir(subDir);
    const names = entries.map(e => e.name);
    assert.deepStrictEqual(names, ['subdir', 'a.txt', 'b.txt']);
  });
});

describe('fileExists', () => {
  it('returns true for existing file', async () => {
    const fp = join(tmpDir, 'exists.txt');
    await writeText(fp, 'hi');
    assert.ok(await fileExists(fp));
  });

  it('returns false for missing file', async () => {
    assert.ok(!(await fileExists(join(tmpDir, 'missing.txt'))));
  });
});

describe('ensureDir', () => {
  it('creates nested directories', async () => {
    const fp = join(tmpDir, 'x', 'y', 'z', 'file.txt');
    await ensureDir(fp);
    assert.ok(existsSync(join(tmpDir, 'x', 'y', 'z')));
  });
});
