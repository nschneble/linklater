import ActionGuard from '../common/ActionGuard';
import Alert from '../common/Alert';
import { cancelPendingAccountDeletion, deleteMe } from '../../lib/api';
import IconButton from '../common/IconButton';
import LinkButton from '../common/LinkButton';
import { actionGuardInitialFocusProps } from '../../lib/hooks/useFocusFirstButton';
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
  // Set by handleNeverMind before the async refreshUser flips
  // accountDeletionPending → false. The effect below catches the next render
  // that lands on the idle trigger and returns focus there. Without this,
  // the CheckYourEmailPanel unmounts and focus falls to <body>, dropping
  // keyboard + screen-reader users out of context.
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
      // The server now holds an unexpired deletion token, so refreshUser
      // flips accountDeletionPending to true and the CheckYourEmailPanel
      // renders. Its own mount effect handles focus.
      await refreshUser();
    } else {
      // Defensive fallback: if the API ever deletes on the email path,
      // finish cleanly rather than leave the user in a stale UI.
      setPendingNotice('account-deleted');
      logout();
    }
  }, [logout, refreshUser]);

  const handleNeverMind = useCallback(() => {
    void (async () => {
      try {
        await cancelPendingAccountDeletion();
      } catch {
        // Fire-and-forget: a failed cancel leaves the server-side token
        // pending, but the user clicked Never mind. We revert the UI
        // either way; the worst case is the email link still works.
      }
      // Arm the focus-return effect before refreshUser commits the idle
      // branch – raf-after-await races React commit; the effect locks
      // focus to the actual mount of the trigger button.
      shouldFocusTriggerOnIdle.current = true;
      try {
        await refreshUser();
      } catch {
        // stale user state resolves on next navigation; intent ref clears
        // on the next idle render either way
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
          // Two independent focus-return paths converge on this element, so
          // it needs BOTH wirings:
          //   - id={triggerId}: ActionGuard's own effect refocuses via
          //     getElementById(triggerId) when the confirm row closes
          //     (cancel / Escape / no-error success) while ActionGuard is
          //     mounted.
          //   - ref={triggerReference}: the never-mind path fires from
          //     CheckYourEmailPanel, when ActionGuard is NOT mounted, so this
          //     component's shouldFocusTriggerOnIdle effect refocuses via the
          //     ref instead.
          // Removing either drops a distinct keyboard/screen-reader
          // focus-return.
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
              {/* Ghost on alert-bg host (SettingsGroup variant="danger"
                  paints --alert-bg). IconButton default surface="mount"
                  paints --mount-border / --mount-alt-text against --alert-bg.
                  Intentional – adding 'alert' to IconButton's surface union
                  would require a new bundle slot per
                  [[feedback-bundle-slot-add-reverify]] and is deferred to
                  a future wave. Pre-existing in legacy code (was
                  --text-muted, similar effect). Do not "fix" by adding an
                  explicit surface override here. */}
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
