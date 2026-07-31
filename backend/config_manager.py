import copy
from . import safe_fs


def _config_path():
    return safe_fs.CONFIG_DIR / 'config.json'


DEFAULT_CONFIG = {
    "version": 1,
    "activeWorkspace": None,
    "theme": "dark",
    "language": "en",
    "workspaces": [],
}


def read_config() -> dict:
    cf = _config_path()
    if not cf.exists():
        return copy.deepcopy(DEFAULT_CONFIG)
    try:
        return safe_fs.atomic_read(cf)
    except (ValueError, OSError):
        return copy.deepcopy(DEFAULT_CONFIG)


def write_config(config: dict) -> dict:
    safe_fs.CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    merged = {**copy.deepcopy(DEFAULT_CONFIG), **config}
    safe_fs.atomic_write(_config_path(), merged)
    return merged


def set_active_workspace(ws_id: str):
    config = read_config()
    config['activeWorkspace'] = ws_id
    write_config(config)


def get_active_workspace() -> str | None:
    return read_config().get('activeWorkspace')


def add_workspace_to_list(ws_id: str):
    config = read_config()
    if ws_id not in config['workspaces']:
        config['workspaces'].append(ws_id)
    write_config(config)


def remove_workspace_from_list(ws_id: str):
    config = read_config()
    config['workspaces'] = [w for w in config['workspaces'] if w != ws_id]
    if config['activeWorkspace'] == ws_id:
        config['activeWorkspace'] = config['workspaces'][0] if config['workspaces'] else None
    write_config(config)
