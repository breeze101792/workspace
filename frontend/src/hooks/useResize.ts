import { useRef, useCallback } from 'react';

interface ResizeOptions {
  onResize: (dw: number, dh: number) => void;
  onResizeEnd: () => void;
}

export function useResize({ onResize, onResizeEnd }: ResizeOptions) {
  const resizing = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    resizing.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!resizing.current) return;
    const dw = e.clientX - lastPos.current.x;
    const dh = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    onResize(dw, dh);
  }, [onResize]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    resizing.current = false;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    onResizeEnd();
  }, [onResizeEnd]);

  return {
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: handlePointerUp,
  };
}
