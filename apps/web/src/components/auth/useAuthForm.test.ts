/**
 * Unit tests for useAuthForm.
 *
 * react-router-dom, AuthContext, and the API module are all mocked at the
 * module boundary so the hook can be exercised in isolation without a real
 * router or network layer.
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FormEvent } from 'react';

// ─── Module mocks ────────────────────────────────────────────────────────────

vi.mock('../../lib/api', () => ({
  forgotPassword: vi.fn(),
  registerMagicLink: vi.fn(),
  requestMagicLink: vi.fn(),
  verifyOtp: vi.fn(),
}));

vi.mock('../../auth/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../lib/pendingNotice', () => ({
  consumePendingNotice: vi.fn().mockReturnValue(null),
  hasPendingNotice: vi.fn().mockReturnValue(false),
}));

// ─── Imports after mocks ─────────────────────────────────────────────────────

import { useAuthForm } from './useAuthForm';
import { useAuth } from '../../auth/AuthContext';
import * as pendingNoticeModule from '../../lib/pendingNotice';
import * as apiModule from '../../lib/api';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const USER_EMAIL = 'test@example.com';
const USER_PASSWORD = 'strong-password-123';

function makeAuthContext(
  overrides: Partial<{
    login: ReturnType<typeof vi.fn>;
    register: ReturnType<typeof vi.fn>;
    refreshUser: ReturnType<typeof vi.fn>;
  }> = {},
) {
  return {
    loading: false,
    login: vi.fn().mockResolvedValue(undefined),
    loginWithToken: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn().mockResolvedValue(undefined),
    register: vi.fn().mockResolvedValue(undefined),
    resendEmailChangeVerification: vi.fn(),
    resendVerificationEmail: vi.fn(),
    setPendingEmail: vi.fn(),
    user: null,
    ...overrides,
  };
}

/** Renders useAuthForm inside a MemoryRouter at the given path. */
function renderAuthFormHook(initialPath = '/login') {
  return renderHook(() => useAuthForm(), {
    wrapper: ({ children }) =>
      MemoryRouter({ children, initialEntries: [initialPath] }),
  });
}

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useAuth).mockReturnValue(makeAuthContext());
  vi.mocked(pendingNoticeModule.consumePendingNotice).mockReturnValue(null);
  vi.mocked(pendingNoticeModule.hasPendingNotice).mockReturnValue(false);
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('useAuthForm', () => {
  describe('mode resolution', () => {
    it('resolves to "login" on /login', () => {
      const { result } = renderAuthFormHook('/login');
      expect(result.current.mode).toBe('login');
    });

    it('resolves to "register" on /signup', () => {
      const { result } = renderAuthFormHook('/signup');
      expect(result.current.mode).toBe('register');
    });

    it('resolves to "forgot-password" on /forgot-password', () => {
      const { result } = renderAuthFormHook('/forgot-password');
      expect(result.current.mode).toBe('forgot-password');
    });
  });

  describe('notice – deferred read', () => {
    it('is null on first render before useEffect flushes', () => {
      const { result } = renderAuthFormHook();
      // Synchronous read – effect has not yet flushed
      expect(result.current.notice).toBeNull();
    });

    it('is populated after effects flush when consumePendingNotice returns a success entry', async () => {
      vi.mocked(pendingNoticeModule.consumePendingNotice).mockReturnValue({
        message: 'Your account has been deleted.',
        variant: 'success',
      });
      const { result } = renderAuthFormHook();
      await waitFor(() => {
        expect(result.current.notice).toEqual({
          message: 'Your account has been deleted.',
          variant: 'success',
        });
      });
    });

    it('is populated after effects flush when consumePendingNotice returns an error entry', async () => {
      vi.mocked(pendingNoticeModule.consumePendingNotice).mockReturnValue({
        message: 'Verification link expired.',
        variant: 'error',
      });
      const { result } = renderAuthFormHook();
      await waitFor(() => {
        expect(result.current.notice).toEqual({
          message: 'Verification link expired.',
          variant: 'error',
        });
      });
    });

    it('stays null after effects flush when consumePendingNotice returns null', async () => {
      vi.mocked(pendingNoticeModule.consumePendingNotice).mockReturnValue(null);
      const { result } = renderAuthFormHook();
      await act(async () => {});
      expect(result.current.notice).toBeNull();
    });
  });

  describe('handleSubmit – 9 branches', () => {
    // Branch 1: login + no password → requestMagicLink → success notice
    it('calls requestMagicLink and sets a login notice when login mode has no password', async () => {
      vi.mocked(apiModule.requestMagicLink).mockResolvedValue(undefined);
      const { result } = renderAuthFormHook('/login');

      act(() => result.current.setEmail(USER_EMAIL));

      await act(async () => {
        const event = { preventDefault: vi.fn() } as unknown as FormEvent;
        await result.current.handleSubmit(event);
      });

      expect(apiModule.requestMagicLink).toHaveBeenCalledWith(USER_EMAIL);
      expect(result.current.notice).toEqual({
        message: 'Magic link sent!',
        variant: 'success',
      });
    });

    // Branch 2: register + no password → registerMagicLink → success notice
    it('calls registerMagicLink and sets a signup notice when register mode has no password', async () => {
      vi.mocked(apiModule.registerMagicLink).mockResolvedValue(undefined);
      const { result } = renderAuthFormHook('/signup');

      act(() => result.current.setEmail(USER_EMAIL));

      await act(async () => {
        const event = { preventDefault: vi.fn() } as unknown as FormEvent;
        await result.current.handleSubmit(event);
      });

      expect(apiModule.registerMagicLink).toHaveBeenCalledWith(USER_EMAIL);
      expect(result.current.notice).toEqual({
        message: 'Magic link sent!',
        variant: 'success',
      });
    });

    // Branch 3: login + password → login returns MFA challenge
    it('sets mfaChallenge when login returns an mfaToken', async () => {
      const loginMock = vi.fn().mockResolvedValue({
        mfaToken: 'tok-abc',
        mfaMethod: 'totp',
      });
      vi.mocked(useAuth).mockReturnValue(makeAuthContext({ login: loginMock }));

      const { result } = renderAuthFormHook('/login');
      act(() => {
        result.current.setEmail(USER_EMAIL);
        result.current.setPassword(USER_PASSWORD);
      });

      await act(async () => {
        const event = { preventDefault: vi.fn() } as unknown as FormEvent;
        await result.current.handleSubmit(event);
      });

      expect(result.current.mfaChallenge).toBe('totp');
    });

    // Branch 4: login + password → login succeeds (void, no MFA)
    it('clears loading and does not set mfaChallenge when login succeeds without MFA', async () => {
      const loginMock = vi.fn().mockResolvedValue(undefined);
      vi.mocked(useAuth).mockReturnValue(makeAuthContext({ login: loginMock }));

      const { result } = renderAuthFormHook('/login');
      act(() => {
        result.current.setEmail(USER_EMAIL);
        result.current.setPassword(USER_PASSWORD);
      });

      await act(async () => {
        const event = { preventDefault: vi.fn() } as unknown as FormEvent;
        await result.current.handleSubmit(event);
      });

      expect(result.current.mfaChallenge).toBeNull();
      expect(result.current.loading).toBe(false);
    });

    // Branch 5: register + password → register succeeds
    it('calls register with email and password in register mode', async () => {
      const registerMock = vi.fn().mockResolvedValue(undefined);
      vi.mocked(useAuth).mockReturnValue(
        makeAuthContext({ register: registerMock }),
      );

      const { result } = renderAuthFormHook('/signup');
      act(() => {
        result.current.setEmail(USER_EMAIL);
        result.current.setPassword(USER_PASSWORD);
      });

      await act(async () => {
        const event = { preventDefault: vi.fn() } as unknown as FormEvent;
        await result.current.handleSubmit(event);
      });

      expect(registerMock).toHaveBeenCalledWith(USER_EMAIL, USER_PASSWORD);
      expect(result.current.loading).toBe(false);
    });

    // Branch 6: forgot-password → apiForgotPassword → success toast + hold
    it('calls forgotPassword and fires the success toast notice in forgot-password mode', async () => {
      vi.mocked(apiModule.forgotPassword).mockResolvedValue(undefined);

      const { result } = renderAuthFormHook('/forgot-password');
      act(() => result.current.setEmail(USER_EMAIL));

      await act(async () => {
        const event = { preventDefault: vi.fn() } as unknown as FormEvent;
        await result.current.handleSubmit(event);
      });

      expect(apiModule.forgotPassword).toHaveBeenCalledWith(USER_EMAIL);
      expect(result.current.notice).toEqual({
        message: 'Reset link sent!',
        variant: 'success',
      });
    });

    // Branch 7: handleSubmit throws → setError with Error.message
    it('sets error when login throws an Error', async () => {
      const loginMock = vi
        .fn()
        .mockRejectedValue(new Error('Invalid credentials'));
      vi.mocked(useAuth).mockReturnValue(makeAuthContext({ login: loginMock }));

      const { result } = renderAuthFormHook('/login');
      act(() => {
        result.current.setEmail(USER_EMAIL);
        result.current.setPassword(USER_PASSWORD);
      });

      await act(async () => {
        const event = { preventDefault: vi.fn() } as unknown as FormEvent;
        await result.current.handleSubmit(event);
      });

      expect(result.current.error).toBe('Invalid credentials');
    });

    // Branch 8: login + password + no MFA result (explicit void return path –
    //           same execution as Branch 4 but verifies loading resets to false)
    it('resets loading to false after a successful login', async () => {
      const loginMock = vi.fn().mockResolvedValue(undefined);
      vi.mocked(useAuth).mockReturnValue(makeAuthContext({ login: loginMock }));

      const { result } = renderAuthFormHook('/login');
      act(() => {
        result.current.setEmail(USER_EMAIL);
        result.current.setPassword(USER_PASSWORD);
      });

      await act(async () => {
        const event = { preventDefault: vi.fn() } as unknown as FormEvent;
        await result.current.handleSubmit(event);
      });

      expect(result.current.loading).toBe(false);
    });

    // Branch 9: thrown value is not an Error → fallback message
    it('uses fallback message when a non-Error is thrown', async () => {
      const loginMock = vi.fn().mockRejectedValue('unexpected string error');
      vi.mocked(useAuth).mockReturnValue(makeAuthContext({ login: loginMock }));

      const { result } = renderAuthFormHook('/login');
      act(() => {
        result.current.setEmail(USER_EMAIL);
        result.current.setPassword(USER_PASSWORD);
      });

      await act(async () => {
        const event = { preventDefault: vi.fn() } as unknown as FormEvent;
        await result.current.handleSubmit(event);
      });

      expect(result.current.error).toBe('Something went dreadfully wrong');
    });
  });

  // WARN-4: a successful magic-link request releases `loading` immediately
  // (so the button doesn't read "Working…" while the toast is announcing
  // the outcome) and engages `magicLinkSentJustNow` for the toast's full
  // 5000ms auto-dismiss window. The button stays disabled during that
  // window via the success-state label, preventing a second click.
  describe('WARN-4 – magic-link success-state hold', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('releases loading to false immediately after a successful magic-link request', async () => {
      vi.mocked(apiModule.requestMagicLink).mockResolvedValue(undefined);
      const { result } = renderAuthFormHook('/login');

      act(() => result.current.setEmail(USER_EMAIL));

      await act(async () => {
        const event = { preventDefault: vi.fn() } as unknown as FormEvent;
        await result.current.handleSubmit(event);
      });

      // Loading is released as soon as the API resolves so the button can
      // flip into its success-state label without a "Working…" flash that
      // contradicts the freshly-shown toast.
      expect(result.current.loading).toBe(false);
    });

    it('sets magicLinkSentJustNow to true immediately after a successful magic-link request', async () => {
      vi.mocked(apiModule.requestMagicLink).mockResolvedValue(undefined);
      const { result } = renderAuthFormHook('/login');

      act(() => result.current.setEmail(USER_EMAIL));

      await act(async () => {
        const event = { preventDefault: vi.fn() } as unknown as FormEvent;
        await result.current.handleSubmit(event);
      });

      expect(result.current.magicLinkSentJustNow).toBe(true);
    });

    it('releases magicLinkSentJustNow to false after the 5000ms hold elapses (toast lifetime)', async () => {
      vi.mocked(apiModule.requestMagicLink).mockResolvedValue(undefined);
      const { result } = renderAuthFormHook('/login');

      act(() => result.current.setEmail(USER_EMAIL));

      await act(async () => {
        const event = { preventDefault: vi.fn() } as unknown as FormEvent;
        await result.current.handleSubmit(event);
      });

      expect(result.current.magicLinkSentJustNow).toBe(true);

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(result.current.magicLinkSentJustNow).toBe(false);
    });

    it('keeps magicLinkSentJustNow true until the full 5000ms elapses', async () => {
      vi.mocked(apiModule.requestMagicLink).mockResolvedValue(undefined);
      const { result } = renderAuthFormHook('/login');

      act(() => result.current.setEmail(USER_EMAIL));

      await act(async () => {
        const event = { preventDefault: vi.fn() } as unknown as FormEvent;
        await result.current.handleSubmit(event);
      });

      // 2500ms in – old behavior would have released the hold here.
      act(() => {
        vi.advanceTimersByTime(2500);
      });
      expect(result.current.magicLinkSentJustNow).toBe(true);

      // Past 5000ms – hold releases.
      act(() => {
        vi.advanceTimersByTime(2500);
      });
      expect(result.current.magicLinkSentJustNow).toBe(false);
    });

    it('does not set magicLinkSentJustNow when the magic-link request throws', async () => {
      vi.mocked(apiModule.requestMagicLink).mockRejectedValue(
        new Error('Network down'),
      );
      const { result } = renderAuthFormHook('/login');

      act(() => result.current.setEmail(USER_EMAIL));

      await act(async () => {
        const event = { preventDefault: vi.fn() } as unknown as FormEvent;
        await result.current.handleSubmit(event);
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.magicLinkSentJustNow).toBe(false);
      expect(result.current.error).toBe('Network down');
    });

    // C2: a mode change BEFORE the 5000ms hold expires must clear the
    // pending timer synchronously and reset magicLinkSentJustNow to false.
    // Otherwise the stale timeout fires later on a hook that has already
    // moved on, or worse races with a subsequent magic-link submission.
    it('clears the success-state timer synchronously when the user changes mode mid-hold', async () => {
      vi.mocked(apiModule.requestMagicLink).mockResolvedValue(undefined);
      const { result } = renderAuthFormHook('/login');

      act(() => result.current.setEmail(USER_EMAIL));

      await act(async () => {
        const event = { preventDefault: vi.fn() } as unknown as FormEvent;
        await result.current.handleSubmit(event);
      });

      // Hold is engaged.
      expect(result.current.magicLinkSentJustNow).toBe(true);

      await act(async () => {
        result.current.handleModeChange('register');
      });

      // Synchronously after the mode change, the hold is released – the
      // effect resets it without waiting for the 5000ms timer.
      expect(result.current.magicLinkSentJustNow).toBe(false);

      // Advance past the original 5000ms window. If the timer were still
      // pending, it would call setMagicLinkSentJustNow(false) again – but
      // since we've already observed false, this asserts the state stays
      // false without spurious flips.
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(result.current.magicLinkSentJustNow).toBe(false);
    });
  });

  // Mirrors the WARN-4 magic-link suite for the forgot-password flow. The
  // submit button and toast must stay in sync – both render the "Reset link
  // sent!" state for the toast's 5000ms auto-dismiss window. A mode change
  // mid-hold cancels the timer synchronously.
  describe('forgot-password success-state hold', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('releases loading to false immediately after a successful forgot-password request', async () => {
      vi.mocked(apiModule.forgotPassword).mockResolvedValue(undefined);
      const { result } = renderAuthFormHook('/forgot-password');

      act(() => result.current.setEmail(USER_EMAIL));

      await act(async () => {
        const event = { preventDefault: vi.fn() } as unknown as FormEvent;
        await result.current.handleSubmit(event);
      });

      expect(result.current.loading).toBe(false);
    });

    it('sets forgotPasswordSentJustNow to true immediately after a successful forgot-password request', async () => {
      vi.mocked(apiModule.forgotPassword).mockResolvedValue(undefined);
      const { result } = renderAuthFormHook('/forgot-password');

      act(() => result.current.setEmail(USER_EMAIL));

      await act(async () => {
        const event = { preventDefault: vi.fn() } as unknown as FormEvent;
        await result.current.handleSubmit(event);
      });

      expect(result.current.forgotPasswordSentJustNow).toBe(true);
    });

    it('releases forgotPasswordSentJustNow to false after the 5000ms hold elapses (toast lifetime)', async () => {
      vi.mocked(apiModule.forgotPassword).mockResolvedValue(undefined);
      const { result } = renderAuthFormHook('/forgot-password');

      act(() => result.current.setEmail(USER_EMAIL));

      await act(async () => {
        const event = { preventDefault: vi.fn() } as unknown as FormEvent;
        await result.current.handleSubmit(event);
      });

      expect(result.current.forgotPasswordSentJustNow).toBe(true);

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(result.current.forgotPasswordSentJustNow).toBe(false);
    });

    it('keeps forgotPasswordSentJustNow true until the full 5000ms elapses', async () => {
      vi.mocked(apiModule.forgotPassword).mockResolvedValue(undefined);
      const { result } = renderAuthFormHook('/forgot-password');

      act(() => result.current.setEmail(USER_EMAIL));

      await act(async () => {
        const event = { preventDefault: vi.fn() } as unknown as FormEvent;
        await result.current.handleSubmit(event);
      });

      // 2500ms in – half the hold window.
      act(() => {
        vi.advanceTimersByTime(2500);
      });
      expect(result.current.forgotPasswordSentJustNow).toBe(true);

      // Past 5000ms – hold releases.
      act(() => {
        vi.advanceTimersByTime(2500);
      });
      expect(result.current.forgotPasswordSentJustNow).toBe(false);
    });

    it('does not set forgotPasswordSentJustNow when the forgot-password request throws', async () => {
      vi.mocked(apiModule.forgotPassword).mockRejectedValue(
        new Error('Network down'),
      );
      const { result } = renderAuthFormHook('/forgot-password');

      act(() => result.current.setEmail(USER_EMAIL));

      await act(async () => {
        const event = { preventDefault: vi.fn() } as unknown as FormEvent;
        await result.current.handleSubmit(event);
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.forgotPasswordSentJustNow).toBe(false);
      expect(result.current.error).toBe('Network down');
    });

    // Carry-over from the magic-link hold: a mode change BEFORE the 5000ms
    // hold expires must clear the pending timer synchronously and reset
    // forgotPasswordSentJustNow to false. Otherwise the stale timeout fires
    // later on a hook that has already moved on, or worse races with a
    // subsequent forgot-password submission.
    it('clears the forgot-password success-state timer synchronously when the user changes mode mid-hold', async () => {
      vi.mocked(apiModule.forgotPassword).mockResolvedValue(undefined);
      const { result } = renderAuthFormHook('/forgot-password');

      act(() => result.current.setEmail(USER_EMAIL));

      await act(async () => {
        const event = { preventDefault: vi.fn() } as unknown as FormEvent;
        await result.current.handleSubmit(event);
      });

      // Hold is engaged.
      expect(result.current.forgotPasswordSentJustNow).toBe(true);

      await act(async () => {
        result.current.handleModeChange('login');
      });

      // Synchronously after the mode change, the hold is released.
      expect(result.current.forgotPasswordSentJustNow).toBe(false);

      // Advance past the original 5000ms window – assert no spurious flips.
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(result.current.forgotPasswordSentJustNow).toBe(false);
    });
  });

  // Part D: when a cross-route error toast is still visible at submit time,
  // the form must dismiss it before firing its own form-level error Alert.
  // Otherwise the user receives two simultaneous assertive announcements
  // on the same SR channel (toast role="alert" + Alert role="alert"), which
  // is implementation-defined on most SRs per ARIA 1.2 §5.2.8.4. The
  // success channel doesn't have this collision (polite + assertive don't
  // overlap), so a queued success notice is preserved.
  describe('coalesce-on-submit (error toast dismissed at handleSubmit start)', () => {
    it('dismisses a queued error-variant notice at the top of handleSubmit', async () => {
      vi.mocked(pendingNoticeModule.consumePendingNotice).mockReturnValue({
        message: 'Verification link expired.',
        variant: 'error',
      });
      vi.mocked(apiModule.requestMagicLink).mockResolvedValue(undefined);

      const { result } = renderAuthFormHook('/login');

      // Wait for the consume effect to populate the notice from the mocked
      // pendingNotice read.
      await waitFor(() => {
        expect(result.current.notice).toEqual({
          message: 'Verification link expired.',
          variant: 'error',
        });
      });

      act(() => result.current.setEmail(USER_EMAIL));

      await act(async () => {
        const event = { preventDefault: vi.fn() } as unknown as FormEvent;
        await result.current.handleSubmit(event);
      });

      // After submit, the queued error notice is gone – but the new
      // success notice from the magic-link request has taken its place,
      // proving the dismiss happened at the TOP of handleSubmit (otherwise
      // it would also clobber the success notice fired later in the same
      // handler).
      expect(result.current.notice).toEqual({
        message: 'Magic link sent!',
        variant: 'success',
      });
    });

    it('preserves a queued success-variant notice across handleSubmit (no collision with the form Alert channel)', async () => {
      vi.mocked(pendingNoticeModule.consumePendingNotice).mockReturnValue({
        message: 'Your email has been verified.',
        variant: 'success',
      });
      const loginMock = vi
        .fn()
        .mockRejectedValue(new Error('Invalid credentials'));
      vi.mocked(useAuth).mockReturnValue(makeAuthContext({ login: loginMock }));

      const { result } = renderAuthFormHook('/login');

      await waitFor(() => {
        expect(result.current.notice).toEqual({
          message: 'Your email has been verified.',
          variant: 'success',
        });
      });

      act(() => {
        result.current.setEmail(USER_EMAIL);
        result.current.setPassword(USER_PASSWORD);
      });

      await act(async () => {
        const event = { preventDefault: vi.fn() } as unknown as FormEvent;
        await result.current.handleSubmit(event);
      });

      // The success notice should still be present – only error-variant
      // notices are coalesced. The form-level error Alert is the assertive
      // channel; the success toast is polite, so they don't collide.
      expect(result.current.notice).toEqual({
        message: 'Your email has been verified.',
        variant: 'success',
      });
      expect(result.current.error).toBe('Invalid credentials');
    });
  });

  describe('focus management – mode change', () => {
    it('focuses emailReference when email is empty on mode change', async () => {
      const { result } = renderAuthFormHook('/login');
      // Email ref needs a real DOM node; simulate one
      const emailInput = document.createElement('input');
      const focusSpy = vi.spyOn(emailInput, 'focus');
      Object.defineProperty(result.current.emailReference, 'current', {
        value: emailInput,
        writable: true,
      });

      await act(async () => {
        result.current.handleModeChange('register');
      });

      expect(focusSpy).toHaveBeenCalled();
    });

    it('focuses passwordReference when email is prefilled on mode change', async () => {
      const { result } = renderAuthFormHook('/login');

      const emailInput = document.createElement('input');
      emailInput.value = USER_EMAIL;
      Object.defineProperty(result.current.emailReference, 'current', {
        value: emailInput,
        writable: true,
      });

      const passwordInput = document.createElement('input');
      const focusSpy = vi.spyOn(passwordInput, 'focus');
      Object.defineProperty(result.current.passwordReference, 'current', {
        value: passwordInput,
        writable: true,
      });

      await act(async () => {
        result.current.handleModeChange('register');
      });

      expect(focusSpy).toHaveBeenCalled();
    });

    // FLAG-2: when a pending notice is queued (e.g. account-deleted toast
    // about to be surfaced by AuthForm), the mode-change effect must NOT
    // auto-focus the email input – focusing a text input switches NVDA/JAWS
    // into forms mode and can swallow the polite announcement mid-read.
    it('does not auto-focus the email input on mount when hasPendingNotice is true', async () => {
      vi.mocked(pendingNoticeModule.hasPendingNotice).mockReturnValue(true);

      // Render with a ref pre-wired so we can observe focus calls during
      // the initial mode-change effect on mount.
      const emailInput = document.createElement('input');
      const focusSpy = vi.spyOn(emailInput, 'focus');

      const { result } = renderHook(
        () => {
          const hook = useAuthForm();
          // Assign the input to the ref before the effect runs (refs are
          // wired during render commit, so this mirrors what happens when
          // the real input mounts).
          if (hook.emailReference.current === null) {
            hook.emailReference.current = emailInput;
          }
          return hook;
        },
        {
          wrapper: ({ children }) =>
            MemoryRouter({ children, initialEntries: ['/login'] }),
        },
      );

      // Allow effects to flush
      await act(async () => {});

      expect(focusSpy).not.toHaveBeenCalled();
      // Sanity: the hook itself rendered successfully
      expect(result.current.mode).toBe('login');
    });

    it('does not auto-focus the password input on mount when hasPendingNotice is true (prefilled-email branch)', async () => {
      vi.mocked(pendingNoticeModule.hasPendingNotice).mockReturnValue(true);

      const emailInput = document.createElement('input');
      emailInput.value = USER_EMAIL;
      const passwordInput = document.createElement('input');
      const emailFocusSpy = vi.spyOn(emailInput, 'focus');
      const passwordFocusSpy = vi.spyOn(passwordInput, 'focus');

      renderHook(
        () => {
          const hook = useAuthForm();
          if (hook.emailReference.current === null) {
            hook.emailReference.current = emailInput;
          }
          if (hook.passwordReference.current === null) {
            hook.passwordReference.current = passwordInput;
          }
          return hook;
        },
        {
          wrapper: ({ children }) =>
            MemoryRouter({ children, initialEntries: ['/login'] }),
        },
      );

      await act(async () => {});

      expect(emailFocusSpy).not.toHaveBeenCalled();
      expect(passwordFocusSpy).not.toHaveBeenCalled();
    });

    // C4: negative control for FLAG-2 – when NO pending notice is queued,
    // focus MUST fire as normal. Proves the guard is wired correctly
    // (gated on hasPendingNotice), not just "focus happens to be absent
    // here because the test setup is broken."
    it('DOES auto-focus the email input on mount when hasPendingNotice is false (negative control)', async () => {
      vi.mocked(pendingNoticeModule.hasPendingNotice).mockReturnValue(false);

      const emailInput = document.createElement('input');
      const focusSpy = vi.spyOn(emailInput, 'focus');

      renderHook(
        () => {
          const hook = useAuthForm();
          if (hook.emailReference.current === null) {
            hook.emailReference.current = emailInput;
          }
          return hook;
        },
        {
          wrapper: ({ children }) =>
            MemoryRouter({ children, initialEntries: ['/login'] }),
        },
      );

      await act(async () => {});

      expect(focusSpy).toHaveBeenCalled();
    });
  });

  describe('focus management – mfaChallenge', () => {
    it('focuses mfaInputReference when mfaChallenge becomes non-null', async () => {
      const { result } = renderAuthFormHook('/login');

      const mfaInput = document.createElement('input');
      const focusSpy = vi.spyOn(mfaInput, 'focus');
      Object.defineProperty(result.current.mfaInputReference, 'current', {
        value: mfaInput,
        writable: true,
      });

      await act(async () => {
        result.current.setMfaChallenge('totp');
      });

      expect(focusSpy).toHaveBeenCalled();
    });
  });

  describe('focus management – error', () => {
    it('focuses errorReference when error transitions from null to a string', async () => {
      const { result } = renderAuthFormHook('/login');

      const errorParagraph = document.createElement('p');
      const focusSpy = vi.spyOn(errorParagraph, 'focus');
      Object.defineProperty(result.current.errorReference, 'current', {
        value: errorParagraph,
        writable: true,
      });

      await act(async () => {
        result.current.setError('Something went wrong');
      });

      expect(focusSpy).toHaveBeenCalled();
    });

    it('does not call focus again when error is cleared back to null', async () => {
      const { result } = renderAuthFormHook('/login');

      const errorParagraph = document.createElement('p');
      const focusSpy = vi.spyOn(errorParagraph, 'focus');
      Object.defineProperty(result.current.errorReference, 'current', {
        value: errorParagraph,
        writable: true,
      });

      await act(async () => {
        result.current.setError('Error occurred');
      });

      const callCountAfterSet = focusSpy.mock.calls.length;

      await act(async () => {
        result.current.setError(null);
      });

      // Focus should not have been called again after clearing
      expect(focusSpy.mock.calls.length).toBe(callCountAfterSet);
    });
  });
});
