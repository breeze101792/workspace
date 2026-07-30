import { useState, useEffect } from 'react';
import type { WindowProps } from './registry';
import type { FileEntry } from '../../types';
import * as filesApi from '../../api/files';
import { useWorkspace } from '../../state/workspaceContext';
import { useWindowManager } from '../../hooks/useWindowManager';
import { getTypeForExtension } from './registry';
import { showToast } from '../common/Toast';

export function FileExplorer({ window: win }: WindowProps) {
  const { state } = useWorkspace();
  const { addWindow } = useWindowManager();
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [currentDir, setCurrentDir] = useState('');
  const [loading, setLoading] = useState(true);

  const wsId = state.workspace?.id;

  useEffect(() => {
    if (!wsId) return;
    loadDir(currentDir);
  }, [wsId, currentDir]);

  async function loadDir(dir: string) {
    if (!wsId) return;
    setLoading(true);
    const res = await filesApi.listFiles(wsId, dir || undefined);
    if (res.ok) {
      setEntries(res.data.entries);
    }
    setLoading(false);
  }

  async function handleFileClick(entry: FileEntry) {
    if (entry.type === 'directory') {
      setCurrentDir(entry.name);
      return;
    }

    if (!wsId) return;

    const ext = entry.name.includes('.') ? entry.name.split('.').pop()?.toLowerCase() : '';
    const type = ext ? getTypeForExtension(ext) : undefined;

    if (type) {
      addWindow({
        type,
        title: entry.name,
        file: currentDir ? `${currentDir}/${entry.name}` : entry.name,
      });
    } else {
      showToast(`Cannot open .${ext} files in V1`, 'error');
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!wsId || !e.target.files?.length) return;
    const file = e.target.files[0];
    const res = await filesApi.uploadFile(wsId, file);
    if (res.ok) {
      showToast(`Uploaded ${file.name}`, 'success');
      loadDir(currentDir);
    } else {
      showToast(res.error, 'error');
    }
  }

  const [showNewMenu, setShowNewMenu] = useState(false);

  async function createFile(name: string, template: string, type: string) {
    if (!wsId) return;
    const filePath = currentDir ? `${currentDir}/${name}` : name;
    const res = await filesApi.writeFile(wsId, filePath, template);
    if (res.ok) {
      showToast(`Created ${name}`, 'success');
      loadDir(currentDir);
      addWindow({ type, title: name, file: filePath });
    } else {
      showToast(res.error, 'error');
    }
  }

  function goUp() {
    const parts = currentDir.split('/').filter(Boolean);
    parts.pop();
    setCurrentDir(parts.join('/'));
  }

  if (!wsId) return null;

  return (
    <div className="explorer-window">
      <div className="explorer-toolbar">
        {currentDir && (
          <button className="explorer-btn" onClick={goUp} title="Go up">↑</button>
        )}
        <span className="explorer-path">/{currentDir}</span>
        <div className="explorer-new-wrapper">
          <button className="explorer-new-btn" onClick={() => setShowNewMenu(!showNewMenu)} title="New file">
            + New
          </button>
          {showNewMenu && (
            <div className="explorer-new-menu">
              <button onClick={() => { setShowNewMenu(false); createFile('untitled.md', '# Untitled\n', 'markdown'); }}>Markdown</button>
              <button onClick={() => { setShowNewMenu(false); createFile('untitled.txt', '', 'text'); }}>Text</button>
              <button onClick={() => { setShowNewMenu(false); createFile('untitled.html', '<!DOCTYPE html>\n<html>\n<head><title>Page</title></head>\n<body>\n  <h1>Hello</h1>\n</body>\n</html>\n', 'html'); }}>HTML</button>
            </div>
          )}
        </div>
        <label className="explorer-upload-btn" title="Upload file">
          + Upload
          <input type="file" onChange={handleUpload} style={{ display: 'none' }} />
        </label>
        <button className="explorer-btn" onClick={() => loadDir(currentDir)} title="Refresh">⟳</button>
      </div>
      <div className="explorer-list" onClick={() => setShowNewMenu(false)}>
        {loading && <div className="window-loading">Loading...</div>}
        {!loading && entries.length === 0 && (
          <div className="explorer-empty">Empty directory</div>
        )}
        {!loading && entries.map((entry) => (
          <div
            key={entry.name}
            className={`explorer-item ${entry.type === 'directory' ? 'explorer-item-dir' : ''}`}
            onClick={() => handleFileClick(entry)}
          >
            <span className="explorer-item-icon">
              {entry.type === 'directory' ? '📁' : '📄'}
            </span>
            <span className="explorer-item-name">{entry.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
