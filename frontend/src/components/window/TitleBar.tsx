interface TitleBarProps {
  title: string;
  focused: boolean;
  onMinimize: () => void;
  onMaximize: () => void;
  onClose: () => void;
}

export function TitleBar({ title, focused, onMinimize, onMaximize, onClose }: TitleBarProps) {
  return (
    <div className={`titlebar ${focused ? 'titlebar-focused' : ''}`}>
      <span className="titlebar-text">{title}</span>
      <div className="titlebar-buttons">
        <button className="titlebar-btn titlebar-minimize" onClick={onMinimize} title="Minimize">−</button>
        <button className="titlebar-btn titlebar-maximize" onClick={onMaximize} title="Maximize">□</button>
        <button className="titlebar-btn titlebar-close" onClick={onClose} title="Close">⊗</button>
      </div>
    </div>
  );
}
