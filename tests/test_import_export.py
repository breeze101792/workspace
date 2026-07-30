"""Tests for workspace import/export."""
import io
import zipfile
from backend import workspace_manager as wm
from backend import file_manager as fm


def test_export_workspace_returns_zip():
    ws = wm.create_workspace("Export Test")
    fm.write_file(ws['id'], 'markdown/a.md', '# Hello')
    data = wm.export_workspace(ws['id'])
    assert data is not None
    # Verify it's a valid zip
    with zipfile.ZipFile(io.BytesIO(data)) as zf:
        names = zf.namelist()
    assert 'workspace.json' in names
    assert 'markdown/a.md' in names


def test_export_nonexistent_workspace_returns_none():
    assert wm.export_workspace('ws_nope') is None


def test_import_workspace_creates_files():
    ws = wm.create_workspace("Source")
    fm.write_file(ws['id'], 'markdown/a.md', '# Imported')
    zip_data = wm.export_workspace(ws['id'])

    imported = wm.import_workspace("Imported WS", zip_data)
    assert imported is not None
    assert imported['name'] == "Imported WS"
    assert imported['id'].startswith('ws_')

    content = fm.read_file(imported['id'], 'markdown/a.md')
    assert content['content'] == '# Imported'


def test_import_invalid_zip_returns_none():
    result = wm.import_workspace("Bad", b'NOT_A_ZIP_FILE')
    assert result is None


def test_import_zip_blocks_path_traversal():
    """A malicious zip with ../ shouldn't escape the workspace directory."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w') as zf:
        zf.writestr('../../etc/escape.txt', 'malicious')
        zf.writestr('markdown/legit.md', 'safe')
    result = wm.import_workspace("Trap", buf.getvalue())
    assert result is not None
    # The legit file should be there
    assert fm.read_file(result['id'], 'markdown/legit.md') is not None


# --- API endpoints ---

def test_export_api_endpoint(client):
    ws_id = client.post('/api/workspaces', json={'name': 'X'}).get_json()['data']['id']
    client.put(f'/api/workspaces/{ws_id}/files/markdown/a.md', json={'content': 'data'})
    res = client.get(f'/api/workspaces/{ws_id}/export')
    assert res.status_code == 200
    assert res.mimetype == 'application/zip'
    # Verify it's a valid zip
    with zipfile.ZipFile(io.BytesIO(res.data)) as zf:
        assert 'workspace.json' in zf.namelist()


def test_export_api_404(client):
    res = client.get('/api/workspaces/ws_nope/export')
    assert res.status_code == 404


def test_import_api_endpoint(client):
    # First, create a workspace and export it
    src_id = client.post('/api/workspaces', json={'name': 'Source'}).get_json()['data']['id']
    client.put(f'/api/workspaces/{src_id}/files/markdown/a.md', json={'content': 'hello'})
    export_res = client.get(f'/api/workspaces/{src_id}/export')

    # Now import it
    data = {'file': (io.BytesIO(export_res.data), 'export.zip')}
    res = client.post('/api/workspaces/import', data=data, content_type='multipart/form-data')
    assert res.status_code == 201
    body = res.get_json()
    assert body['ok'] is True
    assert body['data']['id'].startswith('ws_')


def test_import_api_no_file_400(client):
    res = client.post('/api/workspaces/import', data={})
    assert res.status_code == 400


def test_import_api_invalid_zip_400(client):
    data = {'file': (io.BytesIO(b'not a zip'), 'bad.zip')}
    res = client.post('/api/workspaces/import', data=data, content_type='multipart/form-data')
    assert res.status_code == 400