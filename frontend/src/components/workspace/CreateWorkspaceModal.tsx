import { useState } from 'react';
import { Modal } from '../common/Modal';

interface CreateWorkspaceModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string) => Promise<void>;
}

export function CreateWorkspaceModal({ open, onClose, onCreate }: CreateWorkspaceModalProps) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    await onCreate(name.trim());
    setBusy(false);
    setName('');
  }

  return (
    <Modal open={open} title="New Workspace" onClose={onClose}>
      <form onSubmit={handleSubmit} className="create-workspace-form">
        <input
          className="create-workspace-input"
          type="text"
          placeholder="Workspace name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          maxLength={200}
        />
        <button className="create-workspace-submit" type="submit" disabled={!name.trim() || busy}>
          {busy ? 'Creating...' : 'Create'}
        </button>
      </form>
    </Modal>
  );
}
