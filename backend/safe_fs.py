import json
import uuid
from pathlib import Path
from typing import Any

CONFIG_DIR = Path.home() / '.config' / 'workspace'
WORKSPACES_DIR = CONFIG_DIR / 'workspaces'


def ensure_dirs():
    WORKSPACES_DIR.mkdir(parents=True, exist_ok=True)


def workspace_path(ws_id: str) -> Path:
    return WORKSPACES_DIR / ws_id


def json_path(ws_id: str) -> Path:
    return workspace_path(ws_id) / 'workspace.json'


def atomic_write(path: Path, data: Any):
    tmp = path.with_suffix(f'.tmp.{uuid.uuid4().hex}')
    tmp.write_text(json.dumps(data, indent=2))
    tmp.rename(path)


def atomic_read(path: Path) -> Any:
    return json.loads(path.read_text())
