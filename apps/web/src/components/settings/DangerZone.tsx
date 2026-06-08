import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { cancelPendingAccountDeletion, deleteMe } from '../../lib/api';
import { setAuthNotice } from '../../auth/authNotice';
import { useAuth } from '../../auth/AuthContext';
import { getErrorMessage } from '../../lib/errors';
import ActionGuard from '../common/ActionGuard';
import Alert from '../common/Alert';
import IconButton from '../common/IconButton';
import LinkButton from '../common/LinkButton';
import ReauthForm from './ReauthForm';

type Phase = 'idle' | 'reauth' | 'reauth-pending' | 'email-sent';

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
 *   body; the API returns `requiresEmailConfirmation: true` and DangerZone
 *   swaps to a "Check your email" panel with a "Never mind, keep my account"
 *   `LinkButton` that calls `DELETE /auth/account-deletion/pending` and
 *   reverts to the idle trigger. No logout in this branch — the email
 *   click finishes the deletion.
 *
 * While `useAuth()` is still loading, branch-specific UI is suppressed —
 * the section renders only a disabled idle trigger to avoid flickering the
 * magic-link-default branch for a user who is actually credentialed.
 */
export default function DangerZone() {
  const { logout, user, loading } = useAuth();
  const triggerReference = useRef<HTMLButtonElement>(null);

  const [phase, setPhase] = useState<Phase>('idle');
  const [reauthError, setReauthError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');

  const isCredentialed = !!(user?.hasPassword || user?.multiFactorMethod);
  const branchReady = !loading && !!user;

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

  // Escape backs out of the credentialed reauth form — matches user
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
          setAuthNotice('account-deleted');
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
      setPhase('email-sent');
    } else {
      // Defensive fallback: if the API ever deletes on the email path,
      // finish cleanly rather than leave the user in a stale UI.
      setAuthNotice('account-deleted');
      logout();
    }
  }, [logout]);

  const handleNeverMind = useCallback(() => {
    void (async () => {
      try {
        await cancelPendingAccountDeletion();
      } catch {
        // Fire-and-forget: a failed cancel leaves the server-side token
        // pending, but the user clicked Never mind. We revert the UI
        // either way; the worst case is the email link still works.
      }
      setPhase('idle');
      requestAnimationFrame(() => triggerReference.current?.focus());
    })();
  }, []);

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
          onPasswordChange={setPassword}
          onCodeChange={setCode}
          onSubmit={handleReauthSubmit}
          onCancel={closeReauth}
        />
      </div>
    );
  }

  if (phase === 'email-sent') {
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
            className="flex gap-2 items-center justify-between text-xs"
          >
            <span className="text-[var(--alert-text)] [[data-theme='nouvelle-vague']_&]:text-gray-700 [[data-theme='nouvelle-vague'][data-mode='dark']_&]:text-gray-400">
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
      aria-labelledby="check-email-heading"
      className="space-y-3 focus:outline-none"
    >
      <h3 id="check-email-heading" className="text-xs font-medium">
        Check your email
      </h3>
      <Alert variant="success">
        We sent a confirmation link to {email}. Click it to permanently delete
        your account. The link expires in 15 minutes.
      </Alert>
      <LinkButton onClick={onNeverMind}>Never mind, keep my account</LinkButton>
    </section>
  );
}
