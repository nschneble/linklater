import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { cancelPendingAccountDeletion, deleteMe } from '../../lib/api';
import { setPendingNotice } from '../../lib/pendingNotice';
import { useAuth } from '../../auth/AuthContext';
import { getErrorMessage } from '../../lib/errors';
import ActionGuard from '../common/ActionGuard';
import Alert from '../common/Alert';
import IconButton from '../common/IconButton';
import LinkButton from '../common/LinkButton';
import ReauthForm from './ReauthForm';

type Phase = 'idle' | 'reauth' | 'reauth-pending';

/**
 * Settings section for permanently deleting the account. Forks by credential
 * presence:
 *
 * - **Credentialed branch** (`hasPassword` or `multiFactorMethod`): the
 *   trigger reveals `ReauthForm` inline. Submitting calls `DELETE /users/me`
 *   with the credentials, then logs the user out. `DangerZone` owns
 *   trigger-focus, Escape-to-cancel, and return-focus-on-cancel directly
 *   (not via `ActionGuard`) so the destructive form-shape gets the same
 *   focus contract as the two-step row.
 * - **Email-confirm branch** (magic-link-only-no-MFA accounts): the existing
 *   two-step `ActionGuard` row stays. Confirming fires `deleteMe()` with no
 *   body; the API returns `requiresEmailConfirmation: true`, we refresh the
 *   user, and the `user.accountDeletionPending` server flag flips the UI
 *   into a "Check your email" panel with a "Never mind, keep my account"
 *   `LinkButton`. Never mind calls `DELETE /auth/account-deletion/pending`,
 *   refreshes the user (flag clears), and the panel unmounts back to the
 *   idle trigger. Driving the panel off the server flag (not local state)
 *   keeps the in-flight state across navigation away from Settings and back.
 *   No logout in this branch – the email click finishes the deletion.
 *
 * While `useAuth()` is still loading, branch-specific UI is suppressed –
 * the section renders only a disabled idle trigger to avoid flickering the
 * magic-link-default branch for a user who is actually credentialed.
 */
export default function DangerZone() {
  const { logout, refreshUser, user, loading } = useAuth();
  const triggerReference = useRef<HTMLButtonElement>(null);
  // Set by handleNeverMind before the async refreshUser flips
  // accountDeletionPending → false. The effect below catches the next render
  // that lands on the idle trigger and returns focus there. Without this,
  // the CheckYourEmailPanel unmounts and focus falls to <body>, dropping
  // keyboard + screen-reader users out of context.
  const shouldFocusTriggerOnIdle = useRef(false);

  const [phase, setPhase] = useState<Phase>('idle');
  const [reauthError, setReauthError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');

  const isCredentialed = !!(user?.hasPassword || user?.multiFactorMethod);
  const branchReady = !loading && !!user;
  const accountDeletionPending = !!user?.accountDeletionPending;
  const emailBranchIdle =
    branchReady && !isCredentialed && !accountDeletionPending;

  useEffect(() => {
    if (shouldFocusTriggerOnIdle.current && emailBranchIdle) {
      triggerReference.current?.focus();
      shouldFocusTriggerOnIdle.current = false;
    }
  }, [emailBranchIdle]);

  const closeReauth = useCallback(() => {
    setPhase('idle');
    setPassword('');
    setCode('');
    setReauthError(null);
    requestAnimationFrame(() => triggerReference.current?.focus());
  }, []);

  const handleOpenReauth = useCallback(() => {
    setReauthError(null);
    setPassword('');
    setCode('');
    setPhase('reauth');
  }, []);

  // Escape backs out of the credentialed reauth form – matches user
  // expectation that Escape always cancels, regardless of focus location.
  useEffect(() => {
    if (phase !== 'reauth' && phase !== 'reauth-pending') return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeReauth();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [phase, closeReauth]);

  const handleReauthSubmit = useCallback(
    (formEvent: FormEvent) => {
      formEvent.preventDefault();
      void (async () => {
        setReauthError(null);
        setPhase('reauth-pending');
        try {
          await deleteMe({
            currentPassword: password || undefined,
            code: code || undefined,
          });
          setPendingNotice('account-deleted');
          logout();
        } catch (error) {
          setReauthError(getErrorMessage(error, 'Failed to delete account'));
          setPhase('reauth');
        }
      })();
    },
    [code, logout, password],
  );

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

  if (!branchReady) {
    return (
      <div className="space-y-3">
        <IconButton
          ref={triggerReference}
          variant="danger"
          type="button"
          disabled
          aria-disabled
        >
          <i
            className="fa-solid fa-skull-crossbones text-[0.7rem]"
            aria-hidden="true"
          />
          Delete my account
        </IconButton>
      </div>
    );
  }

  if (isCredentialed) {
    if (phase === 'idle') {
      return (
        <div className="space-y-3">
          <IconButton
            ref={triggerReference}
            variant="danger"
            type="button"
            onClick={handleOpenReauth}
          >
            <i
              className="fa-solid fa-skull-crossbones text-[0.7rem]"
              aria-hidden="true"
            />
            Delete my account
          </IconButton>
        </div>
      );
    }
    return (
      <div className="space-y-3">
        <ReauthForm
          prompt="Confirm your identity to permanently delete your account."
          srOnlyHeading="Confirm account deletion"
          submitLabel="Delete my account"
          submittingLabel="Deleting…"
          cancelLabel="Cancel account deletion"
          focusOnMount
          loading={phase === 'reauth-pending'}
          error={reauthError}
          password={password}
          code={code}
          hasPassword={!!user?.hasPassword}
          hasMfa={!!user?.multiFactorMethod}
          onPasswordChange={setPassword}
          onCodeChange={setCode}
          onSubmit={handleReauthSubmit}
          onCancel={closeReauth}
        />
      </div>
    );
  }

  if (accountDeletionPending) {
    return (
      <CheckYourEmailPanel email={user!.email} onNeverMind={handleNeverMind} />
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
