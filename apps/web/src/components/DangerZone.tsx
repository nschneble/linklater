import { deleteMe } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { useState } from 'react';
import Alert from './ui/Alert';
import IconButton from './ui/IconButton';

export default function DangerZone() {
  const { logout } = useAuth();

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    try {
      await deleteMe();
      logout();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Failed to delete account';
      setError(message);
    }
  };

  return (
    <div className="max-w-md p-4 bg-[var(--bg-surface)] border border-rose-800/70 rounded-xl">
      <h3 className="mb-1 text-rose-400 text-sm font-semibold">Danger zone</h3>
      <p className="mb-3 text-rose-300/80 text-xs">
        Deleting your account will remove all your saved links. This cannot be
        undone.
      </p>

      {error && <Alert variant="error">{error}</Alert>}

      {!confirmDelete ? (
        <IconButton
          variant="danger"
          className="px-3"
          type="button"
          onClick={() => setConfirmDelete(true)}
        >
          Delete my account
        </IconButton>
      ) : (
        <div className="flex gap-2 items-center text-xs">
          <span className="text-rose-300">
            Are you sure? This is permanent.
          </span>
          <IconButton
            variant="danger-filled"
            className="px-3"
            type="button"
            onClick={handleDelete}
          >
            Yes, delete
          </IconButton>
          <IconButton
            variant="ghost"
            className="px-3"
            type="button"
            onClick={() => setConfirmDelete(false)}
          >
            Cancel
          </IconButton>
        </div>
      )}
    </div>
  );
}
