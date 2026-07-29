import { useState } from 'react';
import type { WindowProps } from './registry';
import { useWorkspace } from '../../state/workspaceContext';

export function ImageWindow({ window: win }: WindowProps) {
  const { state } = useWorkspace();
  const [zoom, setZoom] = useState(1);
  const wsId = state.workspace?.id;

  const imgSrc = wsId && win.file
    ? `/api/workspaces/${wsId}/files/${win.file}`
    : null;

  if (!imgSrc) {
    return <div className="window-loading">No image to display</div>;
  }

  return (
    <div className="image-window">
      <div className="image-toolbar">
        <button className="image-toolbar-btn" onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}>−</button>
        <span className="image-zoom-label">{Math.round(zoom * 100)}%</span>
        <button className="image-toolbar-btn" onClick={() => setZoom((z) => Math.min(4, z + 0.25))}>+</button>
        <button className="image-toolbar-btn" onClick={() => setZoom(1)}>Fit</button>
      </div>
      <div className="image-container">
        <img
          src={imgSrc}
          alt={win.title}
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: 'center center',
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
          }}
        />
      </div>
    </div>
  );
}
