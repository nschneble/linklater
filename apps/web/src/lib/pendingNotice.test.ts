import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  consumePendingNotice,
  hasPendingNotice,
  setPendingNotice,
  type PendingNotice,
} from './pendingNotice';

afterEach(() => {
  vi.restoreAllMocks();
  window.sessionStorage.clear();
});

describe('setPendingNotice / consumePendingNotice', () => {
  it('round-trips a known notice into a message + variant entry', () => {
    setPendingNotice('account-deleted');
    expect(consumePendingNotice()).toEqual({
      message: 'Your account has been deleted.',
      variant: 'success',
    });
  });

  it('round-trips email-verified', () => {
    setPendingNotice('email-verified');
    expect(hasPendingNotice()).toBe(true);
    expect(consumePendingNotice()).toEqual({
      message: 'Your email address has been verified',
      variant: 'success',
    });
    expect(hasPendingNotice()).toBe(false);
  });

  it('round-trips email-verified-please-sign-in', () => {
    setPendingNotice('email-verified-please-sign-in');
    expect(hasPendingNotice()).toBe(true);
    expect(consumePendingNotice()).toEqual({
      message: 'Your email address has been verified',
      variant: 'success',
    });
    expect(hasPendingNotice()).toBe(false);
  });

  it('round-trips email-change-verified', () => {
    setPendingNotice('email-change-verified');
    expect(hasPendingNotice()).toBe(true);
    expect(consumePendingNotice()).toEqual({
      message: 'Your email address has been updated',
      variant: 'success',
    });
    expect(hasPendingNotice()).toBe(false);
  });

  it('round-trips email-change-verified-please-sign-in', () => {
    setPendingNotice('email-change-verified-please-sign-in');
    expect(hasPendingNotice()).toBe(true);
    expect(consumePendingNotice()).toEqual({
      message: 'Your email address has been updated',
      variant: 'success',
    });
    expect(hasPendingNotice()).toBe(false);
  });

  it('round-trips deletion-link-invalid as an error-variant entry', () => {
    setPendingNotice('deletion-link-invalid');
    expect(hasPendingNotice()).toBe(true);
    expect(consumePendingNotice()).toEqual({
      message: 'Account deletion link has expired',
      variant: 'error',
    });
    expect(hasPendingNotice()).toBe(false);
  });

  it('round-trips verification-link-invalid as an error-variant entry with inline recovery hint', () => {
    setPendingNotice('verification-link-invalid');
    expect(hasPendingNotice()).toBe(true);
    expect(consumePendingNotice()).toEqual({
      message: 'Verification link has expired',
      variant: 'error',
    });
    expect(hasPendingNotice()).toBe(false);
  });

  it('round-trips email-change-link-invalid as an error-variant entry with inline recovery hint', () => {
    setPendingNotice('email-change-link-invalid');
    expect(hasPendingNotice()).toBe(true);
    expect(consumePendingNotice()).toEqual({
      message: 'Confirmation link has expired',
      variant: 'error',
    });
    expect(hasPendingNotice()).toBe(false);
  });

  it('round-trips login-link-invalid as an error-variant entry (short copy – /login is the recovery destination)', () => {
    setPendingNotice('login-link-invalid');
    expect(hasPendingNotice()).toBe(true);
    expect(consumePendingNotice()).toEqual({
      message: 'Login link has expired',
      variant: 'error',
    });
    expect(hasPendingNotice()).toBe(false);
  });

  it('round-trips oauth-failed as an error-variant entry (generic copy – provider message dropped)', () => {
    setPendingNotice('oauth-failed');
    expect(hasPendingNotice()).toBe(true);
    expect(consumePendingNotice()).toEqual({
      message: "We couldn't sign you in. Please try again.",
      variant: 'error',
    });
    expect(hasPendingNotice()).toBe(false);
  });

  // magic-link cross/same-account + password-reset entries, queued after verify/reset

  it('round-trips account-switched as a warning-variant entry (magic link consumed for a different account)', () => {
    setPendingNotice('account-switched');
    expect(hasPendingNotice()).toBe(true);
    expect(consumePendingNotice()).toEqual({
      message: "You're now signed in to a different account",
      variant: 'warning',
    });
    expect(hasPendingNotice()).toBe(false);
  });

  it('round-trips already-logged-in as a success-variant entry (magic link is for the current user)', () => {
    setPendingNotice('already-logged-in');
    expect(hasPendingNotice()).toBe(true);
    expect(consumePendingNotice()).toEqual({
      message: 'You were already signed in, so nothing changed',
      variant: 'success',
    });
    expect(hasPendingNotice()).toBe(false);
  });

  it('round-trips password-reset-success as a success-variant entry (surfaced on /unread after auto-login)', () => {
    setPendingNotice('password-reset-success');
    expect(hasPendingNotice()).toBe(true);
    expect(consumePendingNotice()).toEqual({
      message: 'Your password has been updated',
      variant: 'success',
    });
    expect(hasPendingNotice()).toBe(false);
  });

  it('returns null when no notice has been set', () => {
    expect(consumePendingNotice()).toBeNull();
  });

  it('clears the notice after a single read (one-shot)', () => {
    setPendingNotice('account-deleted');
    consumePendingNotice();
    expect(consumePendingNotice()).toBeNull();
  });

  it('does not throw when sessionStorage rejects writes', () => {
    const originalSetItem = window.sessionStorage.setItem.bind(
      window.sessionStorage,
    );
    window.sessionStorage.setItem = () => {
      throw new DOMException('QuotaExceededError');
    };
    try {
      expect(() => setPendingNotice('account-deleted')).not.toThrow();
    } finally {
      window.sessionStorage.setItem = originalSetItem;
    }
  });

  it('returns null and does not throw when sessionStorage rejects reads', () => {
    const originalGetItem = window.sessionStorage.getItem.bind(
      window.sessionStorage,
    );
    window.sessionStorage.getItem = () => {
      throw new DOMException('SecurityError');
    };
    try {
      expect(consumePendingNotice()).toBeNull();
    } finally {
      window.sessionStorage.getItem = originalGetItem;
    }
  });

  it('returns null when stored value is unknown (forward-compat guard)', () => {
    window.sessionStorage.setItem(
      'linklater_pending_notice',
      'not-a-real-notice',
    );
    expect(consumePendingNotice()).toBeNull();
  });
});

describe('hasPendingNotice', () => {
  it('returns false when no notice is queued', () => {
    expect(hasPendingNotice()).toBe(false);
  });

  it('returns true after setPendingNotice and before consumePendingNotice', () => {
    setPendingNotice('account-deleted');
    expect(hasPendingNotice()).toBe(true);
  });

  it('does not consume the notice – consumePendingNotice still returns the entry after peeking', () => {
    setPendingNotice('account-deleted');
    expect(hasPendingNotice()).toBe(true);
    expect(consumePendingNotice()).toEqual({
      message: 'Your account has been deleted.',
      variant: 'success',
    });
  });

  it('returns false after consumePendingNotice clears the notice', () => {
    setPendingNotice('account-deleted');
    consumePendingNotice();
    expect(hasPendingNotice()).toBe(false);
  });

  it('returns false and does not throw when sessionStorage rejects reads', () => {
    const originalGetItem = window.sessionStorage.getItem.bind(
      window.sessionStorage,
    );
    window.sessionStorage.getItem = () => {
      throw new DOMException('SecurityError');
    };
    try {
      expect(hasPendingNotice()).toBe(false);
    } finally {
      window.sessionStorage.getItem = originalGetItem;
    }
  });
});

// drift guard: every PendingNotice key must round-trip the catalog or ship silently dropped
describe('catalog drift guard', () => {
  // TypeScript erases the union at runtime, so enumerate; a new member trips the compiler
  const ALL_KEYS: readonly PendingNotice[] = [
    'account-deleted',
    'account-switched',
    'already-logged-in',
    'email-verified',
    'email-verified-please-sign-in',
    'email-change-verified',
    'email-change-verified-please-sign-in',
    'password-reset-success',
    'deletion-link-invalid',
    'verification-link-invalid',
    'email-change-link-invalid',
    'login-link-invalid',
    'oauth-failed',
  ];

  for (const key of ALL_KEYS) {
    it(`'${key}' has both a non-empty message and a valid variant`, () => {
      setPendingNotice(key);
      const entry = consumePendingNotice();
      expect(entry).not.toBeNull();
      expect(typeof entry?.message).toBe('string');
      expect((entry?.message ?? '').length).toBeGreaterThan(0);
      expect(['success', 'warning', 'error']).toContain(entry?.variant);
    });
  }
});
