import { useAuth } from '../../../auth/AuthContext';
import {
  cancelTotpSetup,
  disableMfa,
  regenerateRecoveryCodes,
  setupTotp,
  verifyTotpSetup,
} from '../../../lib/api';
import { getErrorMessage } from '../../../lib/errors';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';

type ReauthAction = 'disable' | 'regenerate';

/**
 * All state and handlers for `MultiFactorSection`.
 *
 * Manages five mutually-exclusive UI states driven by
 * `(user.multiFactorMethod, user.multiFactorPending, totpSetup, reauthAction)`:
 *
 * - **State A** — MFA disabled. Shows the "Add authenticator app" button.
 * - **State B** — TOTP setup in progress. Shows `TotpSetupView` with QR +
 *   verification form.
 * - **State C / E** — MFA enabled. Shows Regenerate / Disable actions.
 * - **State D** — Pending recovery: server reports `multiFactorPending` but no
 *   local `totpSetup`. Shows "Continue setup" / Cancel pair.
 * - **Reauth** — Disable or Regenerate requested, awaiting credentials.
 *
 * `shouldFocusAddAuthenticator` bridges the cancel-then-unmount transition:
 * after `handleCancelTotpSetup` succeeds the TOTP view unmounts and focus
 * would fall to `<body>` — the effect catches the next render that lands in
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
  const regenerateButtonReference = useRef<HTMLButtonElement>(null);
  // Set by handleCancelTotpSetup so the next render that lands in State A
  // can return focus to the "Add authenticator app" button. Without this
  // the cancelled button unmounts and focus falls to <body>, dropping
  // keyboard + screen-reader users out of context.
  const shouldFocusAddAuthenticator = useRef(false);
  // Set by handleRecoveryCodesConfirmed so the next render that lands in
  // State C/E (panel hidden, MFA actions visible again) can return focus
  // to "Regenerate recovery codes". Without this the panel collapses and
  // focus falls to <body>.
  const shouldFocusRegenerate = useRef(false);

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

  const handleRecoveryCodesConfirmed = useCallback(async () => {
    shouldFocusRegenerate.current = true;
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
      // refreshUser() clears the server-side multiFactorPending flag so the
      // UI drops out of the "Continue setup" recovery state too.
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

  // After "I've saved these codes" is clicked, the panel unmounts and the
  // State C/E action buttons re-mount. Route focus to the first action so
  // keyboard + screen-reader users stay in context.
  const inStateCE =
    !reauthAction && Boolean(multiFactorMethod) && !recoveryCodes;
  useEffect(() => {
    if (shouldFocusRegenerate.current && inStateCE) {
      regenerateButtonReference.current?.focus();
      shouldFocusRegenerate.current = false;
    }
  }, [inStateCE]);

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
    regenerateButtonReference,
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
