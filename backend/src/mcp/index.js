import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import * as workspaceManager from '../services/workspace-manager.js';
import * as fileManager from '../services/file-manager.js';
import config from '../config.js';

export function createMCPServer() {
  const server = new Server(
    { name: 'workspace-mcp', version: '0.1.0' },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'workspace_list',
        description: 'List all available workspaces',
        inputSchema: { type: 'object', properties: {}, required: [] },
      },
      {
        name: 'workspace_read',
        description: 'Read full workspace state including all windows and settings',
        inputSchema: {
          type: 'object',
          properties: { workspaceId: { type: 'string' } },
          required: ['workspaceId'],
        },
      },
      {
        name: 'workspace_update',
        description: 'Update workspace windows or settings',
        inputSchema: {
          type: 'object',
          properties: {
            workspaceId: { type: 'string' },
            windows: { type: 'array' },
            settings: { type: 'object' },
          },
          required: ['workspaceId'],
        },
      },
      {
        name: 'file_read',
        description: 'Read a file from the workspace',
        inputSchema: {
          type: 'object',
          properties: {
            workspaceId: { type: 'string' },
            path: { type: 'string' },
          },
          required: ['workspaceId', 'path'],
        },
      },
      {
        name: 'file_write',
        description: 'Write content to a file in the workspace',
        inputSchema: {
          type: 'object',
          properties: {
            workspaceId: { type: 'string' },
            path: { type: 'string' },
            content: { type: 'string' },
          },
          required: ['workspaceId', 'path', 'content'],
        },
      },
      {
        name: 'file_list',
        description: 'List files and directories in a workspace directory',
        inputSchema: {
          type: 'object',
          properties: {
            workspaceId: { type: 'string' },
            dir: { type: 'string' },
          },
          required: ['workspaceId'],
        },
      },
      {
        name: 'file_delete',
        description: 'Delete a file in the workspace',
        inputSchema: {
          type: 'object',
          properties: {
            workspaceId: { type: 'string' },
            path: { type: 'string' },
          },
          required: ['workspaceId', 'path'],
        },
      },
      {
        name: 'ui_context',
        description: 'Get current UI context: focused window, viewport, opened files',
        inputSchema: {
          type: 'object',
          properties: { workspaceId: { type: 'string' } },
          required: ['workspaceId'],
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case 'workspace_list': {
          const workspaces = await workspaceManager.listWorkspaces();
          return { content: [{ type: 'text', text: JSON.stringify(workspaces, null, 2) }] };
        }
        case 'workspace_read': {
          const ws = await workspaceManager.getWorkspace(args.workspaceId);
          return { content: [{ type: 'text', text: JSON.stringify(ws, null, 2) }] };
        }
        case 'workspace_update': {
          const updates = {};
          if (args.windows) updates.windows = args.windows;
          if (args.settings) updates.settings = args.settings;
          const result = await workspaceManager.updateWorkspace(args.workspaceId, updates);
          return { content: [{ type: 'text', text: JSON.stringify(result) }] };
        }
        case 'file_read': {
          const result = await fileManager.readWorkspaceFile(args.workspaceId, args.path, config.WORKSPACES_DIR);
          return { content: [{ type: 'text', text: result.content }] };
        }
        case 'file_write': {
          const result = await fileManager.writeWorkspaceFile(args.workspaceId, args.path, args.content, config.WORKSPACES_DIR);
          return { content: [{ type: 'text', text: JSON.stringify(result) }] };
        }
        case 'file_list': {
          const entries = await fileManager.listWorkspaceFiles(args.workspaceId, args.dir || '', config.WORKSPACES_DIR);
          return { content: [{ type: 'text', text: JSON.stringify(entries, null, 2) }] };
        }
        case 'file_delete': {
          const result = await fileManager.deleteWorkspaceFile(args.workspaceId, args.path, config.WORKSPACES_DIR);
          return { content: [{ type: 'text', text: JSON.stringify(result) }] };
        }
        case 'ui_context': {
          const ws = await workspaceManager.getWorkspace(args.workspaceId);
          const focused = ws.windows.reduce((best, w) => (!best || w.zIndex > best.zIndex) ? w : best, null);
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                focusedWindow: focused ? { id: focused.id, type: focused.type, title: focused.title, file: focused.file } : null,
                viewport: ws.settings,
                openedFiles: ws.windows.filter(w => w.file).map(w => ({ id: w.id, file: w.file, type: w.type })),
              }, null, 2),
            }],
          };
        }
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (e) {
      return {
        content: [{ type: 'text', text: `Error: ${e.message}` }],
        isError: true,
      };
    }
  });

  return server;
}

export async function startMCPServer() {
  const server = createMCPServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
