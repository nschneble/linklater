import { afterEach, describe, expect, it, vi } from 'vitest';
import { consumeAuthNotice, hasAuthNotice, setAuthNotice } from './authNotice';

afterEach(() => {
  vi.restoreAllMocks();
  window.sessionStorage.clear();
});

describe('setAuthNotice / consumeAuthNotice', () => {
  it('round-trips a known notice into a human-readable message', () => {
    setAuthNotice('account-deleted');
    expect(consumeAuthNotice()).toBe('Your account has been deleted.');
  });

  it('returns null when no notice has been set', () => {
    expect(consumeAuthNotice()).toBeNull();
  });

  it('clears the notice after a single read (one-shot)', () => {
    setAuthNotice('account-deleted');
    consumeAuthNotice();
    expect(consumeAuthNotice()).toBeNull();
  });

  it('does not throw when sessionStorage rejects writes', () => {
    const originalSetItem = window.sessionStorage.setItem.bind(
      window.sessionStorage,
    );
    window.sessionStorage.setItem = () => {
      throw new DOMException('QuotaExceededError');
    };
    try {
      expect(() => setAuthNotice('account-deleted')).not.toThrow();
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
      expect(consumeAuthNotice()).toBeNull();
    } finally {
      window.sessionStorage.getItem = originalGetItem;
    }
  });

  it('returns null when stored value is unknown (forward-compat guard)', () => {
    window.sessionStorage.setItem('linklater_auth_notice', 'not-a-real-notice');
    expect(consumeAuthNotice()).toBeNull();
  });
});

describe('hasAuthNotice', () => {
  it('returns false when no notice is queued', () => {
    expect(hasAuthNotice()).toBe(false);
  });

  it('returns true after setAuthNotice and before consumeAuthNotice', () => {
    setAuthNotice('account-deleted');
    expect(hasAuthNotice()).toBe(true);
  });

  it('does not consume the notice — consumeAuthNotice still returns the message after peeking', () => {
    setAuthNotice('account-deleted');
    expect(hasAuthNotice()).toBe(true);
    expect(consumeAuthNotice()).toBe('Your account has been deleted.');
  });

  it('returns false after consumeAuthNotice clears the notice', () => {
    setAuthNotice('account-deleted');
    consumeAuthNotice();
    expect(hasAuthNotice()).toBe(false);
  });

  it('returns false and does not throw when sessionStorage rejects reads', () => {
    const originalGetItem = window.sessionStorage.getItem.bind(
      window.sessionStorage,
    );
    window.sessionStorage.getItem = () => {
      throw new DOMException('SecurityError');
    };
    try {
      expect(hasAuthNotice()).toBe(false);
    } finally {
      window.sessionStorage.getItem = originalGetItem;
    }
  });
});
