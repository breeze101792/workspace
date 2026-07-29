import { useState, useEffect, useCallback } from 'react';
import type { WindowProps } from './registry';
import * as filesApi from '../../api/files';
import { useWorkspace } from '../../state/workspaceContext';

export function MarkdownWindow({ window: win }: WindowProps) {
  const { state } = useWorkspace();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);

  const wsId = state.workspace?.id;

  useEffect(() => {
    if (!wsId || !win.file) return;
    setLoading(true);
    filesApi.readFile(wsId, win.file).then((res) => {
      if (res.ok) {
        setContent(res.data.content);
      }
      setLoading(false);
    });
  }, [wsId, win.file]);

  const handleChange = useCallback(async (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);
    if (wsId && win.file) {
      await filesApi.writeFile(wsId, win.file, newContent);
    }
  }, [wsId, win.file]);

  function renderMarkdown(text: string): string {
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const html = escaped
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code>$1</code>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/(.+)/g, (m) => {
        if (m.startsWith('<')) return m;
        return `<p>${m}</p>`;
      });

    return html;
  }

  if (loading) {
    return <div className="window-loading">Loading...</div>;
  }

  return (
    <div className="markdown-window">
      <div className="markdown-editor">
        <textarea
          className="markdown-textarea"
          value={content}
          onChange={handleChange}
          spellCheck={false}
        />
      </div>
      <div
        className="markdown-preview"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
      />
    </div>
  );
}
