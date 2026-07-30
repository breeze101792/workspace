import type { ReactNode } from 'react';
import { useDrag } from '../../hooks/useDrag';
import { TitleBar } from './TitleBar';
import { ResizeHandle } from './ResizeHandle';
import type { WindowState } from '../../types';

interface WindowProps {
  win: WindowState;
  focused: boolean;
  onFocus: () => void;
  onMove: (x: number, y: number) => void;
  onMoveEnd: () => void;
  onResize: (w: number, h: number) => void;
  onResizeEnd: () => void;
  onMinimize: () => void;
  onMaximize: () => void;
  onClose: () => void;
  children: ReactNode;
}

export function Window({
  win,
  focused,
  onFocus,
  onMove,
  onMoveEnd,
  onResize,
  onResizeEnd,
  onMinimize,
  onMaximize,
  onClose,
  children,
}: WindowProps) {
  const dragHandlers = useDrag({
    onDrag: (dx, dy) => onMove(win.x + dx, win.y + dy),
    onDragEnd: onMoveEnd,
  });

  if (win.minimized) return null;

  const style: React.CSSProperties = {
    position: 'absolute',
    left: win.x,
    top: win.y,
    width: win.width,
    height: win.height,
    zIndex: win.zIndex,
  };

  if (win.maximized) {
    style.left = 0;
    style.top = 40;
    style.width = '100vw';
    style.height = 'calc(100vh - 80px)';
    style.position = 'fixed';
  }

  return (
    <div
      className={`window ${focused ? 'window-focused' : ''}`}
      style={style}
      onPointerDown={onFocus}
    >
      <TitleBar
        title={win.title}
        focused={focused}
        onMinimize={onMinimize}
        onMaximize={onMaximize}
        onClose={onClose}
        dragHandlers={dragHandlers}
      />
      <div className="window-content">
        {children}
      </div>
      {!win.maximized && (
        <ResizeHandle
          onResize={(dw, dh) => onResize(Math.max(240, win.width + dw), Math.max(160, win.height + dh))}
          onResizeEnd={onResizeEnd}
        />
      )}
    </div>
  );
}
