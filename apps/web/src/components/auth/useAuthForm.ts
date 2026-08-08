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
import { useAuth } from '../../auth/AuthContext';
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useOAuthArrivalError } from './useOAuthArrivalError';
import { useTransientState } from '../../lib/hooks/useTransientState';
import type { FormEvent } from 'react';

export type Mode = 'login' | 'register' | 'forgot-password';
export type MfaChallenge = 'totp' | 'recovery';

interface FormNotice {
  message: string;
  variant: 'success' | 'warning' | 'error';
}

export function useAuthForm() {
  const { login, refreshUser, register } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const emailReference = useRef<HTMLInputElement>(null);
  const errorReference = useRef<HTMLParagraphElement>(null);
  const mfaInputReference = useRef<HTMLInputElement>(null);
  const passwordReference = useRef<HTMLInputElement>(null);

  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // holds the button "sent!" for the toast's 5000ms, blocking a re-request
  const [magicLinkSentJustNow, setMagicLinkSentJustNow] = useState(false);
  // forgot-password version of magicLinkSentJustNow, held for 5000ms
  const [forgotPasswordSentJustNow, setForgotPasswordSentJustNow] =
    useState(false);
  const [mfaChallenge, setMfaChallenge] = useState<MfaChallenge | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  // consumed in an effect so its live region sees a text change
  const [notice, setNotice] = useState<FormNotice | null>(null);
  const [password, setPassword] = useState('');

  // a refused OAuth callback redirects here carrying its reason
  const {
    announcement: errorAnnouncement,
    arrived: arrivedWithOAuthError,
    message: oauthErrorMessage,
  } = useOAuthArrivalError();

  // true while the Alert holds a redirect-borne error: that message is
  // announced by errorAnnouncement, so the Alert stays visual-only
  const [errorFromArrival, setErrorFromArrival] = useState(
    arrivedWithOAuthError,
  );

  // hold both "sent!" flags for the toast's 5000ms, then auto-release
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

  // must precede the consume effect so the peek sees the notice first
  useEffect(() => {
    setPassword('');
    setError(null);
    setLoading(false);
    setMagicLinkSentJustNow(false);
    setForgotPasswordSentJustNow(false);

    // skip auto-focus with a message inbound: focus flips SRs to
    // forms mode and swallows the announcement. hasPendingNotice reads
    // sessionStorage, which a cross-origin OAuth redirect cannot
    // write, so a URL-borne arrival needs its own answer
    if (hasPendingNotice() || arrivedWithOAuthError) return;

    const emailInputValue = emailReference.current?.value ?? '';
    if (mode !== 'forgot-password' && emailInputValue.length > 0) {
      passwordReference.current?.focus();
      return;
    }
    emailReference.current?.focus();
  }, [mode, arrivedWithOAuthError]);

  // declared after the mode effect, which clears `error` on the same mount
  // flush: earlier, both writes would batch and the clear would win
  useEffect(() => {
    if (oauthErrorMessage !== null) setError(oauthErrorMessage);
  }, [oauthErrorMessage]);

  useEffect(() => {
    const pending = consumePendingNotice();
    if (pending !== null) setNotice(pending);
  }, []);

  useEffect(() => {
    if (mfaChallenge) {
      mfaInputReference.current?.focus();
    }
  }, [mfaChallenge]);

  // focus the form error on the empty->populated transition, never on clears
  // and never on arrival: the Alert sits below both inputs, so focusing it
  // would send the next Tab past the fields the user still has to fill
  useEffect(() => {
    if (error && !errorFromArrival) {
      errorReference.current?.focus();
    }
  }, [error, errorFromArrival]);

  const handleSubmit = async (formEvent: FormEvent) => {
    formEvent.preventDefault();

    // drop a lingering error toast on submit; two assertive regions clash
    if (notice !== null && notice.variant === 'error') {
      setNotice(null);
    }

    setError(null);
    setErrorFromArrival(false);
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
        // release loading on success so the button isn't "Working…" mid-toast
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
        // mirrors magic-link: hold "sent!" for 5000ms, blocking a duplicate reset
        setNotice({
          message: 'Reset link sent!',
          variant: 'success',
        });
        setLoading(false);
        setForgotPasswordSentJustNow(true);
        return;
      }

      // login (no MFA) and register land here; forgot-password returned earlier
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
    const from = (location.state as { from?: string })?.from;
    let path = '/login';
    if (newMode === 'register') path = '/signup';
    else if (newMode === 'forgot-password') path = '/forgot-password';
    navigate(path, { state: { from }, replace: true });
  };

  return {
    // an arrival error has a live region already; a second would race it
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
