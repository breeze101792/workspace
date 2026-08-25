import os
import sys
import json
import io
import uuid
from pathlib import Path

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from flask_sock import Sock

from .safe_fs import ensure_dirs
from . import workspace_manager as wm
from . import file_manager as fm
from . import config_manager as cm
from . import plugin_loader
from . import auth

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


def _file_watching_enabled(ws_id) -> bool:
    ws = wm.get_workspace(ws_id)
    if not ws:
        return True
    return bool(ws.get('settings', {}).get('watchFiles', True))


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

def _serve_static(path):
    """Serve static files with revalidation so UI updates land immediately."""
    resp = send_file(path)
    resp.headers['Cache-Control'] = 'no-cache'
    return resp


@app.route('/')
def index():
    return _serve_static(str(FRONTEND_DIR / 'index.html'))


@app.route('/js/<path:path>')
def serve_js(path):
    return _serve_static(str(FRONTEND_DIR / 'js' / path))


@app.route('/css/<path:path>')
def serve_css(path):
    return _serve_static(str(FRONTEND_DIR / 'css' / path))


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

    try:
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

            elif type_ == 'window:rename':
                for w in ws_state['windows']:
                    if w['id'] == data.get('id'):
                        if data.get('title'):
                            w['title'] = data['title']
                        if data.get('file'):
                            w['file'] = data['file']
                            w['filePath'] = data['file']
                        break
                wm.update_workspace(ws_id, {'windows': ws_state['windows']})
                _broadcast(ws_id, {'type': 'window:renamed', 'data': {'id': data['id'], 'title': data.get('title'), 'file': data.get('file')}}, sid)

            elif type_ == 'workspace:updateSettings':
                settings = ws_state.get('settings', {})
                settings.update(data)
                wm.update_workspace(ws_id, {'settings': settings})
                _broadcast(ws_id, {'type': 'workspace:updated', 'data': settings}, sid)

    finally:
        # Cleanup on disconnect
        if sid in ws_connected:
            old_ws_id = ws_connected[sid][1]
            if old_ws_id in ws_rooms:
                ws_rooms[old_ws_id].discard(sid)
            del ws_connected[sid]


# --- Workspace API ---

@app.route('/api/config', methods=['GET'])
def api_get_config():
    return jsonify({'ok': True, 'data': cm.read_config()})


@app.route('/api/config', methods=['PUT'])
def api_update_config():
    data = request.get_json(silent=True) or {}
    allowed = {'activeWorkspace', 'theme', 'language'}
    update = {k: v for k, v in data.items() if k in allowed}
    if 'activeWorkspace' in update:
        cm.set_active_workspace(update['activeWorkspace'])
    if 'theme' in update or 'language' in update:
        cfg = cm.read_config()
        if 'theme' in update:
            cfg['theme'] = update['theme']
        if 'language' in update:
            cfg['language'] = update['language']
        cm.write_config(cfg)
    return jsonify({'ok': True, 'data': cm.read_config()})


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
    expected_version = request.headers.get('If-Match')
    if expected_version is not None:
        current = wm.get_workspace(ws_id)
        if current and str(current.get('version', 0)) != str(expected_version):
            return jsonify({
                'ok': False,
                'error': 'Version conflict',
                'current': current,
                'expected': expected_version,
            }), 409
    ws = wm.update_workspace(ws_id, data)
    if not ws:
        return jsonify({'ok': False, 'error': 'Workspace not found'}), 404
    _broadcast(ws_id, {'type': 'workspace:updated', 'data': ws})
    return jsonify({'ok': True, 'data': {'updatedAt': ws.get('updatedAt', ''), 'version': ws.get('version', 1)}})


@app.route('/api/workspaces/<ws_id>/version', methods=['GET'])
def api_workspace_version(ws_id):
    ws = wm.get_workspace(ws_id)
    if not ws:
        return jsonify({'ok': False, 'error': 'Workspace not found'}), 404
    return jsonify({'ok': True, 'data': {'version': ws.get('version', 0)}})


@app.route('/api/workspaces/<ws_id>/wallpaper', methods=['PUT'])
def api_set_wallpaper(ws_id):
    data = request.get_json(silent=True) or {}
    wallpaper = data.get('wallpaper')
    current = wm.get_workspace(ws_id)
    if not current:
        return jsonify({'ok': False, 'error': 'Workspace not found'}), 404
    settings = current.get('settings', {})
    settings['wallpaper'] = wallpaper
    ws = wm.update_workspace(ws_id, {'settings': settings})
    if not ws:  # pragma: no cover
        return jsonify({'ok': False, 'error': 'Workspace not found'}), 404
    return jsonify({'ok': True, 'data': {'wallpaper': wallpaper}})


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
    try:
        result = fm.read_file(ws_id, file_path, force_text)
    except ValueError as e:
        return jsonify({'ok': False, 'error': str(e)}), 422
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
    if _file_watching_enabled(ws_id):
        _broadcast(ws_id, {'type': 'file:changed', 'data': {'path': file_path, 'action': 'write'}})
    return jsonify({'ok': True, 'data': result})


@app.route('/api/workspaces/<ws_id>/files/<path:file_path>', methods=['PATCH'])
def api_rename_file(ws_id, file_path):
    data = request.get_json(silent=True) or {}
    new_path = data.get('newPath', '')
    if not new_path:
        return jsonify({'ok': False, 'error': 'newPath is required'}), 400
    try:
        result = fm.rename_file(ws_id, file_path, new_path)
    except FileExistsError:
        return jsonify({'ok': False, 'error': 'Target already exists'}), 409
    except OSError as e:
        return jsonify({'ok': False, 'error': str(e)}), 422
    if not result:
        return jsonify({'ok': False, 'error': 'File not found'}), 404
    if _file_watching_enabled(ws_id):
        _broadcast(ws_id, {'type': 'file:changed', 'data': {'path': new_path, 'oldPath': file_path, 'action': 'rename'}})
    return jsonify({'ok': True, 'data': result})


@app.route('/api/workspaces/<ws_id>/files/<path:file_path>', methods=['DELETE'])
def api_delete_file(ws_id, file_path):
    ok = fm.delete_file(ws_id, file_path)
    if not ok:
        return jsonify({'ok': False, 'error': 'File not found'}), 404
    if _file_watching_enabled(ws_id):
        _broadcast(ws_id, {'type': 'file:changed', 'data': {'path': file_path, 'action': 'delete'}})
    return jsonify({'ok': True, 'data': {'deleted': True}})


@app.route('/api/workspaces/<ws_id>/upload', methods=['POST'])
def api_upload(ws_id):
    if 'file' not in request.files:
        return jsonify({'ok': False, 'error': 'No file provided'}), 400
    file = request.files['file']
    subdir = request.form.get('path', 'files')
    try:
        result = fm.save_upload(ws_id, file.filename, file.read(), subdir)
    except ValueError as e:
        return jsonify({'ok': False, 'error': str(e)}), 422
    if _file_watching_enabled(ws_id):
        _broadcast(ws_id, {'type': 'file:changed', 'data': {'path': result['path'], 'action': 'write'}})
    return jsonify({'ok': True, 'data': result}), 201


@app.route('/api/workspaces/<ws_id>/search', methods=['GET'])
def api_search(ws_id):
    query = request.args.get('q', '')
    directory = request.args.get('dir', '')
    results = fm.search_files(ws_id, query, directory)
    return jsonify({'ok': True, 'data': results})


@app.route('/api/workspaces/<ws_id>/export', methods=['GET'])
def api_export_workspace(ws_id):
    data = wm.export_workspace(ws_id)
    if data is None:
        return jsonify({'ok': False, 'error': 'Workspace not found'}), 404
    from flask import send_file as flask_send_file
    return flask_send_file(
        io.BytesIO(data),
        mimetype='application/zip',
        as_attachment=True,
        download_name=f'{ws_id}.zip',
    )


@app.route('/api/workspaces/import', methods=['POST'])
def api_import_workspace():
    if 'file' not in request.files:
        return jsonify({'ok': False, 'error': 'No file provided'}), 400
    file = request.files['file']
    name = request.form.get('name') or file.filename.rsplit('.', 1)[0]
    workspace = wm.import_workspace(name, file.read())
    if not workspace:
        return jsonify({'ok': False, 'error': 'Invalid zip file'}), 400
    return jsonify({'ok': True, 'data': {'id': workspace['id'], 'name': workspace['name']}}), 201


@app.route('/api/plugins', methods=['GET'])
def api_list_plugins():
    return jsonify({'ok': True, 'data': plugin_loader.list_plugins()})


@app.route('/api/plugins/<plug_id>', methods=['DELETE'])
def api_uninstall_plugin(plug_id):
    if not plugin_loader.uninstall_plugin(plug_id):
        return jsonify({'ok': False, 'error': 'Plugin not found'}), 404
    return jsonify({'ok': True, 'data': {'deleted': True}})


@app.route('/api/plugins/<plug_id>/load', methods=['POST'])
def api_load_plugin(plug_id):
    exports = plugin_loader.load_plugin(plug_id)
    return jsonify({'ok': True, 'data': exports})


@app.route('/api/plugins/load_all', methods=['POST'])
def api_load_all_plugins():
    return jsonify({'ok': True, 'data': plugin_loader.load_all_plugins()})


# --- Auth ---

@app.route('/api/auth/status', methods=['GET'])
def api_auth_status():
    return jsonify({'ok': True, 'data': {'required': auth.is_required()}})


@app.route('/api/auth/register', methods=['POST'])
def api_auth_register():
    data = request.get_json(silent=True) or {}
    username = data.get('username', '').strip()
    password = data.get('password', '')
    if not username or not password:
        return jsonify({'ok': False, 'error': 'username and password required'}), 400
    try:
        result = auth.create_user(username, password)
    except ValueError as e:
        return jsonify({'ok': False, 'error': str(e)}), 409
    return jsonify({'ok': True, 'data': result}), 201


@app.route('/api/auth/login', methods=['POST'])
def api_auth_login():
    data = request.get_json(silent=True) or {}
    username = data.get('username', '').strip()
    password = data.get('password', '')
    token = auth.authenticate(username, password)
    if not token:
        return jsonify({'ok': False, 'error': 'Invalid credentials'}), 401
    return jsonify({'ok': True, 'data': {'token': token, 'username': username}})


@app.route('/api/auth/logout', methods=['POST'])
def api_auth_logout():
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    if not token:
        return jsonify({'ok': False, 'error': 'No token'}), 400
    auth.logout(token)
    return jsonify({'ok': True, 'data': {'loggedOut': True}})


@app.route('/api/auth/me', methods=['GET'])
def api_auth_me():
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    username = auth.verify_token(token)
    if not username:
        return jsonify({'ok': False, 'error': 'Invalid token'}), 401
    return jsonify({'ok': True, 'data': {'username': username}})


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