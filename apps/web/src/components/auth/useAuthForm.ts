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
  // WARN-4: timeout ids for post-magic-link / post-forgot-password
  // success-state holds. The submit button and toast must stay in sync —
  // both render the "sent!" success state for the toast's 3000ms auto-
  // dismiss window. The refs let the mode-change effect cancel pending
  // releases if the user navigates away first.
  const magicLinkSentJustNowReference = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const forgotPasswordSentJustNowReference = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const mfaInputReference = useRef<HTMLInputElement>(null);
  const passwordReference = useRef<HTMLInputElement>(null);

  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Mirrors the toast's lifecycle for magic-link success. Drives the submit
  // button's "Magic link sent!" label, check-mark icon, and disabled state
  // for the same 3000ms the toast is visible. Holding the button in a
  // success state (rather than re-enabling immediately) prevents the user
  // from re-clicking and triggering a second magic-link request while the
  // first email is still arriving.
  const [magicLinkSentJustNow, setMagicLinkSentJustNow] = useState(false);
  // Same shape as magicLinkSentJustNow but for the forgot-password flow.
  // The "Send password reset link" → "Working…" → "Reset link sent!" arc
  // mirrors the magic-link button's three-state lifecycle and holds for
  // the toast's 3000ms window so the two surfaces never disagree.
  const [forgotPasswordSentJustNow, setForgotPasswordSentJustNow] =
    useState(false);
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
  //
  // Notice now carries a variant so error-keyed entries (e.g.
  // `verification-link-invalid`) render with assertive ARIA + error paint.
  const [notice, setNotice] = useState<FormNotice | null>(null);
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
    if (forgotPasswordSentJustNowReference.current !== null) {
      clearTimeout(forgotPasswordSentJustNowReference.current);
      forgotPasswordSentJustNowReference.current = null;
    }
    setPassword('');
    setError(null);
    setLoading(false);
    setMagicLinkSentJustNow(false);
    setForgotPasswordSentJustNow(false);

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

    // Part D: coalesce-on-submit. If a cross-route error toast is still
    // visible when the user attempts a new auth action, dismiss it so the
    // upcoming form-level error Alert is the sole assertive announcement.
    // Without this coalesce, the user would receive two simultaneous
    // assertive announcements (toast + Alert) on the same channel — see
    // WCAG 4.1.3 status messages and ARIA 1.2 §5.2.8.4 (live region
    // politeness must be honored predictably; stacking two assertive
    // regions in the same tick is implementation-defined on most SRs).
    // Success-variant toasts stay visible: they don't fight an upcoming
    // form alert because the channels (polite vs assertive) don't overlap.
    if (notice !== null && notice.variant === 'error') {
      setNotice(null);
    }

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
        // Forgot-password success mirrors the magic-link flow: fire the toast
        // and hold the submit button in a "Reset link sent!" success state
        // for the toast's 3000ms auto-dismiss window so the two surfaces
        // never read as contradictory. The hold also prevents a second
        // click during that window — re-submitting before the email arrives
        // would just queue a duplicate reset request.
        setNotice({
          message: 'Reset link sent!',
          variant: 'success',
        });
        setLoading(false);
        setForgotPasswordSentJustNow(true);
        forgotPasswordSentJustNowReference.current = setTimeout(() => {
          setForgotPasswordSentJustNow(false);
          forgotPasswordSentJustNowReference.current = null;
        }, 3000);
        return;
      }

      // Both login (no MFA) and register fall through to here; the
      // forgot-password branch returned early above, so the prior
      // `mode !== 'forgot-password'` guard is now an unconditional
      // navigate to the post-login destination.
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
    email,
    emailReference,
    error,
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
