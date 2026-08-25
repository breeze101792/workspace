import os
import mimetypes
from datetime import datetime, timezone
from pathlib import Path
from . import safe_fs

TEXT_EXTENSIONS = {'.md', '.txt', '.html', '.htm', '.json', '.css', '.js', '.py', '.xml', '.yaml', '.yml', '.ini', '.cfg', '.log', '.sh', '.bat'}

TEXT_MIME_MAP = {
    '.md': 'text/markdown',
    '.txt': 'text/plain',
    '.html': 'text/html',
    '.htm': 'text/html',
    '.json': 'application/json',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.py': 'text/x-python',
}


def _resolve_path(ws_id: str, user_path: str) -> Path | None:
    root = safe_fs.workspace_path(ws_id).resolve()
    resolved = (root / user_path).resolve()
    try:
        resolved.relative_to(root)
    except ValueError:
        return None
    return resolved


def read_file(ws_id: str, file_path: str, force_text: bool = False) -> dict | None:
    resolved = _resolve_path(ws_id, file_path)
    if not resolved or not resolved.exists() or not resolved.is_file():
        return None
    ext = resolved.suffix.lower()
    if ext in TEXT_EXTENSIONS or force_text:
        try:
            content = resolved.read_text(encoding='utf-8')
        except UnicodeDecodeError:
            raise ValueError('file is not valid UTF-8 text')
        mime = TEXT_MIME_MAP.get(ext, 'text/plain')
        return {"content": content, "mime": mime, "binary": False}
    else:
        mime = mimetypes.guess_type(str(resolved))[0] or 'application/octet-stream'
        return {"content": str(resolved), "mime": mime, "binary": True}


def write_file(ws_id: str, file_path: str, content: str) -> dict | None:
    resolved = _resolve_path(ws_id, file_path)
    if not resolved:
        return None
    resolved.parent.mkdir(parents=True, exist_ok=True)
    resolved.write_text(content, encoding='utf-8')
    return {"path": file_path, "size": resolved.stat().st_size}


def delete_file(ws_id: str, file_path: str) -> bool:
    resolved = _resolve_path(ws_id, file_path)
    if not resolved or not resolved.exists():
        return False
    if resolved.is_dir():
        try:
            resolved.rmdir()
        except OSError:
            return False
    else:
        resolved.unlink()
    return True


def list_files(ws_id: str, directory: str = '') -> dict | None:
    resolved = _resolve_path(ws_id, directory) if directory else safe_fs.workspace_path(ws_id).resolve()
    if not resolved or not resolved.exists():
        return None
    entries = []
    for entry in sorted(resolved.iterdir()):
        info = {"name": entry.name}
        if entry.is_dir():
            info["type"] = "directory"
        else:
            info["type"] = "file"
            info["size"] = entry.stat().st_size
            mime = mimetypes.guess_type(str(entry))[0] or 'application/octet-stream'
            info["mime"] = mime
            stat = entry.stat()
            info["updatedAt"] = datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat()
        entries.append(info)
    return {"path": directory or '.', "entries": entries}


def save_upload(ws_id: str, filename: str, data: bytes, subdir: str = 'files') -> dict:
    resolved = _resolve_path(ws_id, f'{subdir}/{filename}')
    if not resolved:
        raise ValueError('Invalid path')
    resolved.parent.mkdir(parents=True, exist_ok=True)
    resolved.write_bytes(data)
    mime = mimetypes.guess_type(str(resolved))[0] or 'application/octet-stream'
    return {"path": f'{subdir}/{filename}', "size": len(data), "mime": mime}


def search_files(ws_id: str, query: str, directory: str = '') -> list[dict]:
    """Full-text search across text files in the workspace.

    Returns a list of matches with: path, line_number, line, context.
    """
    if not query:
        return []
    resolved = _resolve_path(ws_id, directory) if directory else safe_fs.workspace_path(ws_id).resolve()
    if not resolved or not resolved.exists():
        return []
    results = []
    query_lower = query.lower()
    for entry in sorted(resolved.rglob('*')):
        if not entry.is_file() or entry.name.startswith('.'):
            continue
        if entry.suffix.lower() not in TEXT_EXTENSIONS:
            continue
        try:
            content = entry.read_text(encoding='utf-8', errors='ignore')
        except Exception:
            continue
        rel = entry.relative_to(safe_fs.workspace_path(ws_id)).as_posix()
        for i, line in enumerate(content.splitlines(), 1):
            if query_lower in line.lower():
                results.append({
                    'path': rel,
                    'line': i,
                    'text': line.strip()[:200],
                })
                if len(results) >= 500:
                    return results
    return results
