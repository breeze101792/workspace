import json
import time
import threading
import socket
import urllib.request
import pytest
import websocket


def _free_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('127.0.0.1', 0))
        return s.getsockname()[1]


def _wait_for_server(port, timeout=5):
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            urllib.request.urlopen(f'http://127.0.0.1:{port}/', timeout=0.3)
            return True
        except Exception:
            time.sleep(0.05)
    return False


@pytest.fixture
def server_with_ws():
    from backend.app import app
    from backend import workspace_manager as wm

    port = _free_port()
    t = threading.Thread(
        target=lambda: app.run(host='127.0.0.1', port=port, debug=False, threaded=True, use_reloader=False),
        daemon=True,
    )
    t.start()
    assert _wait_for_server(port), "Server failed to start"

    ws_id = wm.create_workspace("WS Test")['id']
    yield f'ws://127.0.0.1:{port}/ws?workspace={ws_id}', ws_id, port


def _http_post(port, path, body=None):
    req = urllib.request.Request(
        f'http://127.0.0.1:{port}{path}',
        data=json.dumps(body or {}).encode(),
        method='POST',
        headers={'Content-Type': 'application/json'},
    )
    return json.loads(urllib.request.urlopen(req, timeout=2).read().decode())


def _http_put(port, path, body=None):
    req = urllib.request.Request(
        f'http://127.0.0.1:{port}{path}',
        data=json.dumps(body or {}).encode(),
        method='PUT',
        headers={'Content-Type': 'application/json'},
    )
    return json.loads(urllib.request.urlopen(req, timeout=2).read().decode())


def test_state_sync_sent_on_connect(server_with_ws):
    ws_url, ws_id, _ = server_with_ws
    ws = websocket.create_connection(ws_url, timeout=5)
    try:
        msg = json.loads(ws.recv())
        assert msg['type'] == 'state:sync'
        assert msg['workspace'] == ws_id
        assert 'seq' in msg
        assert isinstance(msg['seq'], int)
        assert msg['data']['id'] == ws_id
    finally:
        ws.close()


def test_seq_increments_on_each_broadcast(server_with_ws):
    ws_url, ws_id, _ = server_with_ws
    ws1 = websocket.create_connection(ws_url, timeout=5)
    ws2 = websocket.create_connection(ws_url, timeout=5)
    initial = json.loads(ws1.recv())
    ws2.recv()  # consume ws2's state:sync
    initial_seq = initial['seq']

    ws1.send(json.dumps({"type": "window:move", "data": {"id": "wnd_explorer001", "x": 10, "y": 20}}))
    moved = json.loads(ws2.recv())  # ws2 receives the broadcast (ws1 is sender)
    assert moved['type'] == 'window:moved'
    assert moved['workspace'] == ws_id
    assert moved['seq'] > initial_seq
    ws1.close()
    ws2.close()


def test_window_move_broadcasts_to_other_clients(server_with_ws):
    ws_url, ws_id, _ = server_with_ws
    ws1 = websocket.create_connection(ws_url, timeout=5)
    ws2 = websocket.create_connection(ws_url, timeout=5)
    ws1.recv()  # state:sync for ws1
    ws2.recv()  # state:sync for ws2

    ws1.send(json.dumps({"type": "window:move", "data": {"id": "wnd_explorer001", "x": 333, "y": 444}}))
    msg = json.loads(ws2.recv())
    assert msg['type'] == 'window:moved'
    assert msg['data']['x'] == 333
    assert msg['data']['y'] == 444

    ws1.close()
    ws2.close()


def test_window_resize_broadcasts(server_with_ws):
    ws_url, ws_id, _ = server_with_ws
    ws1 = websocket.create_connection(ws_url, timeout=5)
    ws2 = websocket.create_connection(ws_url, timeout=5)
    ws1.recv()
    ws2.recv()

    ws1.send(json.dumps({"type": "window:resize", "data": {"id": "wnd_explorer001", "width": 700, "height": 500}}))
    msg = json.loads(ws2.recv())
    assert msg['type'] == 'window:resized'
    assert msg['data']['width'] == 700
    assert msg['data']['height'] == 500

    ws1.close()
    ws2.close()


def test_window_focus_broadcasts(server_with_ws):
    ws_url, ws_id, _ = server_with_ws
    ws1 = websocket.create_connection(ws_url, timeout=5)
    ws2 = websocket.create_connection(ws_url, timeout=5)
    ws1.recv()
    ws2.recv()

    ws1.send(json.dumps({"type": "window:focus", "data": {"id": "wnd_explorer001"}}))
    msg = json.loads(ws2.recv())
    assert msg['type'] == 'window:focused'
    assert msg['data']['id'] == 'wnd_explorer001'

    ws1.close()
    ws2.close()


def test_window_minimize_broadcasts(server_with_ws):
    ws_url, ws_id, _ = server_with_ws
    ws1 = websocket.create_connection(ws_url, timeout=5)
    ws2 = websocket.create_connection(ws_url, timeout=5)
    ws1.recv()
    ws2.recv()

    ws1.send(json.dumps({"type": "window:minimize", "data": {"id": "wnd_explorer001", "minimized": True}}))
    msg = json.loads(ws2.recv())
    assert msg['type'] == 'window:minimized'
    assert msg['data']['minimized'] is True

    ws1.close()
    ws2.close()


def test_window_maximize_broadcasts(server_with_ws):
    ws_url, ws_id, _ = server_with_ws
    ws1 = websocket.create_connection(ws_url, timeout=5)
    ws2 = websocket.create_connection(ws_url, timeout=5)
    ws1.recv()
    ws2.recv()

    ws1.send(json.dumps({"type": "window:maximize", "data": {"id": "wnd_explorer001", "maximized": True}}))
    msg = json.loads(ws2.recv())
    assert msg['type'] == 'window:maximized'
    assert msg['data']['maximized'] is True

    ws1.close()
    ws2.close()


def test_window_open_broadcasts_added(server_with_ws):
    ws_url, ws_id, _ = server_with_ws
    ws1 = websocket.create_connection(ws_url, timeout=5)
    ws2 = websocket.create_connection(ws_url, timeout=5)
    ws1.recv()
    ws2.recv()

    ws1.send(json.dumps({"type": "window:open", "data": {"type": "markdown", "title": "New", "x": 100, "y": 100}}))
    msg = json.loads(ws2.recv())
    assert msg['type'] == 'window:added'
    assert msg['data']['type'] == 'markdown'
    assert msg['data']['title'] == 'New'
    assert 'id' in msg['data']

    ws1.close()
    ws2.close()


def test_window_close_broadcasts_removed(server_with_ws):
    ws_url, ws_id, _ = server_with_ws
    ws1 = websocket.create_connection(ws_url, timeout=5)
    ws2 = websocket.create_connection(ws_url, timeout=5)
    ws1.recv()
    ws2.recv()

    ws1.send(json.dumps({"type": "window:close", "data": {"id": "wnd_explorer001"}}))
    msg = json.loads(ws2.recv())
    assert msg['type'] == 'window:removed'
    assert msg['data']['id'] == 'wnd_explorer001'

    ws1.close()
    ws2.close()


def test_settings_update_broadcasts(server_with_ws):
    ws_url, ws_id, _ = server_with_ws
    ws1 = websocket.create_connection(ws_url, timeout=5)
    ws2 = websocket.create_connection(ws_url, timeout=5)
    ws1.recv()
    ws2.recv()

    ws1.send(json.dumps({"type": "workspace:updateSettings", "data": {"zoom": 2.0, "viewportX": 50, "viewportY": 75}}))
    msg = json.loads(ws2.recv())
    assert msg['type'] == 'workspace:updated'
    assert msg['data']['zoom'] == 2.0
    assert msg['data']['viewportX'] == 50

    ws1.close()
    ws2.close()


def test_file_write_broadcasts_file_changed(server_with_ws):
    ws_url, ws_id, port = server_with_ws
    ws1 = websocket.create_connection(ws_url, timeout=5)
    ws2 = websocket.create_connection(ws_url, timeout=5)
    ws1.recv()
    ws2.recv()

    _http_put(port, f'/api/workspaces/{ws_id}/files/markdown/test.md', {'content': 'hello'})

    msg = json.loads(ws2.recv())
    assert msg['type'] == 'file:changed'
    assert msg['data']['path'] == 'markdown/test.md'
    assert msg['data']['action'] == 'write'

    ws1.close()
    ws2.close()


def test_file_delete_broadcasts_file_changed(server_with_ws):
    ws_url, ws_id, port = server_with_ws
    _http_put(port, f'/api/workspaces/{ws_id}/files/markdown/test.md', {'content': 'x'})

    ws1 = websocket.create_connection(ws_url, timeout=5)
    ws2 = websocket.create_connection(ws_url, timeout=5)
    ws1.recv()
    ws2.recv()

    req = urllib.request.Request(
        f'http://127.0.0.1:{port}/api/workspaces/{ws_id}/files/markdown/test.md',
        method='DELETE',
    )
    urllib.request.urlopen(req, timeout=2).read()

    msg = json.loads(ws2.recv())
    assert msg['type'] == 'file:changed'
    assert msg['data']['action'] == 'delete'

    ws1.close()
    ws2.close()


def test_sender_does_not_receive_own_broadcast(server_with_ws):
    """The originating client should not get its own broadcast back."""
    ws_url, ws_id, _ = server_with_ws
    ws1 = websocket.create_connection(ws_url, timeout=5)
    ws1.recv()  # state:sync

    ws1.send(json.dumps({"type": "window:move", "data": {"id": "wnd_explorer001", "x": 1, "y": 2}}))
    ws1.settimeout(0.5)
    with pytest.raises(Exception):
        # Should not get a window:moved echo since we exclude sender
        ws1.recv()
    ws1.close()


def test_message_has_workspace_field(server_with_ws):
    """All broadcast messages must include the workspace field per api-design.md."""
    ws_url, ws_id, _ = server_with_ws
    ws1 = websocket.create_connection(ws_url, timeout=5)
    ws2 = websocket.create_connection(ws_url, timeout=5)
    init = json.loads(ws1.recv())
    assert init['workspace'] == ws_id
    ws2.recv()

    ws1.send(json.dumps({"type": "window:move", "data": {"id": "wnd_explorer001", "x": 5, "y": 5}}))
    msg = json.loads(ws2.recv())
    assert msg['workspace'] == ws_id

    ws1.close()
    ws2.close()


def test_message_has_seq_field(server_with_ws):
    """All broadcast messages must include a seq field per api-design.md."""
    ws_url, ws_id, _ = server_with_ws
    ws1 = websocket.create_connection(ws_url, timeout=5)
    init = json.loads(ws1.recv())
    assert isinstance(init['seq'], int)
    assert init['seq'] >= 1
    ws1.close()