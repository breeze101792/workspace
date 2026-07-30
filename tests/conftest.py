import os
import sys
import json
import shutil
import tempfile
import threading
import time
import socket
import urllib.request

import pytest

# Make `backend` package importable when running pytest from project root
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend import safe_fs
from backend.app import app


@pytest.fixture(autouse=True)
def isolated_config_dir(monkeypatch, tmp_path):
    """Redirect the global config dir to a temp directory for every test."""
    monkeypatch.setattr(safe_fs, 'CONFIG_DIR', tmp_path / '.config' / 'workspace')
    monkeypatch.setattr(safe_fs, 'WORKSPACES_DIR', tmp_path / '.config' / 'workspace' / 'workspaces')
    safe_fs.WORKSPACES_DIR.mkdir(parents=True, exist_ok=True)
    yield tmp_path


@pytest.fixture
def client():
    """Flask test client."""
    app.config['TESTING'] = True
    app.config['PROPAGATE_EXCEPTIONS'] = False
    with app.test_client() as c:
        yield c


def _free_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('127.0.0.1', 0))
        return s.getsockname()[1]


@pytest.fixture
def live_server():
    """Start a real Flask server in a background thread on a free port."""
    port = _free_port()

    def _run():
        app.run(host='127.0.0.1', port=port, debug=False, threaded=True, use_reloader=False)

    t = threading.Thread(target=_run, daemon=True)
    t.start()

    # Wait for server to be reachable
    deadline = time.time() + 5
    while time.time() < deadline:
        try:
            urllib.request.urlopen(f'http://127.0.0.1:{port}/', timeout=0.5)
            break
        except Exception:
            time.sleep(0.05)

    yield f'http://127.0.0.1:{port}', port


def http_get(url):
    return json.loads(urllib.request.urlopen(url, timeout=2).read().decode())


def http_post(url, body=None):
    data = json.dumps(body or {}).encode()
    req = urllib.request.Request(url, data=data, method='POST', headers={'Content-Type': 'application/json'})
    return json.loads(urllib.request.urlopen(req, timeout=2).read().decode())


def http_put(url, body=None):
    data = json.dumps(body or {}).encode()
    req = urllib.request.Request(url, data=data, method='PUT', headers={'Content-Type': 'application/json'})
    return json.loads(urllib.request.urlopen(req, timeout=2).read().decode())


def http_delete(url):
    req = urllib.request.Request(url, method='DELETE')
    return json.loads(urllib.request.urlopen(req, timeout=2).read().decode())