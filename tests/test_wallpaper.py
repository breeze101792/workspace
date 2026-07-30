"""Tests for workspace wallpaper feature."""
from backend import workspace_manager as wm


def test_default_wallpaper_is_none():
    ws = wm.create_workspace("Wallpaper Test")
    assert ws['settings']['wallpaper'] is None


def test_set_wallpaper_via_update():
    ws = wm.create_workspace("Wallpaper Test")
    settings = ws['settings']
    settings['wallpaper'] = '#ff0000'
    updated = wm.update_workspace(ws['id'], {'settings': settings})
    assert updated['settings']['wallpaper'] == '#ff0000'


def test_set_wallpaper_api(client):
    ws_id = client.post('/api/workspaces', json={'name': 'X'}).get_json()['data']['id']
    res = client.put(
        f'/api/workspaces/{ws_id}/wallpaper',
        json={'wallpaper': 'linear-gradient(45deg, #ff0, #00f)'},
    )
    assert res.status_code == 200
    assert res.get_json()['data']['wallpaper'] == 'linear-gradient(45deg, #ff0, #00f)'


def test_set_wallpaper_api_404(client):
    res = client.put(
        '/api/workspaces/ws_nope/wallpaper',
        json={'wallpaper': '#fff'},
    )
    assert res.status_code == 404


def test_wallpaper_persists_across_updates():
    ws = wm.create_workspace("Wallpaper Persist")
    settings = ws['settings']
    settings['wallpaper'] = 'data:image/png;base64,XYZ'
    wm.update_workspace(ws['id'], {'settings': settings})

    # Subsequent update preserves wallpaper
    updated = wm.update_workspace(ws['id'], {'name': 'Renamed'})
    assert updated['settings']['wallpaper'] == 'data:image/png;base64,XYZ'


def test_clear_wallpaper():
    ws = wm.create_workspace("Clear Wallpaper")
    settings = ws['settings']
    settings['wallpaper'] = '#fff'
    wm.update_workspace(ws['id'], {'settings': settings})

    settings['wallpaper'] = None
    updated = wm.update_workspace(ws['id'], {'settings': settings})
    assert updated['settings']['wallpaper'] is None