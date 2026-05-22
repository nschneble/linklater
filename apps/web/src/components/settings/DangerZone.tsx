import { deleteMe } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import { useAuth } from '../../auth/AuthContext';
import { useRef, useState } from 'react';
import { useFocusFirstButton } from '../../lib/hooks/useFocusFirstButton';
import Alert from '../common/Alert';
import IconButton from '../common/IconButton';

/**
 * Settings section for permanently deleting the account.
 *
 * Uses a two-step confirmation pattern: the first click reveals a confirmation
 * row ("Are you sure? This is permanent.") with a destructive "Yes, delete"
 * button and a "Cancel" escape hatch. This prevents accidental deletion from a
 * single misclick.
 *
 * On confirmed deletion, calls `DELETE /users/me` and then `logout()` to clear
 * auth state and redirect the user to the login screen.
 */
export default function DangerZone() {
  const { logout } = useAuth();

  const [confirmDelete, setConfirmDelete] = useState(false);
  const confirmRowReference = useRef<HTMLDivElement>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useFocusFirstButton(confirmRowReference, confirmDelete);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteMe();
      logout();
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Failed to delete account'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-3">
      {error && <Alert variant="error">{error}</Alert>}

      {!confirmDelete ? (
        <IconButton
          variant="danger"
          type="button"
          onClick={() => setConfirmDelete(true)}
        >
          <i
            className="fa-solid fa-skull-crossbones text-[0.7rem]"
            aria-hidden="true"
          />
          Delete my account
        </IconButton>
      ) : (
        <div
          ref={confirmRowReference}
          className="flex gap-2 items-center mb-0.5 text-xs"
        >
          <span className="text-rose-700 [[data-mode='dark']_&]:text-rose-300 [[data-theme='nouvelle-vague']_&]:text-gray-700 [[data-theme='nouvelle-vague'][data-mode='dark']_&]:text-gray-400">
            Are you sure? This is permanent.
          </span>
          <IconButton
            variant="danger-filled"
            type="button"
            disabled={deleting}
            onClick={handleDelete}
          >
            {deleting ? 'Deleting…' : 'Yes, delete'}
          </IconButton>
          <IconButton
            variant="ghost"
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
