import sys
import os
import json
import argparse

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.workspace_manager import list_workspaces, get_workspace, update_workspace
from backend.file_manager import read_file, write_file, delete_file, list_files as fm_list_files


def _ui_context(workspace_id):
    ws = get_workspace(workspace_id)
    if not ws:
        raise ValueError(f'Workspace {workspace_id} not found')
    windows = ws.get('windows', [])
    focused = None
    max_z = -1
    for w in windows:
        if w.get('zIndex', 0) > max_z and not w.get('minimized', False):
            max_z = w['zIndex']
            focused = w
    settings = ws.get('settings', {})
    return {
        'focusedWindow': focused,
        'viewport': {'x': settings.get('viewportX', 0), 'y': settings.get('viewportY', 0), 'zoom': settings.get('zoom', 1.0)},
        'openedFiles': [w.get('file') for w in windows if w.get('file')],
    }


def _call_tool(name, args):
    if name == 'workspace_list':
        return list_workspaces()
    elif name == 'workspace_read':
        return get_workspace(args['workspaceId'])
    elif name == 'workspace_update':
        ws = get_workspace(args['workspaceId'])
        if not ws:
            raise ValueError(f'Workspace {args["workspaceId"]} not found')
        if 'windows' in args:
            ws['windows'] = args['windows']
        if 'settings' in args:
            ws['settings'] = args['settings']
        update_workspace(args['workspaceId'], ws)
        return {'updatedAt': ws.get('updatedAt', '')}
    elif name == 'file_read':
        return read_file(args['workspaceId'], args['path'])
    elif name == 'file_write':
        result = write_file(args['workspaceId'], args['path'], args['content'])
        if not result:
            raise ValueError(f"Cannot write to {args['path']}")
        return result
    elif name == 'file_list':
        result = fm_list_files(args['workspaceId'], args.get('dir', ''))
        if not result:
            raise ValueError(f"Directory not found")
        return result
    elif name == 'file_delete':
        ok = delete_file(args['workspaceId'], args['path'])
        if not ok:
            raise ValueError(f"Cannot delete {args['path']}")
        return {'deleted': ok}
    elif name == 'ui_context':
        return _ui_context(args['workspaceId'])
    raise ValueError(f'Unknown tool: {name}')


TOOL_DESCRIPTIONS = [
    {'name': 'workspace_list', 'description': 'List all workspaces', 'inputSchema': {'type': 'object', 'properties': {}}},
    {'name': 'workspace_read', 'description': 'Read workspace', 'inputSchema': {'type': 'object', 'properties': {'workspaceId': {'type': 'string'}}, 'required': ['workspaceId']}},
    {'name': 'workspace_update', 'description': 'Update workspace', 'inputSchema': {'type': 'object', 'properties': {'workspaceId': {'type': 'string'}, 'windows': {'type': 'array'}, 'settings': {'type': 'object'}}, 'required': ['workspaceId']}},
    {'name': 'file_read', 'description': 'Read file', 'inputSchema': {'type': 'object', 'properties': {'workspaceId': {'type': 'string'}, 'path': {'type': 'string'}}, 'required': ['workspaceId', 'path']}},
    {'name': 'file_write', 'description': 'Write file', 'inputSchema': {'type': 'object', 'properties': {'workspaceId': {'type': 'string'}, 'path': {'type': 'string'}, 'content': {'type': 'string'}}, 'required': ['workspaceId', 'path', 'content']}},
    {'name': 'file_list', 'description': 'List directory', 'inputSchema': {'type': 'object', 'properties': {'workspaceId': {'type': 'string'}, 'dir': {'type': 'string'}}, 'required': ['workspaceId']}},
    {'name': 'file_delete', 'description': 'Delete file', 'inputSchema': {'type': 'object', 'properties': {'workspaceId': {'type': 'string'}, 'path': {'type': 'string'}}, 'required': ['workspaceId', 'path']}},
    {'name': 'ui_context', 'description': 'Get UI context', 'inputSchema': {'type': 'object', 'properties': {'workspaceId': {'type': 'string'}}, 'required': ['workspaceId']}},
]


class SimpleMCP:
    """Minimal JSON-RPC stdio MCP server. Exposed for testing and fallback."""

    def run(self):
        for line in sys.stdin:
            self.handle_line(line)

    def handle_line(self, line):
        try:
            msg = json.loads(line)
        except json.JSONDecodeError:
            return
        method = msg.get('method', '')
        params = msg.get('params', {})
        rid = msg.get('id')

        if method == 'tools/list':
            self._send(rid, {'tools': TOOL_DESCRIPTIONS})
        elif method == 'tools/call':
            tool = params.get('name', '')
            args = params.get('arguments', {})
            try:
                result = _call_tool(tool, args)
                self._send(rid, {'content': [{'type': 'text', 'text': json.dumps(result)}]})
            except Exception as e:
                self._send(rid, {'isError': True, 'content': [{'type': 'text', 'text': str(e)}]})
        elif method == 'initialize':
            self._send(rid, {'protocolVersion': '0.1.0', 'capabilities': {'tools': {}}})
        else:
            self._send(rid, {})

    def _send(self, rid, result):
        sys.stdout.write(json.dumps({'jsonrpc': '2.0', 'id': rid, 'result': result}) + '\n')
        sys.stdout.flush()


try:
    from mcp.server import MCPServer

    mcp = MCPServer("Workspace")

    @mcp.tool()
    def workspace_list() -> list[dict]:
        """List all available workspaces."""
        return list_workspaces()

    @mcp.tool()
    def workspace_read(workspaceId: str) -> dict:
        """Read full workspace state."""
        ws = get_workspace(workspaceId)
        if not ws:
            raise ValueError(f"Workspace {workspaceId} not found")
        return ws

    @mcp.tool()
    def workspace_update(workspaceId: str, windows: list | None = None, settings: dict | None = None) -> dict:
        """Update workspace windows or settings."""
        ws = get_workspace(workspaceId)
        if not ws:
            raise ValueError(f"Workspace {workspaceId} not found")
        if windows is not None:
            ws['windows'] = windows
        if settings is not None:
            ws['settings'] = settings
        update_workspace(workspaceId, ws)
        return {"updatedAt": ws.get("updatedAt", "")}

    @mcp.tool()
    def file_read(workspaceId: str, path: str) -> dict:
        """Read a file from the workspace."""
        result = read_file(workspaceId, path)
        if not result:
            raise ValueError(f"File {path} not found")
        return result

    @mcp.tool()
    def file_write(workspaceId: str, path: str, content: str) -> dict:
        """Write content to a file."""
        result = write_file(workspaceId, path, content)
        if not result:
            raise ValueError(f"Cannot write to {path}")
        return result

    @mcp.tool()
    def file_list(workspaceId: str, dir: str = '') -> dict:
        """List directory contents."""
        result = fm_list_files(workspaceId, dir)
        if not result:
            raise ValueError(f"Directory not found")
        return result

    @mcp.tool()
    def file_delete(workspaceId: str, path: str) -> dict:
        """Delete a file."""
        ok = delete_file(workspaceId, path)
        if not ok:
            raise ValueError(f"Cannot delete {path}")
        return {"deleted": True}

    @mcp.tool()
    def ui_context(workspaceId: str) -> dict:
        """Get current UI context (focused window, viewport, etc)."""
        return _ui_context(workspaceId)

    if __name__ == '__main__':  # pragma: no cover
        parser = argparse.ArgumentParser(description='Workspace MCP Server')
        parser.add_argument('--host', default='127.0.0.1', help='Bind address')
        parser.add_argument('--port', type=int, default=5011, help='Port')
        parser.add_argument('--transport', choices=['stdio', 'sse'], default='sse', help='Transport protocol')
        args = parser.parse_args()
        mcp.run(transport=args.transport, host=args.host, port=args.port)

except ImportError:  # pragma: no cover
    if __name__ == '__main__':  # pragma: no cover
        parser = argparse.ArgumentParser(description='Workspace MCP Server (stdio fallback)')
        parser.add_argument('--host', default='127.0.0.1')
        parser.add_argument('--port', type=int, default=5011)
        parser.add_argument('--transport', choices=['stdio', 'sse'], default='stdio')
        args = parser.parse_args()
        if args.transport != 'stdio':
            print('SSE transport requires mcp package', file=sys.stderr)
            sys.exit(1)
        SimpleMCP().run()
        sys.exit(0)