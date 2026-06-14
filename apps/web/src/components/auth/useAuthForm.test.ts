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

vi.mock('../../auth/authNotice', () => ({
  consumeAuthNotice: vi.fn().mockReturnValue(null),
  hasAuthNotice: vi.fn().mockReturnValue(false),
}));

// ─── Imports after mocks ─────────────────────────────────────────────────────

import { useAuthForm } from './useAuthForm';
import { useAuth } from '../../auth/AuthContext';
import * as authNoticeModule from '../../auth/authNotice';
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
  vi.mocked(authNoticeModule.consumeAuthNotice).mockReturnValue(null);
  vi.mocked(authNoticeModule.hasAuthNotice).mockReturnValue(false);
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

  describe('notice — deferred read', () => {
    it('is null on first render before useEffect flushes', () => {
      const { result } = renderAuthFormHook();
      // Synchronous read — effect has not yet flushed
      expect(result.current.notice).toBeNull();
    });

    it('is populated after effects flush when consumeAuthNotice returns a string', async () => {
      vi.mocked(authNoticeModule.consumeAuthNotice).mockReturnValue(
        'Your account has been deleted.',
      );
      const { result } = renderAuthFormHook();
      await waitFor(() => {
        expect(result.current.notice).toBe('Your account has been deleted.');
      });
    });

    it('stays null after effects flush when consumeAuthNotice returns null', async () => {
      vi.mocked(authNoticeModule.consumeAuthNotice).mockReturnValue(null);
      const { result } = renderAuthFormHook();
      await act(async () => {});
      expect(result.current.notice).toBeNull();
    });
  });

  describe('handleSubmit — 9 branches', () => {
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
      expect(result.current.notice).toBe('Check your email for a login link.');
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
      expect(result.current.notice).toBe(
        'Check your email to complete signup.',
      );
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

    // Branch 6: forgot-password → apiForgotPassword → setForgotPasswordSent
    it('calls forgotPassword and sets forgotPasswordSent in forgot-password mode', async () => {
      vi.mocked(apiModule.forgotPassword).mockResolvedValue(undefined);

      const { result } = renderAuthFormHook('/forgot-password');
      act(() => result.current.setEmail(USER_EMAIL));

      await act(async () => {
        const event = { preventDefault: vi.fn() } as unknown as FormEvent;
        await result.current.handleSubmit(event);
      });

      expect(apiModule.forgotPassword).toHaveBeenCalledWith(USER_EMAIL);
      expect(result.current.forgotPasswordSent).toBe(true);
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

    // Branch 8: login + password + no MFA result (explicit void return path —
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

  // WARN-4: a successful magic-link request must hold `loading` true for
  // ~1500ms so the user cannot immediately re-click the submit button. The
  // hold is independent of the toast's own auto-dismiss timer.
  describe('WARN-4 — magic-link loading hold', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('keeps loading true immediately after a successful magic-link request', async () => {
      vi.mocked(apiModule.requestMagicLink).mockResolvedValue(undefined);
      const { result } = renderAuthFormHook('/login');

      act(() => result.current.setEmail(USER_EMAIL));

      await act(async () => {
        const event = { preventDefault: vi.fn() } as unknown as FormEvent;
        await result.current.handleSubmit(event);
      });

      expect(result.current.loading).toBe(true);
    });

    it('releases loading to false after the 1500ms hold elapses', async () => {
      vi.mocked(apiModule.requestMagicLink).mockResolvedValue(undefined);
      const { result } = renderAuthFormHook('/login');

      act(() => result.current.setEmail(USER_EMAIL));

      await act(async () => {
        const event = { preventDefault: vi.fn() } as unknown as FormEvent;
        await result.current.handleSubmit(event);
      });

      expect(result.current.loading).toBe(true);

      act(() => {
        vi.advanceTimersByTime(1500);
      });

      expect(result.current.loading).toBe(false);
    });

    it('releases loading normally (no hold) when the magic-link request throws', async () => {
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
      expect(result.current.error).toBe('Network down');
    });
  });

  describe('focus management — mode change', () => {
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
    // auto-focus the email input — focusing a text input switches NVDA/JAWS
    // into forms mode and can swallow the polite announcement mid-read.
    it('does not auto-focus the email input on mount when hasAuthNotice is true', async () => {
      vi.mocked(authNoticeModule.hasAuthNotice).mockReturnValue(true);

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

    it('does not auto-focus the password input on mount when hasAuthNotice is true (prefilled-email branch)', async () => {
      vi.mocked(authNoticeModule.hasAuthNotice).mockReturnValue(true);

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
  });

  describe('focus management — mfaChallenge', () => {
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

  describe('focus management — error', () => {
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
