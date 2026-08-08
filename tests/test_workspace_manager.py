from pathlib import Path
from backend import workspace_manager as wm


def test_create_workspace_returns_full_state():
    ws = wm.create_workspace("Test WS")
    assert ws['name'] == "Test WS"
    assert ws['id'].startswith("ws_")
    assert 'createdAt' in ws
    assert 'updatedAt' in ws
    assert isinstance(ws['windows'], list)
    assert isinstance(ws['settings'], dict)


def test_create_workspace_creates_all_subdirs():
    ws = wm.create_workspace("Test WS")
    root = Path.home() / '.config' / 'workspace' / 'workspaces' / ws['id'] if False else None
    # Use the (patched) WORKSPACES_DIR from conftest
    from backend import safe_fs
    ws_dir = safe_fs.WORKSPACES_DIR / ws['id']
    assert ws_dir.exists()
    for sub in ('markdown', 'text', 'html', 'images', 'files', 'cache'):
        assert (ws_dir / sub).is_dir()


def test_create_workspace_writes_welcome_html():
    ws = wm.create_workspace("Test WS")
    from backend import safe_fs
    welcome = safe_fs.WORKSPACES_DIR / ws['id'] / 'html' / 'welcome.html'
    assert welcome.exists()
    assert '<h1>Welcome</h1>' in welcome.read_text()


def test_create_workspace_initial_settings():
    ws = wm.create_workspace("Test WS")
    assert ws['settings']['zoom'] == 1.0
    assert ws['settings']['viewportX'] == 0
    assert ws['settings']['viewportY'] == 0


def test_create_workspace_file_watching_enabled_by_default():
    ws = wm.create_workspace("Test WS")
    assert ws['settings']['watchFiles'] is True


def test_get_workspace_returns_saved():
    ws = wm.create_workspace("Persist Test")
    fetched = wm.get_workspace(ws['id'])
    assert fetched is not None
    assert fetched['id'] == ws['id']
    assert fetched['name'] == "Persist Test"


def test_get_workspace_nonexistent_returns_none():
    assert wm.get_workspace("ws_doesnotexist") is None


def test_list_workspaces_returns_all():
    w1 = wm.create_workspace("WS1")
    w2 = wm.create_workspace("WS2")
    listed = wm.list_workspaces()
    ids = [w['id'] for w in listed]
    assert w1['id'] in ids
    assert w2['id'] in ids
    for w in listed:
        assert 'id' in w
        assert 'name' in w
        assert 'updatedAt' in w


def test_update_workspace_changes_name():
    ws = wm.create_workspace("Original")
    updated = wm.update_workspace(ws['id'], {"name": "Renamed"})
    assert updated['name'] == "Renamed"
    assert wm.get_workspace(ws['id'])['name'] == "Renamed"


def test_update_workspace_updates_updatedAt():
    ws = wm.create_workspace("X")
    original_updated = ws['updatedAt']
    updated = wm.update_workspace(ws['id'], {"name": "Y"})
    assert updated['updatedAt'] >= original_updated


def test_update_workspace_nonexistent_returns_none():
    assert wm.update_workspace("ws_nope", {"name": "x"}) is None


def test_delete_workspace_removes_files():
    ws = wm.create_workspace("ToDelete")
    from backend import safe_fs
    target = safe_fs.WORKSPACES_DIR / ws['id']
    assert target.exists()
    assert wm.delete_workspace(ws['id']) is True
    assert not target.exists()


def test_delete_workspace_nonexistent_returns_false():
    assert wm.delete_workspace("ws_nope") is False