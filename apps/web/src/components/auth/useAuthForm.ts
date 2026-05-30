import {
  forgotPassword as apiForgotPassword,
  registerMagicLink,
  requestMagicLink,
  verifyOtp,
} from '../../lib/api';
import { consumeAuthNotice } from '../../auth/authNotice';
import { useAuth } from '../../auth/AuthContext';
import { getErrorMessage } from '../../lib/errors';
import { capitalizeFirst } from '../../lib/strings';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export type Mode = 'login' | 'register' | 'forgot-password';
export type MfaChallenge = 'totp' | 'recovery';

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
  const [forgotPasswordSent, setForgotPasswordSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [mfaChallenge, setMfaChallenge] = useState<MfaChallenge | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  // The deletion-confirmation notice is read once and surfaced on the next
  // tick rather than synchronously during render. Screen readers (NVDA and
  // sometimes JAWS) only announce an aria-live region when its content
  // changes after mount — content present on first paint is treated as part
  // of page load and skipped. Deferring the read guarantees the region
  // transitions empty → populated, which all major SRs announce reliably.
  const [notice, setNotice] = useState<string | null>(null);
  const [password, setPassword] = useState('');

  useEffect(() => {
    const pending = consumeAuthNotice();
    if (pending !== null) setNotice(pending);
  }, []);

  function resolveMode(): Mode {
    if (location.pathname === '/signup') return 'register';
    if (location.pathname === '/forgot-password') return 'forgot-password';
    return 'login';
  }
  const mode = resolveMode();

  function postLoginDestination(): string {
    return (location.state as { from?: string })?.from ?? '/unread';
  }

  useEffect(() => {
    setPassword('');
    setError(null);
    setLoading(false);
    setForgotPasswordSent(false);
    setMagicLinkSent(false);

    const emailInputValue = emailReference.current?.value ?? '';
    if (mode !== 'forgot-password' && emailInputValue.length > 0) {
      passwordReference.current?.focus();
      return;
    }
    emailReference.current?.focus();
  }, [mode]);

  useEffect(() => {
    if (mfaChallenge) {
      mfaInputReference.current?.focus();
    }
  }, [mfaChallenge]);

  // move focus to the form-level error when it first appears so keyboard and
  // screen-reader users land on the message. the error Alert is unmounted
  // while error is null, so the ref is null then and focus only fires on the
  // empty -> populated transition, never on clears or unrelated re-renders.
  useEffect(() => {
    if (error) {
      errorReference.current?.focus();
    }
  }, [error]);

  const handleSubmit = async (formEvent: FormEvent) => {
    formEvent.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if ((mode === 'login' || mode === 'register') && password.length === 0) {
        if (mode === 'login') {
          await requestMagicLink(email);
        } else {
          await registerMagicLink(email);
        }
        setMagicLinkSent(true);
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
        setForgotPasswordSent(true);
      }

      if (mode !== 'forgot-password') {
        navigate(postLoginDestination(), { replace: true });
      }
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
    email,
    emailReference,
    error,
    errorReference,
    forgotPasswordSent,
    handleModeChange,
    handleSubmit,
    handleVerifyOtp,
    loading,
    magicLinkSent,
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
    setMagicLinkSent,
    setNotice,
    setPassword,
  };
}
