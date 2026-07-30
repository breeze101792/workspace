#!/usr/bin/env python
"""Workspace CLI — manage workspaces from the terminal.

Usage:
  workspace list
  workspace create <name>
  workspace show <id>
  workspace delete <id>
  workspace export <id> [output.zip]
  workspace import <zipfile> [--name NAME]
  workspace search <id> <query>
"""
import argparse
import json
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))

from backend import workspace_manager as wm
from backend import file_manager as fm


def cmd_list(args):
    items = wm.list_workspaces()
    if args.json:
        print(json.dumps(items, indent=2))
        return
    if not items:
        print('No workspaces.')
        return
    for item in items:
        print(f"{item['id']}\t{item['name']}\t{item.get('updatedAt', '')}")


def cmd_create(args):
    ws = wm.create_workspace(args.name)
    print(ws['id'])


def cmd_show(args):
    ws = wm.get_workspace(args.id)
    if not ws:
        print(f'Workspace {args.id} not found', file=sys.stderr)
        sys.exit(1)
    if args.json:
        print(json.dumps(ws, indent=2))
    else:
        print(f"id: {ws['id']}")
        print(f"name: {ws['name']}")
        print(f"windows: {len(ws.get('windows', []))}")
        print(f"settings: {json.dumps(ws.get('settings', {}))}")


def cmd_delete(args):
    if not wm.delete_workspace(args.id):
        print(f'Workspace {args.id} not found', file=sys.stderr)
        sys.exit(1)
    print(f'Deleted {args.id}')


def cmd_export(args):
    data = wm.export_workspace(args.id)
    if data is None:
        print(f'Workspace {args.id} not found', file=sys.stderr)
        sys.exit(1)
    out = args.output or f'{args.id}.zip'
    with open(out, 'wb') as f:
        f.write(data)
    print(f'Exported to {out}')


def cmd_import(args):
    with open(args.zipfile, 'rb') as f:
        data = f.read()
    name = args.name or os.path.splitext(os.path.basename(args.zipfile))[0]
    ws = wm.import_workspace(name, data)
    if not ws:
        print(f'Failed to import {args.zipfile}', file=sys.stderr)
        sys.exit(1)
    print(ws['id'])


def cmd_search(args):
    results = fm.search_files(args.id, args.query)
    if args.json:
        print(json.dumps(results, indent=2))
    else:
        for r in results:
            print(f"{r['path']}:{r['line']}: {r['text']}")


def cmd_read(args):
    content = fm.read_file(args.id, args.path)
    if not content:
        print(f'File {args.path} not found', file=sys.stderr)
        sys.exit(1)
    print(content['content'])


def main():
    parser = argparse.ArgumentParser(description='Workspace CLI')
    parser.add_argument('--config-dir', help='Override config directory')
    args, remaining = parser.parse_known_args()

    if args.config_dir:
        from backend import safe_fs
        safe_fs.CONFIG_DIR = type(safe_fs.CONFIG_DIR)(args.config_dir)
        safe_fs.WORKSPACES_DIR = safe_fs.CONFIG_DIR / 'workspaces'

    sub = parser.add_subparsers(dest='cmd', required=True)

    p_list = sub.add_parser('list', help='List workspaces')
    p_list.add_argument('--json', action='store_true')
    p_list.set_defaults(func=cmd_list)

    p_create = sub.add_parser('create', help='Create a workspace')
    p_create.add_argument('name')
    p_create.set_defaults(func=cmd_create)

    p_show = sub.add_parser('show', help='Show workspace details')
    p_show.add_argument('id')
    p_show.add_argument('--json', action='store_true')
    p_show.set_defaults(func=cmd_show)

    p_delete = sub.add_parser('delete', help='Delete a workspace')
    p_delete.add_argument('id')
    p_delete.set_defaults(func=cmd_delete)

    p_export = sub.add_parser('export', help='Export workspace to zip')
    p_export.add_argument('id')
    p_export.add_argument('output', nargs='?')
    p_export.set_defaults(func=cmd_export)

    p_import = sub.add_parser('import', help='Import workspace from zip')
    p_import.add_argument('zipfile')
    p_import.add_argument('--name')
    p_import.set_defaults(func=cmd_import)

    p_search = sub.add_parser('search', help='Search files in workspace')
    p_search.add_argument('id')
    p_search.add_argument('query')
    p_search.add_argument('--json', action='store_true')
    p_search.set_defaults(func=cmd_search)

    p_read = sub.add_parser('read', help='Read a file from a workspace')
    p_read.add_argument('id')
    p_read.add_argument('path')
    p_read.set_defaults(func=cmd_read)

    args = parser.parse_args()
    args.func(args)


if __name__ == '__main__':
    main()