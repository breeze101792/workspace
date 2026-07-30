"""Session-based authentication with optional opt-in via WORKSPACE_AUTH env var.

When enabled (or when there's at least one user), API routes require a valid session
token. Sessions are stored in memory and lost on restart.
"""
import hashlib
import hmac
import json
import os
import secrets
import time
from pathlib import Path

from . import safe_fs


_users = {}
_sessions = {}
_auth_required = False


def _user_path() -> 'Path':
    return safe_fs.CONFIG_DIR / 'users.json'


def _load_users():
    global _users, _auth_required
    path = _user_path()
    if not path.exists():
        _users = {}
        _auth_required = bool(os.environ.get('WORKSPACE_AUTH'))
        return
    try:
        _users = json.loads(path.read_text())
    except Exception:
        _users = {}
    _auth_required = bool(_users) or bool(os.environ.get('WORKSPACE_AUTH'))


def _save_users():
    path = _user_path()
    safe_fs.CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(_users, indent=2))


def _hash_password(password: str, salt: str) -> str:
    return hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000).hex()


def is_required() -> bool:
    if not _users and not _auth_required:
        return False
    return True


def create_user(username: str, password: str) -> dict:
    """Create a new user. Returns error if already exists."""
    if username in _users:
        raise ValueError(f'User {username} already exists')
    salt = secrets.token_hex(16)
    _users[username] = {
        'salt': salt,
        'password': _hash_password(password, salt),
        'createdAt': time.time(),
    }
    _save_users()
    return {'username': username}


def authenticate(username: str, password: str) -> str | None:
    """Verify credentials, return session token on success or None on failure."""
    user = _users.get(username)
    if not user:
        return None
    expected = _hash_password(password, user['salt'])
    if not hmac.compare_digest(expected, user['password']):
        return None
    token = secrets.token_urlsafe(32)
    _sessions[token] = {'username': username, 'createdAt': time.time()}
    return token


def verify_token(token: str) -> str | None:
    """Return username if token is valid, else None."""
    session = _sessions.get(token)
    if not session:
        return None
    return session['username']


def logout(token: str) -> bool:
    return _sessions.pop(token, None) is not None


def list_users() -> list[str]:
    return list(_users.keys())


def delete_user(username: str) -> bool:
    if username not in _users:
        return False
    del _users[username]
    _save_users()
    # Invalidate any sessions
    to_remove = [t for t, s in _sessions.items() if s['username'] == username]
    for t in to_remove:
        del _sessions[t]
    return True


# Initialize on import
_load_users()