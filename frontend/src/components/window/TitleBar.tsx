import type { HTMLAttributes } from 'react';

interface TitleBarProps {
  title: string;
  focused: boolean;
  onMinimize: () => void;
  onMaximize: () => void;
  onClose: () => void;
  dragHandlers?: HTMLAttributes<HTMLElement>;
}

export function TitleBar({ title, focused, onMinimize, onMaximize, onClose, dragHandlers }: TitleBarProps) {
  return (
    <div className={`titlebar ${focused ? 'titlebar-focused' : ''}`}>
      <span className="titlebar-text" {...dragHandlers}>{title}</span>
      <div className="titlebar-buttons">
        <button className="titlebar-btn titlebar-minimize" onClick={onMinimize} title="Minimize">−</button>
        <button className="titlebar-btn titlebar-maximize" onClick={onMaximize} title="Maximize">□</button>
        <button className="titlebar-btn titlebar-close" onClick={onClose} title="Close">⊗</button>
      </div>
    </div>
  );
}
