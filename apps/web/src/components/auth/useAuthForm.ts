import {
  forgotPassword as apiForgotPassword,
  registerMagicLink,
  requestMagicLink,
  verifyOtp,
} from '../../lib/api';
import {
  consumePendingNotice,
  hasPendingNotice,
} from '../../lib/pendingNotice';
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
  // WARN-4: timeout id for the post-magic-link success-state hold. The button
  // and toast must stay in sync — both render the "magic link sent" state
  // for the toast's 3000ms auto-dismiss window. The ref lets the mode-change
  // effect cancel the pending release if the user navigates away first.
  const magicLinkSentJustNowReference = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const mfaInputReference = useRef<HTMLInputElement>(null);
  const passwordReference = useRef<HTMLInputElement>(null);

  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [forgotPasswordSent, setForgotPasswordSent] = useState(false);
  const [loading, setLoading] = useState(false);
  // Mirrors the toast's lifecycle for magic-link success. Drives the submit
  // button's "Magic link sent!" label, check-mark icon, and disabled state
  // for the same 3000ms the toast is visible. Holding the button in a
  // success state (rather than re-enabling immediately) prevents the user
  // from re-clicking and triggering a second magic-link request while the
  // first email is still arriving.
  const [magicLinkSentJustNow, setMagicLinkSentJustNow] = useState(false);
  const [mfaChallenge, setMfaChallenge] = useState<MfaChallenge | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  // The cross-route notice (e.g. account-deleted) is read once on mount.
  // Deferred to a useEffect (not synchronous render) because NVDA and
  // sometimes JAWS only announce an aria-live region when its content
  // changes after mount — content present on first paint is treated as
  // part of page load and skipped. Deferring guarantees the region
  // transitions empty → populated, which all major SRs announce reliably.
  //
  // useAuthForm reads this directly via `consumePendingNotice` (not via
  // the `usePendingNotice` hook) so the peek-before-consume ordering with
  // the mode-change effect below stays intact — effects fire in
  // declaration order, and the peek (`hasPendingNotice()` inside the
  // mode-change effect) must run BEFORE this consume effect clears the
  // sessionStorage key. See [[feedback-peek-before-consume-effect-order]].
  // `LinksView` consumes via the `usePendingNotice` hook because it has
  // no peek requirement.
  const [notice, setNotice] = useState<string | null>(null);
  const [password, setPassword] = useState('');

  function resolveMode(): Mode {
    if (location.pathname === '/signup') return 'register';
    if (location.pathname === '/forgot-password') return 'forgot-password';
    return 'login';
  }
  const mode = resolveMode();

  function postLoginDestination(): string {
    return (location.state as { from?: string })?.from ?? '/unread';
  }

  // Declared before the consume effect below so that on mount this peek
  // sees the queued notice before consumePendingNotice clears it. After
  // this effect returns, the consume effect fires and the next mode
  // change will (correctly) get hasPendingNotice() === false. Effects
  // fire in declaration order — see
  // [[feedback-peek-before-consume-effect-order]].
  useEffect(() => {
    if (magicLinkSentJustNowReference.current !== null) {
      clearTimeout(magicLinkSentJustNowReference.current);
      magicLinkSentJustNowReference.current = null;
    }
    setPassword('');
    setError(null);
    setLoading(false);
    setMagicLinkSentJustNow(false);
    setForgotPasswordSent(false);

    // Skip auto-focus when a pending notice is queued — focusing a text
    // input switches NVDA/JAWS into forms mode and can swallow the polite
    // announcement mid-read (WCAG 4.1.3 status messages). The user can
    // Tab in deliberately after hearing the toast.
    if (hasPendingNotice()) return;

    const emailInputValue = emailReference.current?.value ?? '';
    if (mode !== 'forgot-password' && emailInputValue.length > 0) {
      passwordReference.current?.focus();
      return;
    }
    emailReference.current?.focus();
  }, [mode]);

  useEffect(() => {
    const pending = consumePendingNotice();
    if (pending !== null) setNotice(pending);
  }, []);

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
          setNotice('Check your email for a login link.');
        } else {
          await registerMagicLink(email);
          setNotice('Check your email to complete signup.');
        }
        // WARN-4: on success, release loading immediately so the button no
        // longer reads "Working…" while the toast is already announcing the
        // outcome — that desync is what made the prior flow look
        // contradictory. The button then enters the success-state hold
        // (`magicLinkSentJustNow`) for 3000ms, matching the toast's own
        // auto-dismiss window. The hold also prevents a second click during
        // that window. A throw skips this block entirely and falls through
        // to the finally reset.
        setLoading(false);
        setMagicLinkSentJustNow(true);
        magicLinkSentJustNowReference.current = setTimeout(() => {
          setMagicLinkSentJustNow(false);
          magicLinkSentJustNowReference.current = null;
        }, 3000);
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
