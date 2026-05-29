import { useAuth } from '../../../auth/AuthContext';
import {
  cancelTotpSetup,
  disable2fa,
  regenerateRecoveryCodes,
  setupTotp,
  verifyTotpSetup,
} from '../../../lib/api';
import { getErrorMessage } from '../../../lib/errors';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';

type ReauthAction = 'disable' | 'regenerate';

/**
 * All state and handlers for `TwoFactorSection`.
 *
 * Manages five mutually-exclusive UI states driven by
 * `(user.twoFactorMethod, user.twoFactorPending, totpSetup, reauthAction)`:
 *
 * - **State A** — 2FA disabled. Shows the "Add authenticator app" button.
 * - **State B** — TOTP setup in progress. Shows `TotpSetupView` with QR +
 *   verification form.
 * - **State C / E** — 2FA enabled. Shows Regenerate / Disable actions.
 * - **State D** — Pending recovery: server reports `twoFactorPending` but no
 *   local `totpSetup`. Shows "Continue setup" / Cancel pair.
 * - **Reauth** — Disable or Regenerate requested, awaiting credentials.
 *
 * `shouldFocusAddAuthenticator` bridges the cancel-then-unmount transition:
 * after `handleCancelTotpSetup` succeeds the TOTP view unmounts and focus
 * would fall to `<body>` — the effect catches the next render that lands in
 * State A and restores focus to "Add authenticator app".
 */
export function useTwoFactor() {
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
  // Set by handleCancelTotpSetup so the next render that lands in State A
  // can return focus to the "Add authenticator app" button. Without this
  // the cancelled button unmounts and focus falls to <body>, dropping
  // keyboard + screen-reader users out of context.
  const shouldFocusAddAuthenticator = useRef(false);

  useEffect(() => {
    if (totpSetup) {
      totpCodeInputReference.current?.focus();
    }
  }, [totpSetup]);

  // Re-authentication state (for disable / regenerate)
  const [reauthAction, setReauthAction] = useState<ReauthAction | null>(null);
  const [reauthPassword, setReauthPassword] = useState('');
  const [reauthCode, setReauthCode] = useState('');

  const handleStartTotpSetup = async () => {
    setError(null);
    setLoading(true);
    try {
      const setup = await setupTotp();
      setTotpSetup(setup);
    } catch (caught: unknown) {
      setError(getErrorMessage(caught, 'Failed to initiate TOTP setup'));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyTotp = async (formEvent: FormEvent) => {
    formEvent.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { recoveryCodes: codes } = await verifyTotpSetup(totpCode);
      setTotpSetup(null);
      setTotpCode('');
      setRecoveryCodes(codes);
    } catch (caught: unknown) {
      setError(getErrorMessage(caught, 'Invalid code'));
    } finally {
      setLoading(false);
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
        await disable2fa(credentials);
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

  const handleRecoveryCodesConfirmed = useCallback(async () => {
    setRecoveryCodes(null);
    await refreshUser();
  }, [refreshUser]);

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
      // refreshUser() clears the server-side twoFactorPending flag so the
      // UI drops out of the "Continue setup" recovery state too.
      await refreshUser();
    } catch (caught: unknown) {
      setError(getErrorMessage(caught, 'Failed to cancel setup'));
    } finally {
      setLoading(false);
    }
  }, [refreshUser]);

  const twoFactorMethod = user?.twoFactorMethod ?? null;
  const twoFactorPending = user?.twoFactorPending ?? false;

  const inStateA =
    !reauthAction && !twoFactorMethod && !totpSetup && !twoFactorPending;

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
    twoFactorMethod,
    twoFactorPending,
    user,
    // handlers
    handleCancelReauth,
    handleCancelTotpSetup,
    handleReauth,
    handleRecoveryCodesConfirmed,
    handleStartTotpSetup,
    handleVerifyTotp,
    setError,
    setReauthAction,
    setReauthCode,
    setReauthPassword,
    setTotpCode,
  };
}
