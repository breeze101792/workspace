"""Tests for the @mcp.tool() decorated functions inside mcp_server.py."""
import pytest


def test_real_mcp_tools_registered():
    """All 8 tools should be registered with the real mcp.MCPServer instance."""
    import sys
    sys.path.insert(0, '/mnt/projects/webapp/workspace/backend')
    import backend.mcp_server as ms

    if not hasattr(ms, 'mcp'):
        pytest.skip("mcp package not available; can't test decorated tools")

    tools = ms.mcp._tool_manager._tools
    expected = {
        'workspace_list', 'workspace_read', 'workspace_update',
        'file_read', 'file_write', 'file_list', 'file_delete', 'ui_context',
    }
    assert set(tools.keys()) == expected


@pytest.fixture
def real_mcp_server(isolated_config_dir):
    """Get the real mcp.MCPServer instance if available, else skip."""
    import sys
    sys.path.insert(0, '/mnt/projects/webapp/workspace/backend')
    import backend.mcp_server as ms
    if not hasattr(ms, 'mcp'):
        pytest.skip("mcp package not available")
    yield ms


def test_real_mcp_tool_workspace_list(real_mcp_server):
    fn = real_mcp_server.mcp._tool_manager._tools['workspace_list'].fn
    result = fn()
    assert isinstance(result, list)


def test_real_mcp_tool_workspace_read(real_mcp_server):
    from backend import workspace_manager as wm
    ws = wm.create_workspace("Real MCP")
    fn = real_mcp_server.mcp._tool_manager._tools['workspace_read'].fn
    result = fn(workspaceId=ws['id'])
    assert result['id'] == ws['id']


def test_real_mcp_tool_workspace_read_missing(real_mcp_server):
    fn = real_mcp_server.mcp._tool_manager._tools['workspace_read'].fn
    with pytest.raises(ValueError):
        fn(workspaceId='ws_nope')


def test_real_mcp_tool_workspace_update(real_mcp_server):
    from backend import workspace_manager as wm
    ws = wm.create_workspace("Real MCP Update")
    fn = real_mcp_server.mcp._tool_manager._tools['workspace_update'].fn
    result = fn(workspaceId=ws['id'], settings={'zoom': 2.0})
    assert 'updatedAt' in result


def test_real_mcp_tool_workspace_update_missing(real_mcp_server):
    fn = real_mcp_server.mcp._tool_manager._tools['workspace_update'].fn
    with pytest.raises(ValueError):
        fn(workspaceId='ws_nope', settings={})


def test_real_mcp_tool_file_read(real_mcp_server):
    from backend import workspace_manager as wm
    from backend import file_manager as fm
    ws = wm.create_workspace("Real MCP Read")
    fm.write_file(ws['id'], 'markdown/x.md', 'data')
    fn = real_mcp_server.mcp._tool_manager._tools['file_read'].fn
    result = fn(workspaceId=ws['id'], path='markdown/x.md')
    assert result['content'] == 'data'


def test_real_mcp_tool_file_read_missing(real_mcp_server):
    from backend import workspace_manager as wm
    ws = wm.create_workspace("Real MCP Read Missing")
    fn = real_mcp_server.mcp._tool_manager._tools['file_read'].fn
    with pytest.raises(ValueError):
        fn(workspaceId=ws['id'], path='markdown/nope.md')


def test_real_mcp_tool_file_write(real_mcp_server):
    from backend import workspace_manager as wm
    ws = wm.create_workspace("Real MCP Write")
    fn = real_mcp_server.mcp._tool_manager._tools['file_write'].fn
    result = fn(workspaceId=ws['id'], path='markdown/new.md', content='# Brand New')
    assert result['path'] == 'markdown/new.md'


def test_real_mcp_tool_file_write_invalid(real_mcp_server):
    from backend import workspace_manager as wm
    ws = wm.create_workspace("Real MCP Write Bad")
    fn = real_mcp_server.mcp._tool_manager._tools['file_write'].fn
    with pytest.raises(ValueError):
        fn(workspaceId=ws['id'], path='../escape.txt', content='x')


def test_real_mcp_tool_file_list(real_mcp_server):
    from backend import workspace_manager as wm
    from backend import file_manager as fm
    ws = wm.create_workspace("Real MCP List")
    fm.write_file(ws['id'], 'markdown/a.md', 'x')
    fn = real_mcp_server.mcp._tool_manager._tools['file_list'].fn
    result = fn(workspaceId=ws['id'], dir='markdown')
    assert any(e['name'] == 'a.md' for e in result['entries'])


def test_real_mcp_tool_file_list_missing(real_mcp_server):
    from backend import workspace_manager as wm
    ws = wm.create_workspace("Real MCP List Missing")
    fn = real_mcp_server.mcp._tool_manager._tools['file_list'].fn
    with pytest.raises(ValueError):
        fn(workspaceId=ws['id'], dir='nope')


def test_real_mcp_tool_file_delete(real_mcp_server):
    from backend import workspace_manager as wm
    from backend import file_manager as fm
    ws = wm.create_workspace("Real MCP Delete")
    fm.write_file(ws['id'], 'markdown/x.md', 'x')
    fn = real_mcp_server.mcp._tool_manager._tools['file_delete'].fn
    result = fn(workspaceId=ws['id'], path='markdown/x.md')
    assert result['deleted'] is True


def test_real_mcp_tool_file_delete_missing(real_mcp_server):
    from backend import workspace_manager as wm
    ws = wm.create_workspace("Real MCP Delete Missing")
    fn = real_mcp_server.mcp._tool_manager._tools['file_delete'].fn
    with pytest.raises(ValueError):
        fn(workspaceId=ws['id'], path='markdown/nope.md')


def test_real_mcp_tool_ui_context(real_mcp_server):
    from backend import workspace_manager as wm
    ws = wm.create_workspace("Real MCP UI")
    fn = real_mcp_server.mcp._tool_manager._tools['ui_context'].fn
    result = fn(workspaceId=ws['id'])
    assert 'focusedWindow' in result
    assert 'viewport' in result
    assert 'openedFiles' in result