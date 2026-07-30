"""MCP server tests covering all 8 tools."""
import json
import io

import pytest

from backend.mcp_server import SimpleMCP, TOOL_DESCRIPTIONS, _call_tool, _ui_context


def _make_mcp():
    """Return a SimpleMCP with stdout/stderr captured so we can read its responses."""
    mcp = SimpleMCP()
    mcp._stdout = io.StringIO()
    mcp._send_orig = mcp._send
    def send(rid, result):
        mcp._stdout.write(json.dumps({'jsonrpc': '2.0', 'id': rid, 'result': result}) + '\n')
    mcp._send = send
    return mcp


def _responses(mcp):
    out = mcp._stdout.getvalue()
    msgs = []
    for line in out.splitlines():
        if line.strip().startswith('{'):
            try:
                msgs.append(json.loads(line))
            except json.JSONDecodeError:
                pass
    return msgs


@pytest.fixture
def workspace_id(isolated_config_dir):
    """Create a workspace for MCP tests using the real backend modules."""
    from backend import workspace_manager as wm
    from backend import file_manager as fm

    ws = wm.create_workspace("MCP Test")
    fm.write_file(ws['id'], 'markdown/a.md', '# Title\nContent here')
    fm.write_file(ws['id'], 'text/note.txt', 'plain text')
    return ws['id']


# --- Direct module-function tests ---

def test_ui_context_function(workspace_id):
    result = _ui_context(workspace_id)
    assert 'focusedWindow' in result
    assert 'viewport' in result
    assert 'openedFiles' in result


def test_ui_context_missing_workspace_raises():
    with pytest.raises(ValueError):
        _ui_context('ws_nope')


def test_call_tool_unknown_raises():
    with pytest.raises(ValueError):
        _call_tool('nonsense_tool', {})


def test_call_tool_workspace_list(workspace_id):
    result = _call_tool('workspace_list', {})
    assert any(w['id'] == workspace_id for w in result)


def test_call_tool_workspace_read(workspace_id):
    result = _call_tool('workspace_read', {'workspaceId': workspace_id})
    assert result['id'] == workspace_id


def test_call_tool_workspace_read_missing():
    result = _call_tool('workspace_read', {'workspaceId': 'ws_nope'})
    assert result is None


def test_call_tool_workspace_update(workspace_id):
    new_windows = [{'id': 'wnd_x', 'type': 'text', 'title': 'X', 'x': 0, 'y': 0, 'width': 100, 'height': 100, 'zIndex': 1, 'minimized': False, 'maximized': False, 'file': None, 'metadata': {}}]
    result = _call_tool('workspace_update', {'workspaceId': workspace_id, 'windows': new_windows, 'settings': {'zoom': 2.0}})
    assert 'updatedAt' in result


def test_call_tool_workspace_update_missing_raises():
    with pytest.raises(ValueError):
        _call_tool('workspace_update', {'workspaceId': 'ws_nope', 'windows': []})


def test_call_tool_file_read(workspace_id):
    result = _call_tool('file_read', {'workspaceId': workspace_id, 'path': 'markdown/a.md'})
    assert 'Title' in result['content']


def test_call_tool_file_read_missing(workspace_id):
    result = _call_tool('file_read', {'workspaceId': workspace_id, 'path': 'markdown/nope.md'})
    assert result is None


def test_call_tool_file_write(workspace_id):
    result = _call_tool('file_write', {'workspaceId': workspace_id, 'path': 'markdown/new.md', 'content': '# Brand New'})
    assert result['path'] == 'markdown/new.md'
    assert result['size'] > 0


def test_call_tool_file_write_invalid_raises(workspace_id):
    with pytest.raises(ValueError):
        _call_tool('file_write', {'workspaceId': workspace_id, 'path': '../escape.txt', 'content': 'x'})


def test_call_tool_file_list(workspace_id):
    result = _call_tool('file_list', {'workspaceId': workspace_id, 'dir': 'markdown'})
    names = {e['name'] for e in result['entries']}
    assert 'a.md' in names


def test_call_tool_file_list_missing_raises(workspace_id):
    with pytest.raises(ValueError):
        _call_tool('file_list', {'workspaceId': workspace_id, 'dir': 'nope'})


def test_call_tool_file_delete(workspace_id):
    result = _call_tool('file_delete', {'workspaceId': workspace_id, 'path': 'markdown/a.md'})
    assert result['deleted'] is True


def test_call_tool_file_delete_missing_raises(workspace_id):
    with pytest.raises(ValueError):
        _call_tool('file_delete', {'workspaceId': workspace_id, 'path': 'markdown/nope.md'})


def test_call_tool_ui_context(workspace_id):
    result = _call_tool('ui_context', {'workspaceId': workspace_id})
    assert 'focusedWindow' in result
    assert 'viewport' in result
    assert 'openedFiles' in result


# --- SimpleMCP server JSON-RPC tests ---

def test_tool_descriptions_has_all_eight():
    names = {t['name'] for t in TOOL_DESCRIPTIONS}
    assert names == {
        'workspace_list', 'workspace_read', 'workspace_update',
        'file_read', 'file_write', 'file_list', 'file_delete', 'ui_context',
    }


def test_simple_mcp_tools_list(workspace_id):
    mcp = _make_mcp()
    mcp.handle_line(json.dumps({'jsonrpc': '2.0', 'id': 1, 'method': 'tools/list', 'params': {}}))
    resps = _responses(mcp)
    assert resps[0]['result']['tools'] == TOOL_DESCRIPTIONS


def test_simple_mcp_initialize(workspace_id):
    mcp = _make_mcp()
    mcp.handle_line(json.dumps({'jsonrpc': '2.0', 'id': 7, 'method': 'initialize', 'params': {}}))
    resps = _responses(mcp)
    assert resps[0]['id'] == 7
    assert 'protocolVersion' in resps[0]['result']


def test_simple_mcp_workspace_list(workspace_id):
    mcp = _make_mcp()
    mcp.handle_line(json.dumps({
        'jsonrpc': '2.0', 'id': 3, 'method': 'tools/call',
        'params': {'name': 'workspace_list', 'arguments': {}},
    }))
    resps = _responses(mcp)
    payload = json.loads(resps[0]['result']['content'][0]['text'])
    assert any(w['id'] == workspace_id for w in payload)


def test_simple_mcp_workspace_read(workspace_id):
    mcp = _make_mcp()
    mcp.handle_line(json.dumps({
        'jsonrpc': '2.0', 'id': 3, 'method': 'tools/call',
        'params': {'name': 'workspace_read', 'arguments': {'workspaceId': workspace_id}},
    }))
    resps = _responses(mcp)
    payload = json.loads(resps[0]['result']['content'][0]['text'])
    assert payload['id'] == workspace_id


def test_simple_mcp_workspace_update(workspace_id):
    mcp = _make_mcp()
    mcp.handle_line(json.dumps({
        'jsonrpc': '2.0', 'id': 3, 'method': 'tools/call',
        'params': {'name': 'workspace_update', 'arguments': {'workspaceId': workspace_id, 'settings': {'zoom': 3.0}}},
    }))
    resps = _responses(mcp)
    payload = json.loads(resps[0]['result']['content'][0]['text'])
    assert 'updatedAt' in payload


def test_simple_mcp_file_read(workspace_id):
    mcp = _make_mcp()
    mcp.handle_line(json.dumps({
        'jsonrpc': '2.0', 'id': 3, 'method': 'tools/call',
        'params': {'name': 'file_read', 'arguments': {'workspaceId': workspace_id, 'path': 'markdown/a.md'}},
    }))
    resps = _responses(mcp)
    payload = json.loads(resps[0]['result']['content'][0]['text'])
    assert 'Title' in payload['content']


def test_simple_mcp_file_write(workspace_id):
    mcp = _make_mcp()
    mcp.handle_line(json.dumps({
        'jsonrpc': '2.0', 'id': 3, 'method': 'tools/call',
        'params': {'name': 'file_write', 'arguments': {'workspaceId': workspace_id, 'path': 'markdown/z.md', 'content': 'hi'}},
    }))
    resps = _responses(mcp)
    payload = json.loads(resps[0]['result']['content'][0]['text'])
    assert payload['path'] == 'markdown/z.md'


def test_simple_mcp_file_list(workspace_id):
    mcp = _make_mcp()
    mcp.handle_line(json.dumps({
        'jsonrpc': '2.0', 'id': 3, 'method': 'tools/call',
        'params': {'name': 'file_list', 'arguments': {'workspaceId': workspace_id, 'dir': 'markdown'}},
    }))
    resps = _responses(mcp)
    payload = json.loads(resps[0]['result']['content'][0]['text'])
    assert 'a.md' in {e['name'] for e in payload['entries']}


def test_simple_mcp_file_delete(workspace_id):
    mcp = _make_mcp()
    mcp.handle_line(json.dumps({
        'jsonrpc': '2.0', 'id': 3, 'method': 'tools/call',
        'params': {'name': 'file_delete', 'arguments': {'workspaceId': workspace_id, 'path': 'markdown/a.md'}},
    }))
    resps = _responses(mcp)
    payload = json.loads(resps[0]['result']['content'][0]['text'])
    assert payload['deleted'] is True


def test_simple_mcp_ui_context(workspace_id):
    mcp = _make_mcp()
    mcp.handle_line(json.dumps({
        'jsonrpc': '2.0', 'id': 3, 'method': 'tools/call',
        'params': {'name': 'ui_context', 'arguments': {'workspaceId': workspace_id}},
    }))
    resps = _responses(mcp)
    payload = json.loads(resps[0]['result']['content'][0]['text'])
    assert 'focusedWindow' in payload


def test_simple_mcp_unknown_tool_returns_error():
    mcp = _make_mcp()
    mcp.handle_line(json.dumps({
        'jsonrpc': '2.0', 'id': 3, 'method': 'tools/call',
        'params': {'name': 'nonsense', 'arguments': {}},
    }))
    resps = _responses(mcp)
    assert resps[0]['result']['isError'] is True


def test_simple_mcp_unknown_method_returns_empty():
    mcp = _make_mcp()
    mcp.handle_line(json.dumps({
        'jsonrpc': '2.0', 'id': 99, 'method': 'totally/unknown', 'params': {},
    }))
    resps = _responses(mcp)
    assert resps[0]['result'] == {}


def test_simple_mcp_invalid_json_silently_ignored():
    mcp = _make_mcp()
    # Should not raise
    mcp.handle_line('NOT_JSON{')
    assert _responses(mcp) == []