import { useWindowManager } from '../../hooks/useWindowManager';

export function Dock({ onNewWindow }: { onNewWindow: () => void }) {
  const { windows, toggleMinimize } = useWindowManager();
  const minimized = windows.filter((w) => w.minimized);

  return (
    <div className="dock">
      <button className="dock-add-btn" onClick={onNewWindow} title="New window">
        +
      </button>

      {minimized.map((w) => (
        <button
          key={w.id}
          className="dock-item"
          onClick={() => toggleMinimize(w.id)}
          title={w.title}
        >
          <span className="dock-item-icon">{w.type === 'markdown' ? 'M' : w.type === 'text' ? 'T' : w.type === 'html' ? 'H' : w.type === 'image' ? 'I' : 'F'}</span>
          <span className="dock-item-label">{w.title}</span>
        </button>
      ))}

      {minimized.length === 0 && (
        <span className="dock-empty">No minimized windows</span>
      )}
    </div>
  );
}
