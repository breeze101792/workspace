import uuid
import shutil
from datetime import datetime, timezone
from . import safe_fs

DEFAULT_WINDOWS = [
    {
        "id": "wnd_explorer001",
        "type": "explorer",
        "title": "File Explorer",
        "x": 60, "y": 60, "width": 400, "height": 420,
        "zIndex": 2, "minimized": False, "maximized": False,
        "file": None, "filePath": None, "metadata": {}
    },
    {
        "id": "wnd_demo001",
        "type": "html",
        "title": "Welcome",
        "x": 500, "y": 120, "width": 560, "height": 380,
        "zIndex": 1, "minimized": False, "maximized": False,
        "file": "html/welcome.html", "filePath": "html/welcome.html",
        "metadata": {}
    },
]


def create_workspace(name: str) -> dict:
    safe_fs.ensure_dirs()
    ws_id = 'ws_' + uuid.uuid4().hex[:8]
    ws_dir = safe_fs.workspace_path(ws_id)
    ws_dir.mkdir(parents=True, exist_ok=True)

    for sub in ('markdown', 'html', 'images', 'files', 'cache'):
        (ws_dir / sub).mkdir(exist_ok=True)

    welcome_html = '<!DOCTYPE html>\n<html>\n<head><title>Welcome</title></head>\n<body>\n  <h1>Welcome</h1>\n  <p>AI-native workspace ready.</p>\n</body>\n</html>\n'
    (ws_dir / 'html' / 'welcome.html').write_text(welcome_html)

    now = datetime.now(timezone.utc).isoformat()
    workspace = {
        "id": ws_id,
        "name": name,
        "createdAt": now,
        "updatedAt": now,
        "windows": DEFAULT_WINDOWS,
        "settings": {
            "zoom": 1.0,
            "viewportX": 0,
            "viewportY": 0,
        },
    }

    safe_fs.atomic_write(safe_fs.json_path(ws_id), workspace)
    return workspace


def get_workspace(ws_id: str) -> dict | None:
    path = safe_fs.json_path(ws_id)
    if not path.exists():
        return None
    return safe_fs.atomic_read(path)


def list_workspaces() -> list[dict]:
    safe_fs.ensure_dirs()
    workspaces = []
    for d in sorted(safe_fs.WORKSPACES_DIR.iterdir()):
        if d.is_dir():
            ws = get_workspace(d.name)
            if ws:
                workspaces.append({
                    "id": ws["id"],
                    "name": ws["name"],
                    "updatedAt": ws.get("updatedAt", ""),
                })
    return workspaces


def update_workspace(ws_id: str, data: dict) -> dict | None:
    ws = get_workspace(ws_id)
    if not ws:
        return None
    ws.update(data)
    ws["updatedAt"] = datetime.now(timezone.utc).isoformat()
    safe_fs.atomic_write(safe_fs.json_path(ws_id), ws)
    return ws


def delete_workspace(ws_id: str) -> bool:
    path = safe_fs.workspace_path(ws_id)
    if not path.exists():
        return False
    shutil.rmtree(path)
    return True
