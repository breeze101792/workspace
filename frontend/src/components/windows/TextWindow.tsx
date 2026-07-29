import { useState, useEffect, useCallback } from 'react';
import type { WindowProps } from './registry';
import * as filesApi from '../../api/files';
import { useWorkspace } from '../../state/workspaceContext';

export function TextWindow({ window: win }: WindowProps) {
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

  if (loading) {
    return <div className="window-loading">Loading...</div>;
  }

  return (
    <div className="text-window">
      <textarea
        className="text-textarea"
        value={content}
        onChange={handleChange}
        spellCheck={false}
      />
    </div>
  );
}
