"""Tests for the static agent guide served at GET /agent.md."""


def test_agent_md_served(client):
    res = client.get('/agent.md')
    assert res.status_code == 200
    text = res.get_data(as_text=True)
    assert text.startswith('# Agent Guide')
    assert 'Cache-Control' in res.headers
    assert res.headers['Cache-Control'] == 'no-cache'


def test_agent_md_covers_all_transports(client):
    text = client.get('/agent.md').get_data(as_text=True)
    for section in ('## Transports', '## REST Endpoints', '## MCP Tools',
                    '## WebSocket Protocol', '## Getting Started'):
        assert section in text, section
    assert '`window:open`' in text
    assert '`ui_context`' in text


def test_agent_md_documents_real_mcp_tools(client):
    """Every MCP tool the server advertises must appear in agent.md."""
    from backend.mcp_server import TOOL_DESCRIPTIONS
    text = client.get('/agent.md').get_data(as_text=True)
    for tool in TOOL_DESCRIPTIONS:
        assert f'`{tool["name"]}`' in text, tool['name']
