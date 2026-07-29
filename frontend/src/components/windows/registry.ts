import type { ComponentType } from 'react';
import type { WindowState } from '../../types';
import { MarkdownWindow } from './MarkdownWindow';
import { TextWindow } from './TextWindow';
import { HtmlWindow } from './HtmlWindow';
import { ImageWindow } from './ImageWindow';
import { FileExplorer } from './FileExplorer';

export interface WindowProps {
  window: WindowState;
}

interface WindowDescriptor {
  component: ComponentType<WindowProps>;
  label: string;
  icon: string;
  extensions?: string[];
}

const registry = new Map<string, WindowDescriptor>();

export function registerWindowType(type: string, descriptor: WindowDescriptor) {
  registry.set(type, descriptor);
}

export function getWindowComponent(type: string): ComponentType<WindowProps> | undefined {
  return registry.get(type)?.component;
}

export function getWindowLabel(type: string): string {
  return registry.get(type)?.label ?? type;
}

export function getTypeForExtension(ext: string): string | undefined {
  for (const [type, desc] of registry) {
    if (desc.extensions?.includes(ext)) return type;
  }
  return undefined;
}

export function getAllTypes(): { type: string; label: string; icon: string }[] {
  return Array.from(registry.entries()).map(([type, desc]) => ({
    type,
    label: desc.label,
    icon: desc.icon,
  }));
}

registerWindowType('markdown', {
  component: MarkdownWindow,
  label: 'Markdown',
  icon: 'M',
  extensions: ['md', 'mdx'],
});

registerWindowType('text', {
  component: TextWindow,
  label: 'Text',
  icon: 'T',
  extensions: ['txt', 'log', 'cfg', 'ini', 'conf'],
});

registerWindowType('html', {
  component: HtmlWindow,
  label: 'HTML Preview',
  icon: 'H',
  extensions: ['html', 'htm'],
});

registerWindowType('image', {
  component: ImageWindow,
  label: 'Image Viewer',
  icon: 'I',
  extensions: ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'],
});

registerWindowType('explorer', {
  component: FileExplorer,
  label: 'File Explorer',
  icon: 'F',
});
