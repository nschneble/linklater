import {
  cancelTotpSetup,
  disableMfa,
  regenerateRecoveryCodes,
  setupTotp,
  verifyTotpSetup,
} from '../../../lib/api';
import { getErrorMessage } from '../../../lib/errors';
import { useAuth } from '../../../auth/AuthContext';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';

type ReauthAction = 'disable' | 'regenerate';

/**
 * All state and handlers for `MultiFactorSection`.
 *
 * Manages five mutually-exclusive UI states driven by
 * `(user.multiFactorMethod, user.multiFactorPending, totpSetup, reauthAction)`:
 *
 * - **State A** – MFA disabled. Shows the "Add authenticator app" button.
 * - **State B** – TOTP setup in progress. Shows `TotpSetupView` with QR +
 *   verification form.
 * - **State C / E** – MFA enabled. Shows Regenerate / Disable actions.
 * - **State D** – Pending recovery: server reports `multiFactorPending` but no
 *   local `totpSetup`. Shows "Continue setup" / Cancel pair.
 * - **Reauth** – Disable or Regenerate requested, awaiting credentials.
 *
 * `shouldFocusAddAuthenticator` bridges the cancel-then-unmount transition:
 * after `handleCancelTotpSetup` succeeds the TOTP view unmounts and focus
 * would fall to `<body>` – the effect catches the next render that lands in
 * State A and restores focus to "Add authenticator app".
 */
export function useMultiFactor() {
  const { refreshUser, user } = useAuth();

  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // TOTP setup state
  const [totpSetup, setTotpSetup] = useState<{
    qrCodeDataUrl: string;
    secret: string;
  } | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const totpCodeInputReference = useRef<HTMLInputElement>(null);
  const addAuthenticatorReference = useRef<HTMLButtonElement>(null);
  // State A refocuses add-authenticator so cancel-unmount can't hit <body>
  const shouldFocusAddAuthenticator = useRef(false);

  useEffect(() => {
    if (totpSetup) {
      totpCodeInputReference.current?.focus();
    }
  }, [totpSetup]);

  // re-authentication state (for disable / regenerate)
  const [reauthAction, setReauthAction] = useState<ReauthAction | null>(null);
  const [reauthPassword, setReauthPassword] = useState('');
  const [reauthCode, setReauthCode] = useState('');

  const handleStartTotpSetup = async () => {
    setError(null);
    setLoading(true);
    let started = false;
    try {
      const setup = await setupTotp();
      setTotpSetup(setup);
      started = true;
    } catch (caught: unknown) {
      setError(getErrorMessage(caught, 'Failed to initiate TOTP setup'));
    } finally {
      setLoading(false);
    }
    // refresh so AuthContext learns multiFactorPending and keeps setup state
    if (started) {
      try {
        await refreshUser();
      } catch {
        // stale user state resolves on next navigation
      }
    }
  };

  const handleVerifyTotp = async (formEvent: FormEvent) => {
    formEvent.preventDefault();
    setError(null);
    setLoading(true);
    let verified = false;
    try {
      const { recoveryCodes: codes } = await verifyTotpSetup(totpCode);
      setTotpSetup(null);
      setTotpCode('');
      setRecoveryCodes(codes);
      verified = true;
    } catch (caught: unknown) {
      setError(getErrorMessage(caught, 'Invalid code'));
    } finally {
      setLoading(false);
    }
    if (verified) {
      try {
        await refreshUser();
      } catch {
        // stale user state resolves on next navigation
      }
    }
  };

  const handleReauth = async (formEvent: FormEvent) => {
    formEvent.preventDefault();
    setError(null);
    setLoading(true);
    const credentials = {
      currentPassword: reauthPassword || undefined,
      code: reauthCode || undefined,
    };
    try {
      if (reauthAction === 'disable') {
        await disableMfa(credentials);
        setReauthAction(null);
        setReauthPassword('');
        setReauthCode('');
        await refreshUser();
      } else if (reauthAction === 'regenerate') {
        const { recoveryCodes: codes } =
          await regenerateRecoveryCodes(credentials);
        setReauthAction(null);
        setReauthPassword('');
        setReauthCode('');
        setRecoveryCodes(codes);
      }
    } catch (caught: unknown) {
      setError(getErrorMessage(caught, 'Authentication failed'));
    } finally {
      setLoading(false);
    }
  };

  const handleCancelReauth = useCallback(() => {
    setReauthAction(null);
    setError(null);
  }, []);

  const handleCancelTotpSetup = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      await cancelTotpSetup();
      shouldFocusAddAuthenticator.current = true;
      setTotpSetup(null);
      setTotpCode('');
      // refreshUser() clears multiFactorPending so UI leaves "Continue setup"
      await refreshUser();
    } catch (caught: unknown) {
      setError(getErrorMessage(caught, 'Failed to cancel setup'));
    } finally {
      setLoading(false);
    }
  }, [refreshUser]);

  const multiFactorMethod = user?.multiFactorMethod ?? null;
  const multiFactorPending = user?.multiFactorPending ?? false;

  const inStateA =
    !reauthAction && !multiFactorMethod && !totpSetup && !multiFactorPending;

  useEffect(() => {
    if (shouldFocusAddAuthenticator.current && inStateA) {
      addAuthenticatorReference.current?.focus();
      shouldFocusAddAuthenticator.current = false;
    }
  }, [inStateA]);

  return {
    // state
    addAuthenticatorReference,
    error,
    inStateA,
    loading,
    reauthAction,
    reauthCode,
    reauthPassword,
    recoveryCodes,
    totpCode,
    totpCodeInputReference,
    totpSetup,
    multiFactorMethod,
    multiFactorPending,
    user,
    // handlers
    handleCancelReauth,
    handleCancelTotpSetup,
    handleReauth,
    handleStartTotpSetup,
    handleVerifyTotp,
    setError,
    setReauthAction,
    setReauthCode,
    setReauthPassword,
    setTotpCode,
  };
}
