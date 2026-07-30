import os
import sys
import json
import uuid
from pathlib import Path

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from flask_sock import Sock

from .safe_fs import ensure_dirs
from . import workspace_manager as wm
from . import file_manager as fm

app = Flask(__name__, static_folder=None)
CORS(app)
sock = Sock(app)

FRONTEND_DIR = Path(__file__).resolve().parent.parent / 'frontend'

# WebSocket state
ws_connected = {}
ws_rooms = {}
ws_seq = {}


def _next_seq(room):
    ws_seq[room] = ws_seq.get(room, 0) + 1
    return ws_seq[room]


def _broadcast(room, msg, exclude_sid=None):
    msg['workspace'] = room
    msg['seq'] = _next_seq(room)
    raw = json.dumps(msg)
    for sid, (ws, ws_id) in list(ws_connected.items()):
        if sid != exclude_sid and ws_id == room:
            try:
                ws.send(raw)
            except:
                pass


# --- Static frontend ---

@app.route('/')
def index():
    return send_file(str(FRONTEND_DIR / 'index.html'))


@app.route('/js/<path:path>')
def serve_js(path):
    return send_file(str(FRONTEND_DIR / 'js' / path))


@app.route('/css/<path:path>')
def serve_css(path):
    return send_file(str(FRONTEND_DIR / 'css' / path))


# --- WebSocket ---

@sock.route('/ws')
def ws(ws):
    ws_id = request.args.get('workspace', '')
    sid = id(ws)

    ws_connected[sid] = (ws, ws_id)
    ws_rooms.setdefault(ws_id, set()).add(sid)

    ws_state = wm.get_workspace(ws_id)
    if ws_state:
        ws.send(json.dumps({
            'type': 'state:sync',
            'workspace': ws_id,
            'seq': _next_seq(ws_id),
            'data': ws_state
        }))

    while True:
        raw = ws.receive()
        if raw is None:
            break  # pragma: no cover
        msg = json.loads(raw)
        type_ = msg.get('type', '')
        data = msg.get('data', {})

        if type_ == 'connect':
            continue

        ws_state = wm.get_workspace(ws_id)
        if not ws_state:
            continue

        if type_ == 'window:move':
            for w in ws_state['windows']:
                if w['id'] == data.get('id'):
                    w['x'] = data['x']
                    w['y'] = data['y']
                    break
            wm.update_workspace(ws_id, {'windows': ws_state['windows']})
            _broadcast(ws_id, {'type': 'window:moved', 'data': {'id': data['id'], 'x': data['x'], 'y': data['y']}}, sid)

        elif type_ == 'window:resize':
            for w in ws_state['windows']:
                if w['id'] == data.get('id'):
                    w['width'] = data['width']
                    w['height'] = data['height']
                    break
            wm.update_workspace(ws_id, {'windows': ws_state['windows']})
            _broadcast(ws_id, {'type': 'window:resized', 'data': {'id': data['id'], 'width': data['width'], 'height': data['height']}}, sid)

        elif type_ == 'window:focus':
            max_z = max((w['zIndex'] for w in ws_state['windows']), default=0)
            for w in ws_state['windows']:
                if w['id'] == data.get('id'):
                    w['zIndex'] = max_z + 1
                    break
            wm.update_workspace(ws_id, {'windows': ws_state['windows']})
            _broadcast(ws_id, {'type': 'window:focused', 'data': {'id': data['id']}}, sid)

        elif type_ == 'window:minimize':
            minimized = data.get('minimized', True)
            for w in ws_state['windows']:
                if w['id'] == data.get('id'):
                    w['minimized'] = minimized
                    break
            wm.update_workspace(ws_id, {'windows': ws_state['windows']})
            _broadcast(ws_id, {'type': 'window:minimized', 'data': {'id': data['id'], 'minimized': minimized}}, sid)

        elif type_ == 'window:maximize':
            maximized = data.get('maximized', True)
            for w in ws_state['windows']:
                if w['id'] == data.get('id'):
                    w['maximized'] = maximized
                    break
            wm.update_workspace(ws_id, {'windows': ws_state['windows']})
            _broadcast(ws_id, {'type': 'window:maximized', 'data': {'id': data['id'], 'maximized': maximized}}, sid)

        elif type_ == 'window:close':
            ws_state['windows'] = [w for w in ws_state['windows'] if w['id'] != data.get('id')]
            wm.update_workspace(ws_id, {'windows': ws_state['windows']})
            _broadcast(ws_id, {'type': 'window:removed', 'data': {'id': data['id']}}, sid)

        elif type_ == 'window:open':
            max_z = max((w['zIndex'] for w in ws_state['windows']), default=0)
            new_window = {
                "id": data.get('id', 'wnd_' + uuid.uuid4().hex[:8]),
                "type": data.get('type', 'text'),
                "title": data.get('title', 'New Window'),
                "x": data.get('x', 100),
                "y": data.get('y', 100),
                "width": data.get('width', 600),
                "height": data.get('height', 400),
                "zIndex": max_z + 1,
                "minimized": False,
                "maximized": False,
                "file": data.get('file', None),
                "filePath": data.get('file', None),
                "metadata": {},
            }
            ws_state['windows'].append(new_window)
            wm.update_workspace(ws_id, {'windows': ws_state['windows']})
            _broadcast(ws_id, {'type': 'window:added', 'data': new_window}, sid)

        elif type_ == 'workspace:updateSettings':
            settings = ws_state.get('settings', {})
            settings.update(data)
            wm.update_workspace(ws_id, {'settings': settings})
            _broadcast(ws_id, {'type': 'workspace:updated', 'data': settings}, sid)

    # Cleanup on disconnect
    if sid in ws_connected:  # pragma: no cover
        old_ws_id = ws_connected[sid][1]
        if old_ws_id in ws_rooms:
            ws_rooms[old_ws_id].discard(sid)
        del ws_connected[sid]


# --- Workspace API ---

@app.route('/api/workspaces', methods=['GET'])
def api_list_workspaces():
    return jsonify({'ok': True, 'data': wm.list_workspaces()})


@app.route('/api/workspaces', methods=['POST'])
def api_create_workspace():
    data = request.get_json(silent=True) or {}
    name = data.get('name', '').strip()
    if not name:
        return jsonify({'ok': False, 'error': 'Name is required'}), 400
    if len(name) > 200:
        return jsonify({'ok': False, 'error': 'Name too long'}), 400
    ws = wm.create_workspace(name)
    return jsonify({'ok': True, 'data': {'id': ws['id'], 'name': ws['name'], 'path': str(Path.home() / '.config' / 'workspace' / 'workspaces' / ws['id'])}}), 201


@app.route('/api/workspaces/<ws_id>', methods=['GET'])
def api_get_workspace(ws_id):
    ws = wm.get_workspace(ws_id)
    if not ws:
        return jsonify({'ok': False, 'error': 'Workspace not found'}), 404
    return jsonify({'ok': True, 'data': ws})


@app.route('/api/workspaces/<ws_id>', methods=['PUT'])
def api_update_workspace(ws_id):
    data = request.get_json(silent=True) or {}
    ws = wm.update_workspace(ws_id, data)
    if not ws:
        return jsonify({'ok': False, 'error': 'Workspace not found'}), 404
    return jsonify({'ok': True, 'data': {'updatedAt': ws.get('updatedAt', '')}})


@app.route('/api/workspaces/<ws_id>', methods=['DELETE'])
def api_delete_workspace(ws_id):
    ok = wm.delete_workspace(ws_id)
    if not ok:
        return jsonify({'ok': False, 'error': 'Workspace not found'}), 404
    return jsonify({'ok': True, 'data': {'deleted': True}})


# --- File API ---

@app.route('/api/workspaces/<ws_id>/files', methods=['GET'])
def api_list_files(ws_id):
    directory = request.args.get('dir', '')
    result = fm.list_files(ws_id, directory)
    if not result:
        return jsonify({'ok': False, 'error': 'Directory not found'}), 404
    return jsonify({'ok': True, 'data': result})


@app.route('/api/workspaces/<ws_id>/files/<path:file_path>', methods=['GET'])
def api_read_file(ws_id, file_path):
    force_text = request.args.get('type') == 'text'
    result = fm.read_file(ws_id, file_path, force_text)
    if not result:
        return jsonify({'ok': False, 'error': 'File not found'}), 404
    if result.get('binary'):
        return send_file(result['content'], mimetype=result['mime'])
    return jsonify({'ok': True, 'data': {'content': result['content'], 'mime': result['mime']}})


@app.route('/api/workspaces/<ws_id>/files/<path:file_path>', methods=['PUT'])
def api_write_file(ws_id, file_path):
    data = request.get_json(silent=True) or {}
    content = data.get('content', '')
    result = fm.write_file(ws_id, file_path, content)
    if not result:
        return jsonify({'ok': False, 'error': 'Invalid path'}), 422
    _broadcast(ws_id, {'type': 'file:changed', 'data': {'path': file_path, 'action': 'write'}})
    return jsonify({'ok': True, 'data': result})


@app.route('/api/workspaces/<ws_id>/files/<path:file_path>', methods=['DELETE'])
def api_delete_file(ws_id, file_path):
    ok = fm.delete_file(ws_id, file_path)
    if not ok:
        return jsonify({'ok': False, 'error': 'File not found'}), 404
    _broadcast(ws_id, {'type': 'file:changed', 'data': {'path': file_path, 'action': 'delete'}})
    return jsonify({'ok': True, 'data': {'deleted': True}})


@app.route('/api/workspaces/<ws_id>/upload', methods=['POST'])
def api_upload(ws_id):
    if 'file' not in request.files:
        return jsonify({'ok': False, 'error': 'No file provided'}), 400
    file = request.files['file']
    subdir = request.form.get('path', 'files')
    result = fm.save_upload(ws_id, file.filename, file.read(), subdir)
    _broadcast(ws_id, {'type': 'file:changed', 'data': {'path': result['path'], 'action': 'write'}})
    return jsonify({'ok': True, 'data': result}), 201


# --- Error handler ---

@app.errorhandler(404)
def not_found(e):
    return jsonify({'ok': False, 'error': 'Not found'}), 404


@app.errorhandler(500)
def server_error(e):
    return jsonify({'ok': False, 'error': 'Internal server error'}), 500


# --- Main ---

def main():
    ensure_dirs()
    port = int(os.environ.get('PORT', 5010))
    host = os.environ.get('HOST', '0.0.0.0')
    debug = os.environ.get('DEBUG', '1') == '1'
    print(f'Server starting on {host}:{port}')
    app.run(host=host, port=port, debug=debug, threaded=True)


if __name__ == '__main__':
    main()