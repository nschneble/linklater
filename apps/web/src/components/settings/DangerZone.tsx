import { deleteMe } from '../../lib/api';
import { setAuthNotice } from '../../auth/authNotice';
import { useAuth } from '../../auth/AuthContext';
import ActionGuard from '../common/ActionGuard';
import IconButton from '../common/IconButton';

/**
 * Settings section for permanently deleting the account.
 *
 * Two-step confirmation (delegated to `ActionGuard`): first click reveals a
 * confirmation row ("Are you sure? This is permanent.") with a destructive
 * "Yes, delete" button and a "Cancel" escape hatch. On confirmed deletion,
 * calls `DELETE /users/me` and then `logout()` to clear auth state and
 * redirect the user to the login screen.
 */
export default function DangerZone() {
  const { logout } = useAuth();

  return (
    <ActionGuard
      className="space-y-3"
      alertSlot="before"
      errorFallback="Failed to delete account"
      onConfirm={async () => {
        await deleteMe();
        setAuthNotice('account-deleted');
        logout();
      }}
    >
      {({
        confirming,
        pending,
        triggerId,
        confirmReference,
        openConfirm,
        closeConfirm,
        runConfirm,
      }) =>
        !confirming ? (
          <IconButton
            id={triggerId}
            variant="danger"
            type="button"
            onClick={openConfirm}
          >
            <i
              className="fa-solid fa-skull-crossbones text-[0.7rem]"
              aria-hidden="true"
            />
            Delete my account
          </IconButton>
        ) : (
          <div
            ref={confirmReference}
            className="flex gap-2 items-center justify-between text-xs"
          >
            <span className="text-rose-700 [[data-mode='dark']_&]:text-rose-300 [[data-theme='nouvelle-vague']_&]:text-gray-700 [[data-theme='nouvelle-vague'][data-mode='dark']_&]:text-gray-400">
              Are you sure? This is permanent.
            </span>
            <div className="space-x-2">
              <IconButton
                variant="danger-filled"
                type="button"
                disabled={pending}
                onClick={runConfirm}
              >
                {pending ? 'Deleting…' : 'Yes, delete'}
              </IconButton>
              <IconButton
                variant="ghost"
                type="button"
                disabled={pending}
                onClick={closeConfirm}
              >
                No, don't delete
              </IconButton>
            </div>
          </div>
        )
      }
    </ActionGuard>
  );
}
