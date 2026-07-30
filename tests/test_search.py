"""Tests for file search feature."""
from backend import workspace_manager as wm
from backend import file_manager as fm


def test_search_empty_query_returns_empty():
    ws = wm.create_workspace("Search Test")
    fm.write_file(ws['id'], 'markdown/a.md', 'hello world')
    assert fm.search_files(ws['id'], '') == []


def test_search_finds_matches():
    ws = wm.create_workspace("Search Test")
    fm.write_file(ws['id'], 'markdown/a.md', 'hello world\nfoo bar')
    results = fm.search_files(ws['id'], 'hello')
    assert len(results) == 1
    assert results[0]['path'] == 'markdown/a.md'
    assert results[0]['line'] == 1
    assert 'hello' in results[0]['text']


def test_search_case_insensitive():
    ws = wm.create_workspace("Search Test")
    fm.write_file(ws['id'], 'markdown/a.md', 'Hello World')
    results = fm.search_files(ws['id'], 'hello')
    assert len(results) == 1


def test_search_multiple_matches():
    ws = wm.create_workspace("Search Test")
    fm.write_file(ws['id'], 'markdown/a.md', 'foo\nfoo bar\nbaz foo')
    results = fm.search_files(ws['id'], 'foo')
    assert len(results) == 3


def test_search_multiple_files():
    ws = wm.create_workspace("Search Test")
    fm.write_file(ws['id'], 'markdown/a.md', 'needle here')
    fm.write_file(ws['id'], 'markdown/b.md', 'also needle')
    results = fm.search_files(ws['id'], 'needle')
    paths = {r['path'] for r in results}
    assert paths == {'markdown/a.md', 'markdown/b.md'}


def test_search_skips_binary():
    ws = wm.create_workspace("Search Test")
    fm.write_file(ws['id'], 'text/data.bin', 'binary needle')
    results = fm.search_files(ws['id'], 'needle')
    assert results == []


def test_search_skips_hidden_files():
    ws = wm.create_workspace("Search Test")
    fm.write_file(ws['id'], 'markdown/.hidden.md', 'needle here')
    results = fm.search_files(ws['id'], 'needle')
    assert results == []


def test_search_in_subdirectory():
    ws = wm.create_workspace("Search Test")
    fm.write_file(ws['id'], 'markdown/note.md', 'hello world')
    fm.write_file(ws['id'], 'text/note.txt', 'goodbye world')
    results = fm.search_files(ws['id'], 'hello', 'markdown')
    assert len(results) == 1
    assert results[0]['path'] == 'markdown/note.md'


def test_search_no_matches():
    ws = wm.create_workspace("Search Test")
    fm.write_file(ws['id'], 'markdown/a.md', 'hello world')
    results = fm.search_files(ws['id'], 'nonexistent')
    assert results == []


def test_search_truncates_long_lines():
    ws = wm.create_workspace("Search Test")
    long_line = 'x' * 500
    fm.write_file(ws['id'], 'markdown/a.md', long_line)
    results = fm.search_files(ws['id'], 'xxxxx')
    assert len(results) == 1
    assert len(results[0]['text']) <= 200


def test_search_returns_line_number():
    ws = wm.create_workspace("Search Test")
    fm.write_file(ws['id'], 'markdown/a.md', 'first line\nsecond line\nthird needle')
    results = fm.search_files(ws['id'], 'needle')
    assert len(results) == 1
    assert results[0]['line'] == 3


def test_search_caps_at_500():
    ws = wm.create_workspace("Search Test")
    # Create enough matches to trigger cap
    lines = '\n'.join(f'match {i}' for i in range(600))
    fm.write_file(ws['id'], 'markdown/big.md', lines)
    results = fm.search_files(ws['id'], 'match')
    assert len(results) == 500


def test_search_nonexistent_dir_returns_empty():
    ws = wm.create_workspace("Search Test")
    results = fm.search_files(ws['id'], 'foo', 'nope')
    assert results == []


def test_search_skips_unreadable_file(tmp_path, monkeypatch):
    """If a file raises on read, it should be skipped silently."""
    ws = wm.create_workspace("Search Test")
    fm.write_file(ws['id'], 'markdown/a.md', 'needle')

    # Mock read_text to raise
    from pathlib import Path
    original_read_text = Path.read_text
    def bad_read(self, *args, **kwargs):
        if 'a.md' in str(self):
            raise OSError('cannot read')
        return original_read_text(self, *args, **kwargs)
    monkeypatch.setattr(Path, 'read_text', bad_read)

    results = fm.search_files(ws['id'], 'needle')
    assert results == []


def test_search_handles_permission_error(monkeypatch):
    """If read_text raises PermissionError, search should skip the file."""
    ws = wm.create_workspace("Perm Test")
    fm.write_file(ws['id'], 'markdown/x.md', 'needle')

    from pathlib import Path
    import builtins
    # Patch at a different level - patch Path.read_text directly
    original = Path.read_text

    def selective(self, *args, **kwargs):
        # Raise on specific file
        if str(self).endswith('x.md'):
            raise PermissionError('denied')
        return original(self, *args, **kwargs)
    monkeypatch.setattr(Path, 'read_text', selective)

    # Search should not crash, just skip the file
    results = fm.search_files(ws['id'], 'needle')
    # Result depends on whether other files match
    assert isinstance(results, list)


# --- API endpoint ---

def test_search_api_endpoint(client):
    ws_id = client.post('/api/workspaces', json={'name': 'X'}).get_json()['data']['id']
    client.put(f'/api/workspaces/{ws_id}/files/markdown/a.md', json={'content': 'hello world'})
    res = client.get(f'/api/workspaces/{ws_id}/search?q=hello')
    assert res.status_code == 200
    body = res.get_json()
    assert body['ok'] is True
    assert len(body['data']) == 1


def test_search_api_no_query(client):
    ws_id = client.post('/api/workspaces', json={'name': 'X'}).get_json()['data']['id']
    res = client.get(f'/api/workspaces/{ws_id}/search?q=')
    assert res.status_code == 200
    assert res.get_json()['data'] == []


def test_search_api_with_dir(client):
    ws_id = client.post('/api/workspaces', json={'name': 'X'}).get_json()['data']['id']
    client.put(f'/api/workspaces/{ws_id}/files/markdown/a.md', json={'content': 'needle'})
    client.put(f'/api/workspaces/{ws_id}/files/text/b.txt', json={'content': 'needle'})
    res = client.get(f'/api/workspaces/{ws_id}/search?q=needle&dir=markdown')
    body = res.get_json()
    paths = {r['path'] for r in body['data']}
    assert paths == {'markdown/a.md'}