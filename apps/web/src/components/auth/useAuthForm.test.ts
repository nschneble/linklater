/**
 * Unit tests for useAuthForm.
 *
 * react-router, AuthContext, and the API module are all mocked at the
 * module boundary so the hook can be exercised in isolation without a real
 * router or network layer.
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
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
  setPendingNotice: vi.fn(),
}));

// the predicate is a storage read; its own suite covers what it reads
vi.mock('./standingSessionOffer', () => ({
  hasStandingSessionOffer: vi.fn().mockReturnValue(false),
}));

// ─── Imports after mocks ─────────────────────────────────────────────────────

import * as apiModule from '../../lib/api';
import {
  carryTypedEmail,
  hasCarriedEmail,
  takeCarriedEmail,
} from '../../auth/AuthContext/carriedEmail';
import { makeAuthContext } from '../../../test/factories';
import * as pendingNoticeModule from '../../lib/pendingNotice';
import * as standingOfferModule from './standingSessionOffer';
import { useAuth } from '../../auth/AuthContext';
import { useAuthForm } from './useAuthForm';
import type { NoticeEntry } from '../../lib/pendingNotice';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const USER_EMAIL = 'test@example.com';
const USER_PASSWORD = 'strong-password-123';

/** Renders useAuthForm inside a MemoryRouter at the given path. */
function renderAuthFormHook(initialPath = '/login', reactStrictMode = false) {
  return renderHook(() => useAuthForm(), {
    reactStrictMode,
    wrapper: ({ children }) =>
      MemoryRouter({ children, initialEntries: [initialPath] }),
  });
}

/**
 * Stubs the store's one-shot read: the entry once, `null` after. A stub
 * that answers the same entry every time models a store this app does not
 * have, and hands the second of StrictMode's two effect passes a clean
 * answer no real mount would get.
 */
function queueOnce(entry: NoticeEntry) {
  let unread = true;
  vi.mocked(pendingNoticeModule.consumePendingNotice).mockImplementation(() => {
    if (!unread) return null;
    unread = false;
    return entry;
  });
}

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useAuth).mockReturnValue(makeAuthContext());
  vi.mocked(pendingNoticeModule.consumePendingNotice).mockReturnValue(null);
  vi.mocked(pendingNoticeModule.hasPendingNotice).mockReturnValue(false);
  vi.mocked(standingOfferModule.hasStandingSessionOffer).mockReturnValue(false);
  sessionStorage.clear();
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
      // synchronous read: effect has not yet flushed
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

    // StrictMode, because the app mounts in it and runs effects twice
    it('survives the mount that consumed it and goes on a mode change', async () => {
      queueOnce({
        message: "We couldn't get you back into that session",
        variant: 'warning',
        standing: true,
      });
      const { result } = renderAuthFormHook('/login', true);

      await waitFor(() => expect(result.current.notice).not.toBeNull());

      await act(async () => {
        result.current.handleModeChange('register');
      });

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

    // Branch 8: login + password, no MFA; asserts loading resets to false (cf. Branch 4)
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

  // magic-link success frees loading at once but holds the 5000ms toast window so the button stays disabled
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

      // loading frees at once so the button skips a "Working…" flash
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

      // 2500ms in: still within the 5000ms hold
      act(() => {
        vi.advanceTimersByTime(2500);
      });
      expect(result.current.magicLinkSentJustNow).toBe(true);

      // past 5000ms: hold releases
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

    // C2: a mode change mid-hold must clear the timer, else a stale timeout races a later submit
    it('clears the success-state timer synchronously when the user changes mode mid-hold', async () => {
      vi.mocked(apiModule.requestMagicLink).mockResolvedValue(undefined);
      const { result } = renderAuthFormHook('/login');

      act(() => result.current.setEmail(USER_EMAIL));

      await act(async () => {
        const event = { preventDefault: vi.fn() } as unknown as FormEvent;
        await result.current.handleSubmit(event);
      });

      // hold is engaged
      expect(result.current.magicLinkSentJustNow).toBe(true);

      await act(async () => {
        result.current.handleModeChange('register');
      });

      // mode change releases the hold synchronously, not on the 5000ms timer
      expect(result.current.magicLinkSentJustNow).toBe(false);

      // advance past 5000ms: a still-pending timer would re-flip state; assert it stays false
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(result.current.magicLinkSentJustNow).toBe(false);
    });
  });

  // forgot-password mirror of the WARN-4 hold: button + toast sync for 5000ms, mode change cancels the timer
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

      // 2500ms in: half the hold window
      act(() => {
        vi.advanceTimersByTime(2500);
      });
      expect(result.current.forgotPasswordSentJustNow).toBe(true);

      // past 5000ms: hold releases
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

    // a mode change mid-hold must clear the timer, else a stale timeout races a later submit
    it('clears the forgot-password success-state timer synchronously when the user changes mode mid-hold', async () => {
      vi.mocked(apiModule.forgotPassword).mockResolvedValue(undefined);
      const { result } = renderAuthFormHook('/forgot-password');

      act(() => result.current.setEmail(USER_EMAIL));

      await act(async () => {
        const event = { preventDefault: vi.fn() } as unknown as FormEvent;
        await result.current.handleSubmit(event);
      });

      // hold is engaged
      expect(result.current.forgotPasswordSentJustNow).toBe(true);

      await act(async () => {
        result.current.handleModeChange('login');
      });

      // synchronously after the mode change, the hold is released
      expect(result.current.forgotPasswordSentJustNow).toBe(false);

      // advance past 5000ms; assert no spurious flips
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(result.current.forgotPasswordSentJustNow).toBe(false);
    });
  });

  // Part D: dismiss a lingering error toast before the form's own error Alert, else two role="alert" announcements collide (ARIA 1.2 §5.2.8.4)
  describe('coalesce-on-submit (error toast dismissed at handleSubmit start)', () => {
    it('replaces a queued error-variant notice with the success that follows', async () => {
      vi.mocked(pendingNoticeModule.consumePendingNotice).mockReturnValue({
        message: 'Verification link expired.',
        variant: 'error',
      });
      vi.mocked(apiModule.requestMagicLink).mockResolvedValue(undefined);

      const { result } = renderAuthFormHook('/login');

      // wait for the consume effect to populate the notice
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

      // the magic-link write reaches this whether or not the clear ran
      expect(result.current.notice).toEqual({
        message: 'Magic link sent!',
        variant: 'success',
      });
    });

    // a failing submit writes no notice, so an empty one is the clear
    it('clears a queued error-variant notice when the submit itself fails', async () => {
      vi.mocked(pendingNoticeModule.consumePendingNotice).mockReturnValue({
        message: 'Verification link expired.',
        variant: 'error',
      });
      const loginMock = vi
        .fn()
        .mockRejectedValue(new Error('Invalid credentials'));
      vi.mocked(useAuth).mockReturnValue(makeAuthContext({ login: loginMock }));

      const { result } = renderAuthFormHook('/login');

      await waitFor(() => {
        expect(result.current.notice).toEqual({
          message: 'Verification link expired.',
          variant: 'error',
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

      expect(result.current.notice).toBeNull();
      expect(result.current.error).toBe('Invalid credentials');
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

      // success notice survives: only error-variant notices coalesce (polite toast vs assertive Alert don't collide)
      expect(result.current.notice).toEqual({
        message: 'Your email has been verified.',
        variant: 'success',
      });
      expect(result.current.error).toBe('Invalid credentials');
    });
  });

  // the address survives the offer's bounce rather than being retyped
  describe('carried email', () => {
    const TYPED_EMAIL = 'typed@example.com';

    it('prefills the email input from the value the offer carried', async () => {
      sessionStorage.setItem('linklater_carried_email', TYPED_EMAIL);

      const { result } = renderAuthFormHook('/login');
      await act(async () => {});

      expect(result.current.email).toBe(TYPED_EMAIL);
      expect(hasCarriedEmail()).toBe(false);
    });

    it('notes what was typed, so the offer has an address to carry', async () => {
      const { result } = renderAuthFormHook('/login');

      act(() => result.current.setEmail(TYPED_EMAIL));
      await act(async () => {});

      carryTypedEmail();

      expect(takeCarriedEmail()).toBe(TYPED_EMAIL);
    });
  });

  describe('focus management – mode change', () => {
    it('focuses emailReference when email is empty on mode change', async () => {
      const { result } = renderAuthFormHook('/login');
      // email ref needs a real DOM node; simulate one
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

    // FLAG-2: don't auto-focus email when a notice is queued - focusing a text input flips NVDA/JAWS to forms mode and swallows the announcement
    it('does not auto-focus the email input on mount when hasPendingNotice is true', async () => {
      vi.mocked(pendingNoticeModule.hasPendingNotice).mockReturnValue(true);

      // pre-wire the ref to observe focus during the mount effect
      const emailInput = document.createElement('input');
      const focusSpy = vi.spyOn(emailInput, 'focus');

      const { result } = renderHook(
        () => {
          const hook = useAuthForm();
          // assign the ref before the effect runs, mirroring real input mount
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

      // allow effects to flush
      await act(async () => {});

      expect(focusSpy).not.toHaveBeenCalled();
      // sanity: the hook itself rendered successfully
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

    // focus into the email input would land on top of the standing offer
    it('does not auto-focus the email input on mount when a session offer is standing', async () => {
      vi.mocked(standingOfferModule.hasStandingSessionOffer).mockReturnValue(
        true,
      );

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

      expect(focusSpy).not.toHaveBeenCalled();
    });

    // C4: negative control for FLAG-2 - no pending notice, so focus must fire, proving the guard is gated not just absent
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

      // focus should not have been called again after clearing
      expect(focusSpy.mock.calls.length).toBe(callCountAfterSet);
    });
  });

  // a refused OAuth callback redirects to /login?error=…&provider=…; the API
  // used to leave the browser on a raw JSON 401 with no way back in
  describe('OAuth arrival error', () => {
    const ARRIVAL_PATH =
      '/login?error=provider_email_unverified&provider=google';
    const ARRIVAL_MESSAGE =
      "Google hasn't confirmed this email address. Log in with your email instead.";
    const ANNOUNCE_DELAY_MS = 1000;

    /** Renders the hook, letting the caller wire refs before effects run. */
    function renderWithReferences(
      path: string,
      assignReferences: (hook: ReturnType<typeof useAuthForm>) => void,
    ) {
      return renderHook(
        () => {
          const hook = useAuthForm();
          assignReferences(hook);
          return hook;
        },
        {
          wrapper: ({ children }) =>
            MemoryRouter({ children, initialEntries: [path] }),
        },
      );
    }

    it('surfaces the redirect code as the form error', async () => {
      const { result } = renderAuthFormHook(ARRIVAL_PATH);

      await waitFor(() => {
        expect(result.current.error).toBe(ARRIVAL_MESSAGE);
      });
    });

    it('falls back to provider-agnostic copy when the redirect names no provider', async () => {
      const { result } = renderAuthFormHook(
        '/login?error=provider_email_unverified',
      );

      await waitFor(() => {
        expect(result.current.error).toBe(
          "That sign-in didn't confirm this email address. Log in with your email instead.",
        );
      });
    });

    // the mode effect's hasPendingNotice guard can't see this one: a
    // cross-origin redirect cannot write sessionStorage
    it('does not auto-focus the email input when the URL carries an error', async () => {
      const emailInput = document.createElement('input');
      const focusSpy = vi.spyOn(emailInput, 'focus');

      const { result } = renderWithReferences(ARRIVAL_PATH, (hook) => {
        if (hook.emailReference.current === null) {
          hook.emailReference.current = emailInput;
        }
      });

      await waitFor(() => {
        expect(result.current.error).toBe(ARRIVAL_MESSAGE);
      });
      expect(focusSpy).not.toHaveBeenCalled();
    });

    // C5: negative control for the arrival guard. AuthForm never remounts
    // across the auth routes, so a guard frozen at its mount value skips
    // auto-focus for every mode switch left in the session
    it('DOES auto-focus the email input on a mode change after an arrival (negative control)', async () => {
      const emailInput = document.createElement('input');
      const focusSpy = vi.spyOn(emailInput, 'focus');

      const { result } = renderWithReferences(ARRIVAL_PATH, (hook) => {
        if (hook.emailReference.current === null) {
          hook.emailReference.current = emailInput;
        }
      });

      await waitFor(() => {
        expect(result.current.error).toBe(ARRIVAL_MESSAGE);
      });
      expect(focusSpy).not.toHaveBeenCalled();

      await act(async () => {
        result.current.handleModeChange('register');
      });

      expect(result.current.mode).toBe('register');
      expect(focusSpy).toHaveBeenCalled();
    });

    it('does not focus the error alert when the error arrived on the URL', async () => {
      const errorParagraph = document.createElement('p');
      const focusSpy = vi.spyOn(errorParagraph, 'focus');

      const { result } = renderWithReferences(ARRIVAL_PATH, (hook) => {
        if (hook.errorReference.current === null) {
          hook.errorReference.current = errorParagraph;
        }
      });

      await waitFor(() => {
        expect(result.current.error).toBe(ARRIVAL_MESSAGE);
      });
      expect(focusSpy).not.toHaveBeenCalled();
    });

    it('leaves the Alert without a live region while it holds the arrival error', async () => {
      const { result } = renderAuthFormHook(ARRIVAL_PATH);

      await waitFor(() => {
        expect(result.current.error).toBe(ARRIVAL_MESSAGE);
      });
      expect(result.current.announceError).toBe(false);
    });

    it('announces nothing on a clean arrival (negative control)', async () => {
      const { result } = renderAuthFormHook('/login');

      await act(async () => {});

      expect(result.current.error).toBeNull();
      expect(result.current.announceError).toBe(true);
      expect(result.current.errorAnnouncement).toBe('');
    });

    it('gives the Alert back its live region and its focus on the next submit', async () => {
      const loginMock = vi
        .fn()
        .mockRejectedValue(new Error('Invalid credentials'));
      vi.mocked(useAuth).mockReturnValue(makeAuthContext({ login: loginMock }));

      const errorParagraph = document.createElement('p');
      const focusSpy = vi.spyOn(errorParagraph, 'focus');
      const { result } = renderWithReferences(ARRIVAL_PATH, (hook) => {
        if (hook.errorReference.current === null) {
          hook.errorReference.current = errorParagraph;
        }
      });

      await waitFor(() => {
        expect(result.current.error).toBe(ARRIVAL_MESSAGE);
      });

      act(() => {
        result.current.setEmail(USER_EMAIL);
        result.current.setPassword(USER_PASSWORD);
      });
      await act(async () => {
        const event = { preventDefault: vi.fn() } as unknown as FormEvent;
        await result.current.handleSubmit(event);
      });

      expect(result.current.error).toBe('Invalid credentials');
      expect(result.current.announceError).toBe(true);
      expect(focusSpy).toHaveBeenCalled();
    });

    // the catalog copy and the API's error strings are two vocabularies
    // with nothing keeping them disjoint, and an overlap fails silently:
    // the Alert drops its role, the focus effect skips it, and the submit
    // has already dismissed the mirror
    it('announces a submit error that repeats the arrival copy', async () => {
      const loginMock = vi.fn().mockRejectedValue(new Error(ARRIVAL_MESSAGE));
      vi.mocked(useAuth).mockReturnValue(makeAuthContext({ login: loginMock }));

      const errorParagraph = document.createElement('p');
      const focusSpy = vi.spyOn(errorParagraph, 'focus');
      const { result } = renderWithReferences(ARRIVAL_PATH, (hook) => {
        if (hook.errorReference.current === null) {
          hook.errorReference.current = errorParagraph;
        }
      });

      await waitFor(() => {
        expect(result.current.error).toBe(ARRIVAL_MESSAGE);
      });
      expect(focusSpy).not.toHaveBeenCalled();

      act(() => {
        result.current.setEmail(USER_EMAIL);
        result.current.setPassword(USER_PASSWORD);
      });
      await act(async () => {
        const event = { preventDefault: vi.fn() } as unknown as FormEvent;
        await result.current.handleSubmit(event);
      });

      // same string, different channel: the Alert speaks for this one
      expect(result.current.error).toBe(ARRIVAL_MESSAGE);
      expect(result.current.announceError).toBe(true);
      expect(focusSpy).toHaveBeenCalled();
    });

    describe('announcement timing', () => {
      beforeEach(() => {
        vi.useFakeTimers();
      });

      afterEach(() => {
        vi.useRealTimers();
      });

      it('holds the announcement back past the page-load window, then fires it', async () => {
        const { result } = renderAuthFormHook(ARRIVAL_PATH);

        await act(async () => {});

        // painted, but silent: a region populated on first paint is skipped
        expect(result.current.error).toBe(ARRIVAL_MESSAGE);
        expect(result.current.errorAnnouncement).toBe('');

        await act(async () => {
          vi.advanceTimersByTime(ANNOUNCE_DELAY_MS);
        });

        expect(result.current.errorAnnouncement).toBe(ARRIVAL_MESSAGE);
      });

      // useReannounce reads its message at fire time, so a submit inside
      // the hold window used to announce the stale arrival text next to
      // the error the submit had just produced
      it('drops the queued announcement when a submit supersedes it', async () => {
        const loginMock = vi
          .fn()
          .mockRejectedValue(new Error('Invalid credentials'));
        vi.mocked(useAuth).mockReturnValue(
          makeAuthContext({ login: loginMock }),
        );

        const { result } = renderAuthFormHook(ARRIVAL_PATH);
        await act(async () => {});
        expect(result.current.errorAnnouncement).toBe('');

        act(() => {
          result.current.setEmail(USER_EMAIL);
          result.current.setPassword(USER_PASSWORD);
        });
        await act(async () => {
          const event = { preventDefault: vi.fn() } as unknown as FormEvent;
          await result.current.handleSubmit(event);
        });

        await act(async () => {
          vi.advanceTimersByTime(ANNOUNCE_DELAY_MS);
        });

        expect(result.current.error).toBe('Invalid credentials');
        expect(result.current.errorAnnouncement).toBe('');
        // the Alert takes its own live region back for the submit error
        expect(result.current.announceError).toBe(true);
      });

      // a mode change inside the hold window sends focus into the new
      // screen while the queued text still fires a beat later, unlabelled
      // and last in a document with no `main` landmark
      it('drops the queued announcement when a mode change supersedes it', async () => {
        const { result } = renderAuthFormHook(ARRIVAL_PATH);
        await act(async () => {});
        expect(result.current.errorAnnouncement).toBe('');

        await act(async () => {
          result.current.handleModeChange('register');
        });

        await act(async () => {
          vi.advanceTimersByTime(ANNOUNCE_DELAY_MS);
        });

        expect(result.current.mode).toBe('register');
        expect(result.current.errorAnnouncement).toBe('');
      });
    });
  });
});
