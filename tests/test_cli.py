"""Tests for the CLI tool."""
import os
import subprocess
import sys
import tempfile
import json


def _run_cli(*args, config_dir=None):
    """Run the CLI as a subprocess and return (returncode, stdout, stderr)."""
    cmd = [sys.executable, '/mnt/projects/webapp/workspace/backend/cli.py']
    if config_dir:
        cmd += ['--config-dir', config_dir]
    cmd += list(args)
    env = {**os.environ, 'PYTHONPATH': '/mnt/projects/webapp/workspace'}
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=10, env=env)
    return result.returncode, result.stdout, result.stderr


def test_cli_help():
    rc, stdout, stderr = _run_cli('--help')
    assert rc == 0
    assert 'usage' in stdout.lower() or 'Workspace CLI' in stdout


def test_cli_list_empty(tmp_path):
    rc, stdout, stderr = _run_cli('list', config_dir=str(tmp_path))
    assert rc == 0
    assert 'No workspaces' in stdout


def test_cli_create(tmp_path):
    rc, stdout, stderr = _run_cli('create', 'Test WS', config_dir=str(tmp_path))
    assert rc == 0
    ws_id = stdout.strip()
    assert ws_id.startswith('ws_')


def test_cli_show_json(tmp_path):
    rc, stdout, _ = _run_cli('create', 'Test WS', config_dir=str(tmp_path))
    ws_id = stdout.strip()
    rc, stdout, _ = _run_cli('show', ws_id, '--json', config_dir=str(tmp_path))
    assert rc == 0
    data = json.loads(stdout)
    assert data['id'] == ws_id
    assert data['name'] == 'Test WS'


def test_cli_show_text(tmp_path):
    rc, stdout, _ = _run_cli('create', 'My Name', config_dir=str(tmp_path))
    ws_id = stdout.strip()
    rc, stdout, _ = _run_cli('show', ws_id, config_dir=str(tmp_path))
    assert rc == 0
    assert 'id:' in stdout
    assert 'name: My Name' in stdout


def test_cli_show_not_found(tmp_path):
    rc, stdout, stderr = _run_cli('show', 'ws_nope', config_dir=str(tmp_path))
    assert rc == 1


def test_cli_delete(tmp_path):
    rc, stdout, _ = _run_cli('create', 'ToDelete', config_dir=str(tmp_path))
    ws_id = stdout.strip()
    rc, stdout, _ = _run_cli('delete', ws_id, config_dir=str(tmp_path))
    assert rc == 0
    rc, stdout, _ = _run_cli('show', ws_id, config_dir=str(tmp_path))
    assert rc != 0


def test_cli_delete_not_found(tmp_path):
    rc, _, _ = _run_cli('delete', 'ws_nope', config_dir=str(tmp_path))
    assert rc == 1


def test_cli_export_import(tmp_path):
    rc, stdout, _ = _run_cli('create', 'Export Test', config_dir=str(tmp_path))
    ws_id = stdout.strip()

    zip_path = str(tmp_path / 'exported.zip')
    rc, _, _ = _run_cli('export', ws_id, zip_path, config_dir=str(tmp_path))
    assert rc == 0
    assert os.path.exists(zip_path)

    rc, stdout, _ = _run_cli('import', zip_path, '--name', 'Imported', config_dir=str(tmp_path))
    assert rc == 0


def test_cli_export_not_found(tmp_path):
    rc, _, _ = _run_cli('export', 'ws_nope', config_dir=str(tmp_path))
    assert rc == 1


def test_cli_search(tmp_path):
    rc, stdout, _ = _run_cli('create', 'Search Test', config_dir=str(tmp_path))
    ws_id = stdout.strip()
    config_dir = tmp_path / 'workspaces' / ws_id
    config_dir.mkdir(parents=True, exist_ok=True)
    (config_dir / 'markdown').mkdir(exist_ok=True)
    (config_dir / 'markdown' / 'note.md').write_text('hello world\nfoo bar')

    rc, stdout, _ = _run_cli('search', ws_id, 'hello', config_dir=str(tmp_path))
    assert rc == 0
    assert 'hello' in stdout


def test_cli_search_json(tmp_path):
    rc, stdout, _ = _run_cli('create', 'Search Test', config_dir=str(tmp_path))
    ws_id = stdout.strip()
    config_dir = tmp_path / 'workspaces' / ws_id
    config_dir.mkdir(parents=True, exist_ok=True)
    (config_dir / 'markdown').mkdir(exist_ok=True)
    (config_dir / 'markdown' / 'note.md').write_text('needle here')

    rc, stdout, _ = _run_cli('search', ws_id, 'needle', '--json', config_dir=str(tmp_path))
    assert rc == 0
    data = json.loads(stdout)
    assert len(data) >= 1


def test_cli_read(tmp_path):
    rc, stdout, _ = _run_cli('create', 'Read Test', config_dir=str(tmp_path))
    ws_id = stdout.strip()
    config_dir = tmp_path / 'workspaces' / ws_id
    config_dir.mkdir(parents=True, exist_ok=True)
    (config_dir / 'markdown').mkdir(exist_ok=True)
    (config_dir / 'markdown' / 'note.md').write_text('content here')

    rc, stdout, _ = _run_cli('read', ws_id, 'markdown/note.md', config_dir=str(tmp_path))
    assert rc == 0
    assert 'content here' in stdout


def test_cli_read_not_found(tmp_path):
    rc, stdout, _ = _run_cli('create', 'Read Test', config_dir=str(tmp_path))
    ws_id = stdout.strip()
    rc, _, _ = _run_cli('read', ws_id, 'markdown/missing.md', config_dir=str(tmp_path))
    assert rc == 1