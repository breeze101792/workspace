import { useWindowManager } from '../../hooks/useWindowManager';
import { Window } from './Window';
import { getWindowComponent } from '../windows/registry';

interface WindowManagerProps {
  sendWS: (type: string, data: unknown) => void;
}

export function WindowManager({ sendWS }: WindowManagerProps) {
  const { windows, moveWindow, resizeWindow, focusWindow, toggleMinimize, toggleMaximize, removeWindow } = useWindowManager();

  const sortedWindows = [...windows].sort((a, b) => a.zIndex - b.zIndex);
  const maxZ = windows.length > 0 ? Math.max(...windows.map(w => w.zIndex)) : 0;

  return (
    <>
      {sortedWindows.map((win) => {
        const WinComponent = getWindowComponent(win.type);
        if (!WinComponent) return null;

        return (
          <Window
            key={win.id}
            win={win}
            focused={win.zIndex === maxZ}
            onFocus={() => {
              if (win.zIndex !== maxZ) {
                focusWindow(win.id);
                sendWS('window:focus', { id: win.id });
              }
            }}
            onMove={(x, y) => moveWindow(win.id, x, y)}
            onMoveEnd={() => sendWS('window:move', { id: win.id, x: win.x, y: win.y })}
            onResize={(w, h) => resizeWindow(win.id, w, h)}
            onResizeEnd={() => sendWS('window:resize', { id: win.id, width: win.width, height: win.height })}
            onMinimize={() => {
              toggleMinimize(win.id);
              sendWS('window:minimize', { id: win.id });
            }}
            onMaximize={() => {
              toggleMaximize(win.id);
              sendWS('window:maximize', { id: win.id });
            }}
            onClose={() => {
              removeWindow(win.id);
              sendWS('window:close', { id: win.id });
            }}
          >
            <WinComponent window={win} />
          </Window>
        );
      })}
    </>
  );
}
