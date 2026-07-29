import { useState } from 'react';
import { useWorkspace } from '../../state/workspaceContext';
import { useWebSocket } from '../../ws/useWebSocket';

export function TopBar({ onNewWorkspace }: { onNewWorkspace: () => void }) {
  const { state } = useWorkspace();
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className="topbar">
      <div className="topbar-left">
        <button className="topbar-menu-btn" onClick={() => setShowMenu(!showMenu)}>
          ≡
        </button>
        <span className="topbar-title">
          {state.workspace?.name ?? 'Workspace'}
        </span>
        {state.connected && <span className="topbar-status connected" title="Connected" />}
        {!state.connected && <span className="topbar-status disconnected" title="Disconnected" />}
      </div>

      <div className="topbar-right">
        <button className="topbar-btn" onClick={onNewWorkspace}>+ New Workspace</button>
      </div>

      {showMenu && (
        <div className="topbar-menu">
          {state.workspaceList.map((ws) => (
            <button
              key={ws.id}
              className="topbar-menu-item"
              onClick={() => {
                setShowMenu(false);
                window.location.hash = ws.id;
              }}
            >
              {ws.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
