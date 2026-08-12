import { capitalizeFirst } from '../../lib/strings';
import {
  consumePendingNotice,
  hasPendingNotice,
} from '../../lib/pendingNotice';
import {
  forgotPassword as apiForgotPassword,
  registerMagicLink,
  requestMagicLink,
  verifyOtp,
} from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import { hasStandingSessionOffer } from './standingSessionOffer';
import { noteTypedEmail, takeCarriedEmail } from './carriedEmail';
import { useAuth } from '../../auth/AuthContext';
import { useEffect, useRef, useState } from 'react';
import { useFormError } from './useFormError';
import { useLocation, useNavigate } from 'react-router';
import { useOAuthArrivalError } from './useOAuthArrivalError';
import { useTransientState } from '../../lib/hooks/useTransientState';
import type { FormEvent } from 'react';
import type { NoticeEntry } from '../../lib/pendingNotice';

export type Mode = 'login' | 'register' | 'forgot-password';
export type MfaChallenge = 'totp' | 'recovery';

// the catalog's shape, since a consumed entry is set here whole
type FormNotice = NoticeEntry;

/**
 * Effects below run in declaration order and that order is load-bearing:
 * the mode effect peeks for a pending notice before the effect that
 * consumes it, and the arrival-error effect follows the mode effect so a
 * cleared error cannot land on top of the message it should paint. What
 * the peek finds is queued a commit earlier, by whichever flow sent the
 * user here.
 */
export function useAuthForm() {
  const { login, refreshUser, register } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const emailReference = useRef<HTMLInputElement>(null);
  const errorReference = useRef<HTMLParagraphElement>(null);
  const mfaInputReference = useRef<HTMLInputElement>(null);
  const passwordReference = useRef<HTMLInputElement>(null);

  const [email, setEmail] = useState('');
  const { error, errorFromArrival, setError } = useFormError();
  const [loading, setLoading] = useState(false);
  const [magicLinkSentJustNow, setMagicLinkSentJustNow] = useState(false);
  const [forgotPasswordSentJustNow, setForgotPasswordSentJustNow] =
    useState(false);
  const [mfaChallenge, setMfaChallenge] = useState<MfaChallenge | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [notice, setNotice] = useState<FormNotice | null>(null);
  const [password, setPassword] = useState('');

  const {
    announcement: errorAnnouncement,
    arrived: arrivedWithOAuthError,
    dismissAnnouncement,
    message: oauthErrorMessage,
  } = useOAuthArrivalError();

  // 5000 matches the toast, so the button releases as the toast clears
  useTransientState(magicLinkSentJustNow, false, setMagicLinkSentJustNow, 5000);
  useTransientState(
    forgotPasswordSentJustNow,
    false,
    setForgotPasswordSentJustNow,
    5000,
  );

  function resolveMode(): Mode {
    if (location.pathname === '/signup') return 'register';
    if (location.pathname === '/forgot-password') return 'forgot-password';
    return 'login';
  }
  const mode = resolveMode();

  function postLoginDestination(): string {
    return (location.state as { from?: string })?.from ?? '/unread';
  }

  /**
   * An email waiting to be picked up was typed into a form this user was
   * moved off of, so putting it back is WCAG 3.3.7 Redundant Entry. It is
   * not evidence of how the move ended, and nothing is announced from
   * here: the auth gate saw whether the offer landed, and queues the
   * explanation itself (`offerBounce.ts`).
   */
  useEffect(() => {
    const carriedEmail = takeCarriedEmail();
    if (carriedEmail === null) return;
    setEmail(carriedEmail);
  }, []);

  useEffect(() => {
    noteTypedEmail(email);
  }, [email]);

  useEffect(() => {
    setPassword('');
    setError(null);
    setLoading(false);
    setMagicLinkSentJustNow(false);
    setForgotPasswordSentJustNow(false);

    const hasInboundAnnouncement =
      hasPendingNotice() || arrivedWithOAuthError || hasStandingSessionOffer();
    // auto-focus would flip a screen reader into forms mode, muting it
    if (hasInboundAnnouncement) return;

    const emailInputValue = emailReference.current?.value ?? '';
    if (mode !== 'forgot-password' && emailInputValue.length > 0) {
      passwordReference.current?.focus();
      return;
    }
    emailReference.current?.focus();
  }, [mode, arrivedWithOAuthError, setError]);

  useEffect(() => {
    if (oauthErrorMessage !== null) setError(oauthErrorMessage, 'arrival');
  }, [oauthErrorMessage, setError]);

  useEffect(() => {
    const pending = consumePendingNotice();
    if (pending !== null) setNotice(pending);
  }, []);

  useEffect(() => {
    if (mfaChallenge) {
      mfaInputReference.current?.focus();
    }
  }, [mfaChallenge]);

  // an arrival error must not steal focus; the Alert sits below the inputs
  useEffect(() => {
    if (error && !errorFromArrival) {
      errorReference.current?.focus();
    }
  }, [error, errorFromArrival]);

  const handleSubmit = async (formEvent: FormEvent) => {
    formEvent.preventDefault();

    // two assertive regions would clash
    if (notice !== null && notice.variant === 'error') {
      setNotice(null);
    }

    // a queued announcement would fire stale text over this submit's error
    dismissAnnouncement();

    setError(null);
    setLoading(true);

    try {
      if ((mode === 'login' || mode === 'register') && password.length === 0) {
        if (mode === 'login') {
          await requestMagicLink(email);
        } else {
          await registerMagicLink(email);
        }
        setNotice({
          message: 'Magic link sent!',
          variant: 'success',
        });
        setLoading(false);
        setMagicLinkSentJustNow(true);
        return;
      }

      if (mode === 'login') {
        const result = await login(email, password);
        if (result && 'mfaToken' in result) {
          setMfaToken(result.mfaToken);
          setMfaChallenge(result.mfaMethod);
          return;
        }
      } else if (mode === 'register') {
        await register(email, password);
      } else {
        await apiForgotPassword(email);
        setNotice({
          message: 'Reset link sent!',
          variant: 'success',
        });
        setLoading(false);
        setForgotPasswordSentJustNow(true);
        return;
      }

      navigate(postLoginDestination(), { replace: true });
    } catch (caught: unknown) {
      setError(
        capitalizeFirst(
          getErrorMessage(caught, 'Something went dreadfully wrong'),
        ),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (formEvent: FormEvent) => {
    formEvent.preventDefault();
    if (!mfaToken || !mfaChallenge) return;
    setError(null);
    setLoading(true);
    try {
      await verifyOtp(mfaToken, mfaCode, mfaChallenge);
      await refreshUser();
      setMfaCode('');
      navigate(postLoginDestination(), { replace: true });
    } catch (caught: unknown) {
      setError(capitalizeFirst(getErrorMessage(caught, 'Invalid code')));
      setMfaCode('');
    } finally {
      setLoading(false);
    }
  };

  const handleModeChange = (newMode: Mode) => {
    // an announcement would follow the user to the screen they left for
    dismissAnnouncement();

    const from = (location.state as { from?: string })?.from;
    let path = '/login';
    if (newMode === 'register') path = '/signup';
    else if (newMode === 'forgot-password') path = '/forgot-password';
    navigate(path, { state: { from }, replace: true });
  };

  return {
    // an arrival error has a live region already, a second would race it
    announceError: !errorFromArrival,
    email,
    emailReference,
    error,
    errorAnnouncement,
    errorReference,
    forgotPasswordSentJustNow,
    handleModeChange,
    handleSubmit,
    handleVerifyOtp,
    loading,
    magicLinkSentJustNow,
    mfaChallenge,
    mfaCode,
    mfaInputReference,
    mode,
    notice,
    password,
    passwordReference,
    setEmail,
    setMfaChallenge,
    setMfaCode,
    setError,
    setNotice,
    setPassword,
  };
}
