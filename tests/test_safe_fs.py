from pathlib import Path
from backend import safe_fs


def test_atomic_write_creates_file(tmp_path):
    p = tmp_path / "test.json"
    safe_fs.atomic_write(p, {"hello": "world"})
    assert p.exists()
    assert safe_fs.atomic_read(p) == {"hello": "world"}


def test_atomic_write_overwrites_existing(tmp_path):
    p = tmp_path / "test.json"
    safe_fs.atomic_write(p, {"v": 1})
    safe_fs.atomic_write(p, {"v": 2})
    assert safe_fs.atomic_read(p) == {"v": 2}


def test_atomic_write_no_temp_files_left(tmp_path):
    p = tmp_path / "test.json"
    safe_fs.atomic_write(p, {"v": 1})
    tmp_files = [f for f in tmp_path.iterdir() if f.name.startswith('test.tmp')]
    assert tmp_files == []


def test_atomic_write_handles_nested_data(tmp_path):
    p = tmp_path / "test.json"
    data = {"windows": [{"id": "w1"}, {"id": "w2"}], "settings": {"zoom": 1.5}}
    safe_fs.atomic_write(p, data)
    assert safe_fs.atomic_read(p) == data


def test_workspace_path_under_workspaces_dir():
    p = safe_fs.workspace_path("ws_abc123")
    assert p.name == "ws_abc123"
    assert p.parent == safe_fs.WORKSPACES_DIR


def test_json_path_is_inside_workspace_path():
    p = safe_fs.json_path("ws_abc123")
    assert p.name == "workspace.json"
    assert p.parent == safe_fs.workspace_path("ws_abc123")


def test_ensure_dirs_creates_workspaces_dir(tmp_path):
    target = tmp_path / "deep" / "workspace"
    safe_fs.CONFIG_DIR = tmp_path / ".config" / "workspace"
    safe_fs.WORKSPACES_DIR = target / "workspaces"
    safe_fs.ensure_dirs()
    assert target.exists()