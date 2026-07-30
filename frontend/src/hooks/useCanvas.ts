import { useCallback, useRef } from 'react';
import { useWorkspace } from '../state/workspaceContext';

export function useCanvas() {
  const { state, dispatch } = useWorkspace();
  const isPanning = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const zoom = state.workspace?.settings.zoom ?? 1;
  const viewportX = state.workspace?.settings.viewportX ?? 0;
  const viewportY = state.workspace?.settings.viewportY ?? 0;

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = -e.deltaY * 0.001;
      const newZoom = Math.max(0.25, Math.min(4, zoom + delta));
      dispatch({ type: 'UPDATE_SETTINGS', settings: { zoom: newZoom } });
    } else {
      dispatch({
        type: 'UPDATE_SETTINGS',
        settings: {
          viewportX: viewportX - e.deltaX,
          viewportY: viewportY - e.deltaY,
        },
      });
    }
  }, [zoom, viewportX, viewportY, dispatch]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.target !== e.currentTarget) return;
    isPanning.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isPanning.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    dispatch({
      type: 'UPDATE_SETTINGS',
      settings: { viewportX: viewportX + dx, viewportY: viewportY + dy },
    });
  }, [viewportX, viewportY, dispatch]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    isPanning.current = false;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
  }, []);

  return {
    zoom,
    viewportX,
    viewportY,
    handleWheel,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  };
}
