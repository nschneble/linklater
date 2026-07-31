import CredentialedDeleteFlow from './CredentialedDeleteFlow';
import EmailConfirmDeleteFlow from './EmailConfirmDeleteFlow';
import IconButton from '../common/IconButton';
import { useAuth } from '../../auth/AuthContext';

/**
 * Settings section for permanently deleting the account. Owns the
 * `loading`/`user` gate, then forks by credential presence and delegates each
 * flow to its own component so the two very different flows don't share a file:
 *
 * - **Credentialed branch** (`hasPassword` or `multiFactorMethod`):
 *   `CredentialedDeleteFlow` reveals `ReauthForm` inline, then calls
 *   `DELETE /users/me` with the credentials and logs the user out. That flow
 *   owns trigger-focus, Escape-to-cancel, and return-focus-on-cancel directly
 *   (not via `ActionGuard`) so the destructive form-shape gets the same focus
 *   contract as the two-step row.
 * - **Email-confirm branch** (magic-link-only, no MFA):
 *   `EmailConfirmDeleteFlow` keeps the two-step `ActionGuard` row. Confirming
 *   fires `deleteMe()` with no body; the API returns
 *   `requiresEmailConfirmation: true`, the user refreshes, and the
 *   `user.accountDeletionPending` server flag flips the UI into a
 *   "Check your email" panel. No logout in this branch - the email click
 *   finishes the deletion.
 *
 * While `useAuth()` is still loading, branch-specific UI is suppressed - the
 * section renders only a disabled idle trigger to avoid flickering the
 * magic-link-default branch for a user who is actually credentialed. Gating
 * `loading`/`user` here lets both flows receive an already-narrowed,
 * guaranteed-non-null `user`.
 */
export default function DangerZone() {
  const { logout, refreshUser, user, loading } = useAuth();

  if (loading || !user) {
    return (
      <div className="space-y-3">
        <IconButton variant="danger" type="button" disabled aria-disabled>
          <i
            className="fa-solid fa-skull-crossbones text-[0.7rem]"
            aria-hidden="true"
          />
          Delete my account
        </IconButton>
      </div>
    );
  }

  const isCredentialed = !!(user.hasPassword || user.multiFactorMethod);

  if (isCredentialed) {
    return <CredentialedDeleteFlow user={user} logout={logout} />;
  }

  return (
    <EmailConfirmDeleteFlow
      user={user}
      logout={logout}
      refreshUser={refreshUser}
    />
  );
}
