"""Tests for plugin loading."""
import os
import sys
from pathlib import Path
from backend import plugin_loader


def test_list_plugins_empty():
    assert plugin_loader.list_plugins() == []


def test_list_plugins_with_manifest(tmp_path, monkeypatch):
    from backend import safe_fs
    monkeypatch.setattr(safe_fs, 'CONFIG_DIR', tmp_path / 'cfg')
    monkeypatch.setattr(plugin_loader, '_extensions_dir', lambda: tmp_path / 'cfg' / 'extensions')

    ext_dir = tmp_path / 'cfg' / 'extensions' / 'testplug'
    ext_dir.mkdir(parents=True)
    (ext_dir / 'plugin.json').write_text('{"name":"Test","version":"1.0"}')

    plugins = plugin_loader.list_plugins()
    assert len(plugins) == 1
    assert plugins[0]['id'] == 'testplug'
    assert plugins[0]['name'] == 'Test'


def test_get_plugin_found(tmp_path, monkeypatch):
    from backend import safe_fs
    monkeypatch.setattr(safe_fs, 'CONFIG_DIR', tmp_path / 'cfg')
    monkeypatch.setattr(plugin_loader, '_extensions_dir', lambda: tmp_path / 'cfg' / 'extensions')
    ext_dir = tmp_path / 'cfg' / 'extensions' / 'myplug'
    ext_dir.mkdir(parents=True)
    assert plugin_loader.get_plugin('myplug') is not None
    assert plugin_loader.get_plugin('nope') is None


def test_install_plugin(tmp_path, monkeypatch):
    from backend import safe_fs
    monkeypatch.setattr(safe_fs, 'CONFIG_DIR', tmp_path / 'cfg')
    monkeypatch.setattr(plugin_loader, '_extensions_dir', lambda: tmp_path / 'cfg' / 'extensions')

    src = tmp_path / 'srcplug'
    src.mkdir()
    (src / 'plugin.json').write_text('{"name":"Src"}')

    info = plugin_loader.install_plugin('newplug', str(src))
    assert info['id'] == 'newplug'
    assert info['name'] == 'Src'


def test_install_duplicate_raises(tmp_path, monkeypatch):
    from backend import safe_fs
    monkeypatch.setattr(safe_fs, 'CONFIG_DIR', tmp_path / 'cfg')
    monkeypatch.setattr(plugin_loader, '_extensions_dir', lambda: tmp_path / 'cfg' / 'extensions')
    ext_dir = tmp_path / 'cfg' / 'extensions' / 'dup'
    ext_dir.mkdir(parents=True)

    import pytest
    with pytest.raises(ValueError):
        plugin_loader.install_plugin('dup', str(ext_dir))


def test_uninstall_plugin(tmp_path, monkeypatch):
    from backend import safe_fs
    monkeypatch.setattr(safe_fs, 'CONFIG_DIR', tmp_path / 'cfg')
    monkeypatch.setattr(plugin_loader, '_extensions_dir', lambda: tmp_path / 'cfg' / 'extensions')
    ext_dir = tmp_path / 'cfg' / 'extensions' / 'toremove'
    ext_dir.mkdir(parents=True)

    assert plugin_loader.uninstall_plugin('toremove') is True
    assert not ext_dir.exists()


def test_uninstall_nonexistent(tmp_path, monkeypatch):
    from backend import safe_fs
    monkeypatch.setattr(safe_fs, 'CONFIG_DIR', tmp_path / 'cfg')
    monkeypatch.setattr(plugin_loader, '_extensions_dir', lambda: tmp_path / 'cfg' / 'extensions')
    (tmp_path / 'cfg' / 'extensions').mkdir(parents=True)
    assert plugin_loader.uninstall_plugin('nope') is False


def test_load_plugin_executes_main(tmp_path, monkeypatch):
    from backend import safe_fs
    monkeypatch.setattr(safe_fs, 'CONFIG_DIR', tmp_path / 'cfg')
    monkeypatch.setattr(plugin_loader, '_extensions_dir', lambda: tmp_path / 'cfg' / 'extensions')
    ext_dir = tmp_path / 'cfg' / 'extensions' / 'sample'
    ext_dir.mkdir(parents=True)
    (ext_dir / 'plugin.json').write_text('{"name":"Sample"}')
    (ext_dir / 'main.py').write_text("""
def register(api):
    api.register('hello', lambda: 'world')
""")

    exports = plugin_loader.load_plugin('sample')
    assert exports['hello']() == 'world'


def test_load_plugin_no_main(tmp_path, monkeypatch):
    from backend import safe_fs
    monkeypatch.setattr(safe_fs, 'CONFIG_DIR', tmp_path / 'cfg')
    monkeypatch.setattr(plugin_loader, '_extensions_dir', lambda: tmp_path / 'cfg' / 'extensions')
    ext_dir = tmp_path / 'cfg' / 'extensions' / 'nomain'
    ext_dir.mkdir(parents=True)
    (ext_dir / 'plugin.json').write_text('{"name":"NoMain"}')

    exports = plugin_loader.load_plugin('nomain')
    assert exports == {}


def test_load_plugin_with_error(tmp_path, monkeypatch):
    """Plugin that raises should be caught and logged."""
    from backend import safe_fs
    monkeypatch.setattr(safe_fs, 'CONFIG_DIR', tmp_path / 'cfg')
    monkeypatch.setattr(plugin_loader, '_extensions_dir', lambda: tmp_path / 'cfg' / 'extensions')
    ext_dir = tmp_path / 'cfg' / 'extensions' / 'broken'
    ext_dir.mkdir(parents=True)
    (ext_dir / 'main.py').write_text("raise RuntimeError('bad')")

    exports = plugin_loader.load_plugin('broken')
    assert 'error' in exports


def test_load_plugin_no_register_function(tmp_path, monkeypatch):
    from backend import safe_fs
    monkeypatch.setattr(safe_fs, 'CONFIG_DIR', tmp_path / 'cfg')
    monkeypatch.setattr(plugin_loader, '_extensions_dir', lambda: tmp_path / 'cfg' / 'extensions')
    ext_dir = tmp_path / 'cfg' / 'extensions' / 'norreg'
    ext_dir.mkdir(parents=True)
    (ext_dir / 'main.py').write_text("x = 1\n")  # no register function

    exports = plugin_loader.load_plugin('norreg')
    assert exports == {}


def test_load_all_plugins_with_error(tmp_path, monkeypatch):
    from backend import safe_fs
    monkeypatch.setattr(safe_fs, 'CONFIG_DIR', tmp_path / 'cfg')
    monkeypatch.setattr(plugin_loader, '_extensions_dir', lambda: tmp_path / 'cfg' / 'extensions')
    bad = tmp_path / 'cfg' / 'extensions' / 'bad'
    bad.mkdir(parents=True)
    (bad / 'main.py').write_text("def register(api): raise RuntimeError('boom')")
    result = plugin_loader.load_all_plugins()
    assert 'error' in result['bad']


def test_load_all_plugins_handles_load_exception(tmp_path, monkeypatch):
    """If load_plugin raises an unexpected exception, load_all_plugins catches it."""
    from backend import safe_fs
    import backend.plugin_loader as pl
    monkeypatch.setattr(safe_fs, 'CONFIG_DIR', tmp_path / 'cfg')
    monkeypatch.setattr(pl, '_extensions_dir', lambda: tmp_path / 'cfg' / 'extensions')
    p = tmp_path / 'cfg' / 'extensions' / 'crash'
    p.mkdir(parents=True)
    (p / 'main.py').write_text('pass')

    # Make load_plugin itself raise
    def boom(_):
        raise RuntimeError('boom')
    monkeypatch.setattr(pl, 'load_plugin', boom)

    result = pl.load_all_plugins()
    assert 'error' in result['crash']


def test_load_plugin_spec_none(tmp_path, monkeypatch):
    """If importlib.util.spec_from_file_location returns None, return empty dict."""
    from backend import safe_fs
    import backend.plugin_loader as pl
    monkeypatch.setattr(safe_fs, 'CONFIG_DIR', tmp_path / 'cfg')
    monkeypatch.setattr(pl, '_extensions_dir', lambda: tmp_path / 'cfg' / 'extensions')
    ext = tmp_path / 'cfg' / 'extensions' / 'specfail'
    ext.mkdir(parents=True)
    (ext / 'main.py').write_text('x = 1')

    monkeypatch.setattr(pl.importlib.util, 'spec_from_file_location', lambda *a, **k: None)
    result = pl.load_plugin('specfail')
    assert result == {}


def test_list_plugins_with_invalid_manifest(tmp_path, monkeypatch):
    from backend import safe_fs
    monkeypatch.setattr(safe_fs, 'CONFIG_DIR', tmp_path / 'cfg')
    monkeypatch.setattr(plugin_loader, '_extensions_dir', lambda: tmp_path / 'cfg' / 'extensions')
    ext_dir = tmp_path / 'cfg' / 'extensions' / 'bad'
    ext_dir.mkdir(parents=True)
    (ext_dir / 'plugin.json').write_text('NOT JSON {')

    plugins = plugin_loader.list_plugins()
    assert any(p.get('error') == 'invalid manifest' for p in plugins)


def test_load_all_plugins(tmp_path, monkeypatch):
    from backend import safe_fs
    monkeypatch.setattr(safe_fs, 'CONFIG_DIR', tmp_path / 'cfg')
    monkeypatch.setattr(plugin_loader, '_extensions_dir', lambda: tmp_path / 'cfg' / 'extensions')

    for name in ['p1', 'p2']:
        d = tmp_path / 'cfg' / 'extensions' / name
        d.mkdir(parents=True)
        (d / 'main.py').write_text(f"""
def register(api):
    api.register('name', '{name}')
""")

    result = plugin_loader.load_all_plugins()
    assert 'p1' in result and 'p2' in result
    assert result['p1']['name'] == 'p1'
    assert result['p2']['name'] == 'p2'


# --- API ---

def test_list_plugins_api(client, tmp_path, monkeypatch):
    from backend import safe_fs
    monkeypatch.setattr(safe_fs, 'CONFIG_DIR', tmp_path / 'cfg')
    monkeypatch.setattr(plugin_loader, '_extensions_dir', lambda: tmp_path / 'cfg' / 'extensions')
    res = client.get('/api/plugins')
    assert res.status_code == 200
    assert res.get_json()['data'] == []


def test_uninstall_plugin_api_404(client):
    res = client.delete('/api/plugins/nope')
    assert res.status_code == 404


def test_uninstall_plugin_api_success(client, tmp_path, monkeypatch):
    from backend import safe_fs
    monkeypatch.setattr(safe_fs, 'CONFIG_DIR', tmp_path / 'cfg')
    monkeypatch.setattr(plugin_loader, '_extensions_dir', lambda: tmp_path / 'cfg' / 'extensions')
    ext_dir = tmp_path / 'cfg' / 'extensions' / 'to_delete'
    ext_dir.mkdir(parents=True)
    res = client.delete('/api/plugins/to_delete')
    assert res.status_code == 200


def test_load_plugin_api(client):
    res = client.post('/api/plugins/nope/load')
    assert res.status_code == 200


def test_load_all_plugins_api(client):
    res = client.post('/api/plugins/load_all')
    assert res.status_code == 200