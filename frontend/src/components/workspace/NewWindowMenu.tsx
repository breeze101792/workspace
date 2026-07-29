import { getAllTypes } from '../windows/registry';

interface NewWindowMenuProps {
  open: boolean;
  onClose: () => void;
  onSelect: (type: string) => void;
}

export function NewWindowMenu({ open, onClose, onSelect }: NewWindowMenuProps) {
  if (!open) return null;
  const types = getAllTypes();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="new-window-menu" onClick={(e) => e.stopPropagation()}>
        <div className="new-window-menu-header">New Window</div>
        {types.map(({ type, label, icon }) => (
          <button
            key={type}
            className="new-window-menu-item"
            onClick={() => onSelect(type)}
          >
            <span className="new-window-menu-icon">{icon}</span>
            <span>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
