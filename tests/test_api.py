import json
import io

from backend import safe_fs


def test_list_workspaces_empty(client):
    res = client.get('/api/workspaces')
    assert res.status_code == 200
    assert res.get_json() == {'ok': True, 'data': []}


def test_create_workspace(client):
    res = client.post('/api/workspaces', json={'name': 'My Project'})
    assert res.status_code == 201
    body = res.get_json()
    assert body['ok'] is True
    assert body['data']['id'].startswith('ws_')
    assert body['data']['name'] == 'My Project'


def test_create_workspace_missing_name(client):
    res = client.post('/api/workspaces', json={})
    assert res.status_code == 400
    assert res.get_json()['ok'] is False


def test_create_workspace_too_long_name(client):
    res = client.post('/api/workspaces', json={'name': 'x' * 201})
    assert res.status_code == 400


def test_get_workspace(client):
    created = client.post('/api/workspaces', json={'name': 'X'}).get_json()
    ws_id = created['data']['id']

    res = client.get(f'/api/workspaces/{ws_id}')
    assert res.status_code == 200
    body = res.get_json()
    assert body['ok'] is True
    assert body['data']['name'] == 'X'
    assert 'windows' in body['data']
    assert 'settings' in body['data']


def test_get_workspace_404(client):
    res = client.get('/api/workspaces/ws_nope')
    assert res.status_code == 404


def test_update_workspace(client):
    ws_id = client.post('/api/workspaces', json={'name': 'X'}).get_json()['data']['id']
    res = client.put(f'/api/workspaces/{ws_id}', json={'name': 'Y'})
    assert res.status_code == 200
    assert res.get_json()['data']['updatedAt']

    fetched = client.get(f'/api/workspaces/{ws_id}').get_json()['data']
    assert fetched['name'] == 'Y'


def test_delete_workspace(client):
    ws_id = client.post('/api/workspaces', json={'name': 'X'}).get_json()['data']['id']
    res = client.delete(f'/api/workspaces/{ws_id}')
    assert res.status_code == 200
    assert res.get_json()['data']['deleted'] is True
    assert client.get(f'/api/workspaces/{ws_id}').status_code == 404


def test_update_workspace_404(client):
    res = client.put('/api/workspaces/ws_nope', json={'name': 'Y'})
    assert res.status_code == 404


def test_delete_workspace_404(client):
    res = client.delete('/api/workspaces/ws_nope')
    assert res.status_code == 404


def test_list_files_404(client):
    res = client.get('/api/workspaces/ws_nope/files')
    assert res.status_code == 404


def test_list_files(client):
    ws_id = client.post('/api/workspaces', json={'name': 'X'}).get_json()['data']['id']
    res = client.get(f'/api/workspaces/{ws_id}/files')
    assert res.status_code == 200
    body = res.get_json()
    assert body['ok'] is True
    entries = {e['name'] for e in body['data']['entries']}
    assert {'markdown', 'text', 'html', 'images', 'files'} <= entries


def test_list_files_includes_updatedAt_for_file_entries(client):
    ws_id = client.post('/api/workspaces', json={'name': 'X'}).get_json()['data']['id']
    client.put(f'/api/workspaces/{ws_id}/files/markdown/x.md', json={'content': 'data'})
    res = client.get(f'/api/workspaces/{ws_id}/files?dir=markdown')
    body = res.get_json()
    file_entry = next(e for e in body['data']['entries'] if e['name'] == 'x.md')
    assert 'updatedAt' in file_entry


def test_read_write_file(client):
    ws_id = client.post('/api/workspaces', json={'name': 'X'}).get_json()['data']['id']
    client.put(f'/api/workspaces/{ws_id}/files/markdown/x.md', json={'content': '# Hi'})
    res = client.get(f'/api/workspaces/{ws_id}/files/markdown/x.md')
    assert res.status_code == 200
    body = res.get_json()
    assert body['data']['content'] == '# Hi'
    assert body['data']['mime'] == 'text/markdown'


def test_read_file_force_text(client):
    ws_id = client.post('/api/workspaces', json={'name': 'X'}).get_json()['data']['id']
    client.put(f'/api/workspaces/{ws_id}/files/markdown/x.bin', json={'content': 'forced text'})
    res = client.get(f'/api/workspaces/{ws_id}/files/markdown/x.bin?type=text')
    assert res.status_code == 200
    body = res.get_json()
    assert body['data']['content'] == 'forced text'


def test_read_file_404(client):
    ws_id = client.post('/api/workspaces', json={'name': 'X'}).get_json()['data']['id']
    res = client.get(f'/api/workspaces/{ws_id}/files/markdown/nope.md')
    assert res.status_code == 404


def test_read_file_invalid_utf8_returns_422(client):
    ws_id = client.post('/api/workspaces', json={'name': 'X'}).get_json()['data']['id']
    bad = safe_fs.workspace_path(ws_id) / 'text' / 'bad.txt'
    bad.parent.mkdir(parents=True, exist_ok=True)
    bad.write_bytes(b'\xff\xfe\x00')
    res = client.get(f'/api/workspaces/{ws_id}/files/text/bad.txt')
    assert res.status_code == 422
    body = res.get_json()
    assert body['ok'] is False
    assert 'UTF-8' in body['error']


def test_write_file_422_on_path_traversal(client):
    ws_id = client.post('/api/workspaces', json={'name': 'X'}).get_json()['data']['id']
    res = client.put(f'/api/workspaces/{ws_id}/files/../escape.txt', json={'content': 'x'})
    assert res.status_code == 422


def test_delete_file(client):
    ws_id = client.post('/api/workspaces', json={'name': 'X'}).get_json()['data']['id']
    client.put(f'/api/workspaces/{ws_id}/files/markdown/x.md', json={'content': 'data'})
    res = client.delete(f'/api/workspaces/{ws_id}/files/markdown/x.md')
    assert res.status_code == 200
    assert res.get_json()['data']['deleted'] is True


def test_delete_file_404(client):
    ws_id = client.post('/api/workspaces', json={'name': 'X'}).get_json()['data']['id']
    res = client.delete(f'/api/workspaces/{ws_id}/files/markdown/nope.md')
    assert res.status_code == 404


def test_delete_nonempty_directory_returns_404_envelope(client):
    ws_id = client.post('/api/workspaces', json={'name': 'X'}).get_json()['data']['id']
    client.put(f'/api/workspaces/{ws_id}/files/markdown/sub/keep.md', json={'content': 'data'})
    res = client.delete(f'/api/workspaces/{ws_id}/files/markdown/sub')
    assert res.status_code == 404
    body = res.get_json()
    assert body['ok'] is False
    # Contents untouched
    kept = client.get(f'/api/workspaces/{ws_id}/files/markdown/sub/keep.md')
    assert kept.status_code == 200


def test_upload_file(client):
    ws_id = client.post('/api/workspaces', json={'name': 'X'}).get_json()['data']['id']
    data = {'file': (io.BytesIO(b'PNG_DATA'), 'test.png')}
    res = client.post(
        f'/api/workspaces/{ws_id}/upload',
        data=data,
        content_type='multipart/form-data',
    )
    assert res.status_code == 201
    body = res.get_json()
    assert body['ok'] is True
    assert body['data']['path'] == 'files/test.png'


def test_upload_no_file_400(client):
    ws_id = client.post('/api/workspaces', json={'name': 'X'}).get_json()['data']['id']
    res = client.post(f'/api/workspaces/{ws_id}/upload', data={})
    assert res.status_code == 400


def test_upload_malicious_path_returns_422(client):
    ws_id = client.post('/api/workspaces', json={'name': 'X'}).get_json()['data']['id']
    data = {'file': (io.BytesIO(b'data'), 'evil.txt'), 'path': '../../escape'}
    res = client.post(
        f'/api/workspaces/{ws_id}/upload',
        data=data,
        content_type='multipart/form-data',
    )
    assert res.status_code == 422
    body = res.get_json()
    assert body['ok'] is False
    assert body['error'] == 'Invalid path'


def test_404_error_envelope(client):
    res = client.get('/this/does/not/exist')
    assert res.status_code == 404
    assert res.get_json()['ok'] is False