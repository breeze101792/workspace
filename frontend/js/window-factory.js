import * as api from './api.js';

const registry = {};

export function registerWindowType(type, descriptor) {
  registry[type] = descriptor;
}

export function renderWindowContent(win) {
  const renderer = registry[win.type];
  if (!renderer) return;
  const container = document.getElementById(`wnd-${win.id}-content`);
  if (!container) return;
  container.innerHTML = '';
  renderer(win, container);
}

async function _loadFile(wsId, filePath) {
  if (!wsId || !filePath) return null;
  const res = await api.get(`/api/workspaces/${wsId}/files/${filePath}`);
  if (res.ok) return res.data.content;
  return null;
}

// Markdown
registerWindowType('markdown', async (win, el) => {
  el.innerHTML = '<div class="wnd-loading">Loading...</div>';
  const content = await _loadFile(win._wsId, win.file);
  if (!content) { el.innerHTML = '<div class="wnd-empty">No file</div>'; return; }

  if (window.marked) {
    el.innerHTML = `<div class="markdown-body">${window.marked.parse(content)}</div>`;
    if (window.hljs) {
      el.querySelectorAll('pre code').forEach(b => hljs.highlightElement(b));
    }
  } else {
    el.innerHTML = `<pre class="text-body">${content}</pre>`;
  }
});

// Text
registerWindowType('text', async (win, el) => {
  el.innerHTML = '<div class="wnd-loading">Loading...</div>';
  const content = await _loadFile(win._wsId, win.file);
  if (!content) { el.innerHTML = '<div class="wnd-empty">No file</div>'; return; }
  el.innerHTML = `<pre class="text-body">${content}</pre>`;
});

// HTML
registerWindowType('html', async (win, el) => {
  el.innerHTML = '<div class="wnd-loading">Loading...</div>';
  const content = await _loadFile(win._wsId, win.file);
  if (!content) { el.innerHTML = '<div class="wnd-empty">No file</div>'; return; }
  const iframe = document.createElement('iframe');
  iframe.className = 'html-iframe';
  iframe.sandbox = 'allow-same-origin';
  iframe.srcdoc = content;
  el.innerHTML = '';
  el.appendChild(iframe);
});

// Image
registerWindowType('image', (win, el) => {
  if (!win._wsId || !win.file) {
    el.innerHTML = '<div class="wnd-empty">No file</div>';
    return;
  }
  el.innerHTML = `<img class="image-body" src="/api/workspaces/${win._wsId}/files/${win.file}" alt="${win.title}">`;
});

// File Explorer
registerWindowType('explorer', (win, el) => {
  el.innerHTML = '<div class="wnd-loading">Loading...</div>';
  _renderExplorer(win._wsId, el, '');
});

async function _renderExplorer(wsId, el, dir) {
  const res = await api.get(`/api/workspaces/${wsId}/files?dir=${encodeURIComponent(dir)}`);
  if (!res.ok) { el.innerHTML = '<div class="wnd-empty">Error loading files</div>'; return; }

  let html = '';
  if (dir) {
    const parent = dir.split('/').slice(0, -1).join('/');
    html += `<div class="explorer-item" data-path="${parent}">📁 ..</div>`;
  }
  for (const entry of res.data.entries) {
    const icon = entry.type === 'directory' ? '📁' : '📄';
    const fullPath = dir ? `${dir}/${entry.name}` : entry.name;
    html += `<div class="explorer-item" data-path="${fullPath}" data-type="${entry.type}">${icon} ${entry.name}</div>`;
  }
  el.innerHTML = html;

  el.querySelectorAll('.explorer-item').forEach(item => {
    item.addEventListener('dblclick', () => {
      const path = item.dataset.path;
      const type = item.dataset.type;
      if (type === 'directory') {
        _renderExplorer(wsId, el, path);
      } else {
        const ext = path.split('.').pop().toLowerCase();
        const typeMap = { md: 'markdown', txt: 'text', html: 'html', htm: 'html', png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', svg: 'image', webp: 'image' };
        const wndType = typeMap[ext] || 'text';
        const id = 'wnd_' + Math.random().toString(36).slice(2, 10);
        window._openWindow({ id, type: wndType, title: entry.name, x: 200, y: 200, width: 600, height: 400, file: path, filePath: path, zIndex: 100, minimized: false, maximized: false, metadata: {} });
      }
    });
  });
}
