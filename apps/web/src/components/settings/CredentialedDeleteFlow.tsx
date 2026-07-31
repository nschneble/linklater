import { deleteMe } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import IconButton from '../common/IconButton';
import ReauthForm from './ReauthForm';
import { setPendingNotice } from '../../lib/pendingNotice';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { User } from '../../auth/AuthContext';

type Phase = 'idle' | 'reauth' | 'reauth-pending';

interface CredentialedDeleteFlowProps {
  /** The authenticated, already-narrowed user (gate owned by `DangerZone`). */
  user: User;
  logout: () => void;
}

/**
 * Account-deletion flow for credentialed accounts (`hasPassword` or
 * `multiFactorMethod`). The trigger reveals `ReauthForm` inline; submitting
 * calls `DELETE /users/me` with the credentials, then logs the user out.
 *
 * Owns trigger-focus, Escape-to-cancel, and return-focus-on-cancel directly
 * (not via `ActionGuard`) so the destructive form-shape gets the same focus
 * contract as the two-step row.
 */
export default function CredentialedDeleteFlow({
  user,
  logout,
}: CredentialedDeleteFlowProps) {
  const triggerReference = useRef<HTMLButtonElement>(null);

  const [phase, setPhase] = useState<Phase>('idle');
  const [reauthError, setReauthError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');

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

  // Escape always cancels the reauth form, regardless of focus location
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
        hasPassword={!!user.hasPassword}
        hasMfa={!!user.multiFactorMethod}
        onPasswordChange={setPassword}
        onCodeChange={setCode}
        onSubmit={handleReauthSubmit}
        onCancel={closeReauth}
      />
    </div>
  );
}
