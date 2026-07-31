import ActionGuard from '../common/ActionGuard';
import { actionGuardInitialFocusProps } from '../../lib/hooks/useFocusFirstButton';
import Alert from '../common/Alert';
import { cancelPendingAccountDeletion, deleteMe } from '../../lib/api';
import IconButton from '../common/IconButton';
import LinkButton from '../common/LinkButton';
import { setPendingNotice } from '../../lib/pendingNotice';
import { useCallback, useEffect, useRef } from 'react';
import type { User } from '../../auth/AuthContext';

interface EmailConfirmDeleteFlowProps {
  /** The authenticated, already-narrowed user (gate owned by `DangerZone`). */
  user: User;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

/**
 * Account-deletion flow for magic-link-only accounts (no password, no MFA).
 * The two-step `ActionGuard` row fires `deleteMe()` with no body; the API
 * returns `requiresEmailConfirmation: true`, we refresh the user, and the
 * `user.accountDeletionPending` server flag flips the UI into a "Check your
 * email" panel with a "Never mind, keep my account" `LinkButton`. Never mind
 * calls `DELETE /auth/account-deletion/pending`, refreshes the user (flag
 * clears), and the panel unmounts back to the idle trigger.
 *
 * Driving the panel off the server flag (not local state) keeps the in-flight
 * state across navigation away from Settings and back. No logout in this
 * branch – the email click finishes the deletion.
 */
export default function EmailConfirmDeleteFlow({
  user,
  logout,
  refreshUser,
}: EmailConfirmDeleteFlowProps) {
  const triggerReference = useRef<HTMLButtonElement>(null);
  // arm focus-return so the trigger regains focus, not <body>, on unmount
  const shouldFocusTriggerOnIdle = useRef(false);

  const accountDeletionPending = !!user.accountDeletionPending;

  useEffect(() => {
    if (shouldFocusTriggerOnIdle.current && !accountDeletionPending) {
      triggerReference.current?.focus();
      shouldFocusTriggerOnIdle.current = false;
    }
  }, [accountDeletionPending]);

  const handleEmailConfirmConfirm = useCallback(async () => {
    const response = await deleteMe();
    if ('requiresEmailConfirmation' in response) {
      // refreshUser flips the pending flag; CheckYourEmailPanel takes over
      await refreshUser();
    } else {
      // defensive: if the API ever deletes directly, finish cleanly
      setPendingNotice('account-deleted');
      logout();
    }
  }, [logout, refreshUser]);

  const handleNeverMind = useCallback(() => {
    void (async () => {
      try {
        await cancelPendingAccountDeletion();
      } catch {
        // fire-and-forget: revert the UI even if cancel fails
      }
      // arm before refreshUser; a raf-after-await would race React's commit
      shouldFocusTriggerOnIdle.current = true;
      try {
        await refreshUser();
      } catch {
        // stale state resolves on next navigation; intent ref self-clears
      }
    })();
  }, [refreshUser]);

  if (accountDeletionPending) {
    return (
      <CheckYourEmailPanel email={user.email} onNeverMind={handleNeverMind} />
    );
  }

  return (
    <ActionGuard
      className="space-y-3"
      alertSlot="before"
      errorFallback="Failed to delete account"
      onConfirm={handleEmailConfirmConfirm}
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
          // needs BOTH id (ActionGuard) and ref (never-mind) focus-return
          <IconButton
            id={triggerId}
            ref={triggerReference}
            variant="danger"
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
            className="flex items-center justify-between gap-2 text-xs"
          >
            <span className="text-[var(--alert-text)]">
              Are you sure? This is permanent.
            </span>
            <div className="space-x-2">
              <IconButton
                variant="danger-filled"
                disabled={pending}
                onClick={runConfirm}
              >
                {pending ? 'Deleting…' : 'Yes, delete'}
              </IconButton>
              {/* Ghost IconButton (surface="mount") paints mount tokens on
                  the danger card's --alert-bg. Intentional: a clean fix needs
                  a new 'alert' bundle slot, so don't add a surface override
                  here. */}
              <IconButton
                {...actionGuardInitialFocusProps}
                variant="ghost"
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

interface CheckYourEmailPanelProps {
  email: string;
  onNeverMind: () => void;
}

function CheckYourEmailPanel({ email, onNeverMind }: CheckYourEmailPanelProps) {
  const sectionReference = useRef<HTMLElement>(null);

  useEffect(() => {
    sectionReference.current?.focus();
  }, []);

  return (
    <section
      ref={sectionReference}
      tabIndex={-1}
      aria-label="Account deletion link sent"
      className="space-y-3 focus:outline-none"
    >
      <Alert variant="success">Account deletion link sent to {email}</Alert>
      <LinkButton onClick={onNeverMind}>
        Never mind, I want to keep my account
      </LinkButton>
    </section>
  );
}
