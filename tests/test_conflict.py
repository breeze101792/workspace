"""Tests for conflict resolution via version headers."""
from backend import workspace_manager as wm


def test_update_increments_version():
    ws = wm.create_workspace("Version Test")
    initial = ws.get('version', 0)
    updated = wm.update_workspace(ws['id'], {'name': 'Renamed'})
    assert updated['version'] > initial


def test_update_with_matching_version_succeeds(client):
    ws_id = client.post('/api/workspaces', json={'name': 'X'}).get_json()['data']['id']
    res = client.get(f'/api/workspaces/{ws_id}')
    initial_version = res.get_json()['data'].get('version', 0)

    res = client.put(
        f'/api/workspaces/{ws_id}',
        json={'name': 'Y'},
        headers={'If-Match': str(initial_version)},
    )
    assert res.status_code == 200


def test_update_with_stale_version_returns_409(client):
    ws_id = client.post('/api/workspaces', json={'name': 'X'}).get_json()['data']['id']
    # First update bumps version
    client.put(f'/api/workspaces/{ws_id}', json={'name': 'A'})
    # Second update with stale version
    res = client.put(
        f'/api/workspaces/{ws_id}',
        json={'name': 'B'},
        headers={'If-Match': '0'},
    )
    assert res.status_code == 409
    body = res.get_json()
    assert body['ok'] is False
    assert body['error'] == 'Version conflict'
    assert 'current' in body


def test_update_without_if_match_works(client):
    ws_id = client.post('/api/workspaces', json={'name': 'X'}).get_json()['data']['id']
    res = client.put(f'/api/workspaces/{ws_id}', json={'name': 'Y'})
    assert res.status_code == 200
    assert 'version' in res.get_json()['data']


def test_get_workspace_version(client):
    ws_id = client.post('/api/workspaces', json={'name': 'X'}).get_json()['data']['id']
    res = client.get(f'/api/workspaces/{ws_id}/version')
    assert res.status_code == 200
    assert 'version' in res.get_json()['data']


def test_get_version_404(client):
    res = client.get('/api/workspaces/ws_nope/version')
    assert res.status_code == 404


def test_resolve_conflict_with_force(client):
    """After a conflict, client can re-fetch version and re-submit."""
    ws_id = client.post('/api/workspaces', json={'name': 'X'}).get_json()['data']['id']
    client.put(f'/api/workspaces/{ws_id}', json={'name': 'A'})
    res = client.put(f'/api/workspaces/{ws_id}', json={'name': 'B'}, headers={'If-Match': '0'})
    assert res.status_code == 409
    # Re-fetch version
    current = res.get_json()['current']['version']
    # Re-submit with correct version
    res2 = client.put(
        f'/api/workspaces/{ws_id}',
        json={'name': 'B'},
        headers={'If-Match': str(current)},
    )
    assert res2.status_code == 200