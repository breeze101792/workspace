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

  el.innerHTML = `<div class="markdown-body">${window.marked ? window.marked.parse(content) : `<pre>${content}</pre>`}</div>`;
  if (window.hljs) {
    el.querySelectorAll('pre code').forEach(b => hljs.highlightElement(b));
  }

  // Allow drop of workspace files (e.g., images) to insert markdown reference
  el.addEventListener('dragover', (e) => {
    if (e.dataTransfer.types.includes('text/x-workspace-path')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  });
  el.addEventListener('drop', async (e) => {
    const path = e.dataTransfer.getData('text/x-workspace-path');
    if (!path) return;
    e.preventDefault();
    const ext = path.split('.').pop().toLowerCase();
    const isImage = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext);
    const insertion = isImage ? `![](${path})` : `[${path.split('/').pop()}](${path})`;
    if (content && !content.endsWith('\n')) {
      await _appendToFile(win._wsId, win.file, '\n' + insertion + '\n');
    } else {
      await _appendToFile(win._wsId, win.file, insertion + '\n');
    }
    // Re-render
    const updated = await _loadFile(win._wsId, win.file);
    el.innerHTML = `<div class="markdown-body">${window.marked ? window.marked.parse(updated || '') : `<pre>${updated || ''}</pre>`}</div>`;
    if (window.hljs) {
      el.querySelectorAll('pre code').forEach(b => hljs.highlightElement(b));
    }
  });
});

async function _appendToFile(wsId, filePath, text) {
  const res = await api.get(`/api/workspaces/${wsId}/files/${filePath}`);
  if (!res.ok) return;
  await api.put(`/api/workspaces/${wsId}/files/${filePath}`, { content: (res.data.content || '') + text });
}

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

// Tabbed container - groups multiple windows into tabs
registerWindowType('tabbed', (win, el) => {
  el.innerHTML = `
    <div style="display:flex;flex-direction:column;height:100%">
      <div class="tab-strip" style="display:flex;background:rgba(0,0,0,0.4);border-bottom:1px solid var(--border);overflow-x:auto"></div>
      <div class="tab-content" style="flex:1;overflow:auto;padding:12px"></div>
    </div>
  `;
  const strip = el.querySelector('.tab-strip');
  const content = el.querySelector('.tab-content');
  const tabs = (win.metadata && win.metadata.tabs) || [];
  let activeIdx = (win.metadata && win.metadata.activeIdx) || 0;

  const renderTabs = () => {
    strip.innerHTML = tabs.map((t, i) =>
      `<div class="tab ${i === activeIdx ? 'tab-active' : ''}" data-idx="${i}" style="padding:6px 12px;cursor:pointer;font-size:12px;color:${i === activeIdx ? 'var(--accent)' : 'var(--text-dim)'};border-right:1px solid var(--border);white-space:nowrap">${t.title}</div>`
    ).join('');
    strip.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        activeIdx = parseInt(tab.dataset.idx);
        renderTabs();
      });
    });
    if (tabs[activeIdx]) {
      content.innerHTML = `<div><strong>${tabs[activeIdx].title}</strong></div><pre style="margin-top:8px;color:var(--text);white-space:pre-wrap;font-family:var(--font-mono);font-size:12px">${tabs[activeIdx].content || ''}</pre>`;
    } else {
      content.innerHTML = '<div style="color:var(--text-dim)">No tabs</div>';
    }
  };
  renderTabs();
});

// Search
registerWindowType('search', (win, el) => {
  el.innerHTML = `
    <div style="padding:12px;display:flex;flex-direction:column;height:100%;box-sizing:border-box">
      <div style="display:flex;gap:6px;margin-bottom:8px">
        <input type="text" id="search-input-${win.id}" placeholder="Search files..." style="flex:1;padding:6px 10px;background:rgba(0,0,0,0.4);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);font-size:12px;outline:none">
        <button id="search-btn-${win.id}" style="padding:6px 12px;background:var(--accent);color:#000;border:none;border-radius:var(--radius-sm);font-size:12px;cursor:pointer;font-weight:600">Go</button>
      </div>
      <div id="search-results-${win.id}" style="flex:1;overflow:auto;font-size:12px"></div>
    </div>
  `;
  const input = el.querySelector(`#search-input-${win.id}`);
  const btn = el.querySelector(`#search-btn-${win.id}`);
  const results = el.querySelector(`#search-results-${win.id}`);
  const doSearch = async () => {
    const q = input.value.trim();
    if (!q) { results.innerHTML = '<div style="color:var(--text-dim);padding:8px">Type to search...</div>'; return; }
    results.innerHTML = '<div style="color:var(--text-dim);padding:8px">Searching...</div>';
    const res = await api.get(`/api/workspaces/${win._wsId}/search?q=${encodeURIComponent(q)}`);
    if (!res.ok) { results.innerHTML = '<div style="color:var(--error);padding:8px">Search failed</div>'; return; }
    if (!res.data.length) { results.innerHTML = '<div style="color:var(--text-dim);padding:8px">No matches</div>'; return; }
    results.innerHTML = res.data.map(m =>
      `<div class="search-result" data-path="${m.path}" style="padding:6px 8px;border-bottom:1px solid var(--border);cursor:pointer">
        <div style="color:var(--accent);font-size:11px">${m.path}:${m.line}</div>
        <div style="color:var(---text);margin-top:2px">${m.text.replace(/</g, '&lt;')}</div>
      </div>`
    ).join('');
    results.querySelectorAll('.search-result').forEach(item => {
      item.addEventListener('dblclick', () => {
        const path = item.dataset.path;
        const ext = path.split('.').pop().toLowerCase();
        const typeMap = { md: 'markdown', txt: 'text', html: 'html', htm: 'html' };
        const wndType = typeMap[ext] || 'text';
        const id = 'wnd_' + Math.random().toString(36).slice(2, 10);
        window._openWindow({ id, type: wndType, title: path.split('/').pop(), x: 300, y: 300, width: 600, height: 400, file: path, filePath: path, zIndex: 100, minimized: false, maximized: false, metadata: {} });
      });
    });
  };
  btn.addEventListener('click', doSearch);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });
  input.focus();
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
    const draggable = entry.type === 'file' ? 'true' : 'false';
    html += `<div class="explorer-item" data-path="${fullPath}" data-type="${entry.type}" draggable="${draggable}">${icon} ${entry.name}</div>`;
  }
  el.innerHTML = html;

  el.querySelectorAll('.explorer-item').forEach(item => {
    item.addEventListener('dragstart', (e) => {
      if (item.dataset.type !== 'file') { e.preventDefault(); return; }
      e.dataTransfer.setData('text/x-workspace-path', item.dataset.path);
      e.dataTransfer.effectAllowed = 'copy';
    });
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
