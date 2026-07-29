import type { ReactNode } from 'react';
import { useCanvas } from '../../hooks/useCanvas';

interface CanvasProps {
  children: ReactNode;
}

export function Canvas({ children }: CanvasProps) {
  const { zoom, viewportX, viewportY, handleWheel, handlePointerDown, handlePointerMove, handlePointerUp } = useCanvas();

  return (
    <div
      className="canvas"
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{ cursor: 'default' }}
    >
      <div
        className="canvas-world"
        style={{
          transform: `translate(${viewportX}px, ${viewportY}px) scale(${zoom})`,
          transformOrigin: '0 0',
        }}
      >
        {children}
      </div>

      <div className="canvas-zoom-indicator">
        {Math.round(zoom * 100)}%
      </div>
    </div>
  );
}
