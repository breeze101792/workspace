"""External plugin loading from the extensions/ directory."""
import json
import os
import sys
import importlib.util
from pathlib import Path

from . import safe_fs


def _extensions_dir() -> Path:
    return safe_fs.CONFIG_DIR / 'extensions'


def list_plugins() -> list[dict]:
    """List installed plugins."""
    ext_dir = _extensions_dir()
    if not ext_dir.exists():
        return []
    plugins = []
    for p in sorted(ext_dir.iterdir()):
        manifest = p / 'plugin.json'
        info = {'id': p.name, 'path': str(p)}
        if manifest.exists():
            try:
                info.update(json.loads(manifest.read_text()))
            except Exception:
                info['error'] = 'invalid manifest'
        plugins.append(info)
    return plugins


def get_plugin(plug_id: str) -> dict | None:
    for p in list_plugins():
        if p['id'] == plug_id:
            return p
    return None


def install_plugin(plug_id: str, source_dir: str) -> dict:
    """Copy a directory into the extensions directory."""
    ext_dir = _extensions_dir()
    ext_dir.mkdir(parents=True, exist_ok=True)
    target = ext_dir / plug_id
    if target.exists():
        raise ValueError(f'Plugin {plug_id} already installed')
    import shutil
    shutil.copytree(source_dir, target)
    return get_plugin(plug_id)


def uninstall_plugin(plug_id: str) -> bool:
    target = _extensions_dir() / plug_id
    if not target.exists():
        return False
    import shutil
    shutil.rmtree(target)
    return True


def load_plugin(plug_id: str) -> dict:
    """Load and execute a plugin's main.py file. Returns its registered exports."""
    target = _extensions_dir() / plug_id
    main_py = target / 'main.py'
    if not main_py.exists():
        return {}

    exports = {}

    class PluginAPI:
        def register(self, name, fn):
            exports[name] = fn
        def log(self, *args):
            print(f'[plugin:{plug_id}]', *args)

    api = PluginAPI()

    spec = importlib.util.spec_from_file_location(f'plugin_{plug_id}', main_py)
    if spec is None or spec.loader is None:
        return {}
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    try:
        spec.loader.exec_module(module)
        if hasattr(module, 'register'):
            module.register(api)
    except Exception as e:
        api.log(f'error loading plugin: {e}')
        return {'error': str(e)}
    return exports


def load_all_plugins() -> dict:
    """Load every plugin in the extensions directory."""
    result = {}
    for p in list_plugins():
        try:
            result[p['id']] = load_plugin(p['id'])
        except Exception as e:
            result[p['id']] = {'error': str(e)}
    return result