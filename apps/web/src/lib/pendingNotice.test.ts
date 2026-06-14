import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  consumePendingNotice,
  hasPendingNotice,
  setPendingNotice,
} from './pendingNotice';

afterEach(() => {
  vi.restoreAllMocks();
  window.sessionStorage.clear();
});

describe('setPendingNotice / consumePendingNotice', () => {
  it('round-trips a known notice into a human-readable message', () => {
    setPendingNotice('account-deleted');
    expect(consumePendingNotice()).toBe('Your account has been deleted.');
  });

  it('round-trips email-verified', () => {
    setPendingNotice('email-verified');
    expect(hasPendingNotice()).toBe(true);
    expect(consumePendingNotice()).toBe('Your email has been verified.');
    expect(hasPendingNotice()).toBe(false);
  });

  it('round-trips email-verified-please-sign-in', () => {
    setPendingNotice('email-verified-please-sign-in');
    expect(hasPendingNotice()).toBe(true);
    expect(consumePendingNotice()).toBe(
      'Your email has been verified. Please sign in.',
    );
    expect(hasPendingNotice()).toBe(false);
  });

  it('round-trips email-change-verified', () => {
    setPendingNotice('email-change-verified');
    expect(hasPendingNotice()).toBe(true);
    expect(consumePendingNotice()).toBe('Your email has been updated.');
    expect(hasPendingNotice()).toBe(false);
  });

  it('round-trips email-change-verified-please-sign-in', () => {
    setPendingNotice('email-change-verified-please-sign-in');
    expect(hasPendingNotice()).toBe(true);
    expect(consumePendingNotice()).toBe(
      'Your email has been updated. Please sign in.',
    );
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

  it('does not consume the notice — consumePendingNotice still returns the message after peeking', () => {
    setPendingNotice('account-deleted');
    expect(hasPendingNotice()).toBe(true);
    expect(consumePendingNotice()).toBe('Your account has been deleted.');
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
