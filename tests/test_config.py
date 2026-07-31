"""Tests for global config manager."""
from backend import config_manager as cm
from backend import workspace_manager as wm


def test_default_config():
    cfg = cm.read_config()
    assert cfg['version'] == 1
    assert cfg['activeWorkspace'] is None
    assert cfg['theme'] == 'dark'
    assert cfg['language'] == 'en'
    assert cfg['workspaces'] == []


def test_write_and_read(clean_config):
    cm.write_config({'theme': 'light', 'language': 'fr'})
    cfg = cm.read_config()
    assert cfg['theme'] == 'light'
    assert cfg['language'] == 'fr'


def test_set_active_workspace(clean_config):
    cm.set_active_workspace('ws_abc123')
    assert cm.get_active_workspace() == 'ws_abc123'


def test_add_remove_workspace_list(clean_config):
    cm.add_workspace_to_list('ws_abc')
    assert cm.read_config()['workspaces'] == ['ws_abc']

    cm.add_workspace_to_list('ws_def')
    assert cm.read_config()['workspaces'] == ['ws_abc', 'ws_def']

    cm.add_workspace_to_list('ws_abc')
    assert cm.read_config()['workspaces'] == ['ws_abc', 'ws_def']

    cm.remove_workspace_from_list('ws_abc')
    assert cm.read_config()['workspaces'] == ['ws_def']

    cm.remove_workspace_from_list('ws_def')
    assert cm.read_config()['workspaces'] == []


def test_remove_active_fallsback(clean_config):
    cm.add_workspace_to_list('ws_1')
    cm.add_workspace_to_list('ws_2')
    cm.set_active_workspace('ws_1')
    cm.remove_workspace_from_list('ws_1')
    assert cm.get_active_workspace() == 'ws_2'


def test_remove_last_active_clears(clean_config):
    cm.add_workspace_to_list('ws_only')
    cm.set_active_workspace('ws_only')
    cm.remove_workspace_from_list('ws_only')
    assert cm.get_active_workspace() is None


def test_config_api_get(client):
    res = client.get('/api/config')
    assert res.status_code == 200
    data = res.get_json()
    assert data['ok'] is True


def test_config_api_update(client, clean_config):
    res = client.put('/api/config', json={'activeWorkspace': 'ws_test', 'theme': 'light'})
    assert res.status_code == 200
    data = res.get_json()
    assert data['data']['activeWorkspace'] == 'ws_test'
    assert data['data']['theme'] == 'light'


def test_config_api_ignores_invalid_fields(client, clean_config):
    res = client.put('/api/config', json={'foo': 'bar', 'activeWorkspace': 'ws_x'})
    assert res.status_code == 200
    data = res.get_json()['data']
    assert data['activeWorkspace'] == 'ws_x'


def test_workspace_creation_updates_config(clean_config):
    ws = wm.create_workspace('Test')
    cfg = cm.read_config()
    assert ws['id'] in cfg['workspaces']


def test_workspace_deletion_updates_config(clean_config):
    ws = wm.create_workspace('Test')
    wm.delete_workspace(ws['id'])
    cfg = cm.read_config()
    assert ws['id'] not in cfg['workspaces']


def test_config_corrupt_file_fallback(clean_config):
    cf = cm._config_path()
    cf.parent.mkdir(parents=True, exist_ok=True)
    cf.write_text('not valid json')
    cfg = cm.read_config()
    assert cfg['version'] == 1
    assert cfg['workspaces'] == []


def test_config_api_update_language(client, clean_config):
    res = client.put('/api/config', json={'language': 'zh-CN'})
    assert res.status_code == 200
    assert res.get_json()['data']['language'] == 'zh-CN'
