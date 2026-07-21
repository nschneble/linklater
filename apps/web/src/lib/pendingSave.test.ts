import {
  clearPendingSave,
  setPendingSave,
  takePendingSave,
} from './pendingSave';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const PENDING_SAVE_KEY = 'linklater:pendingSave';

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('setPendingSave / takePendingSave round trip', () => {
  it('stores a url and reads it back', () => {
    setPendingSave('https://example.com/article');

    expect(takePendingSave()).toBe('https://example.com/article');
  });

  it('clears the key on take so a second take returns null', () => {
    setPendingSave('https://example.com/article');

    expect(takePendingSave()).toBe('https://example.com/article');
    expect(localStorage.getItem(PENDING_SAVE_KEY)).toBeNull();
    expect(takePendingSave()).toBeNull();
  });
});

describe('takePendingSave staleness', () => {
  it('ignores and clears an entry older than the 24h TTL', () => {
    const twentyFiveHoursAgo = Date.now() - 25 * 60 * 60 * 1000;
    localStorage.setItem(
      PENDING_SAVE_KEY,
      JSON.stringify({ url: 'https://example.com', at: twentyFiveHoursAgo }),
    );

    expect(takePendingSave()).toBeNull();
    expect(localStorage.getItem(PENDING_SAVE_KEY)).toBeNull();
  });

  it('returns an entry still within the 24h window', () => {
    const twentyThreeHoursAgo = Date.now() - 23 * 60 * 60 * 1000;
    localStorage.setItem(
      PENDING_SAVE_KEY,
      JSON.stringify({ url: 'https://example.com', at: twentyThreeHoursAgo }),
    );

    expect(takePendingSave()).toBe('https://example.com');
  });
});

describe('takePendingSave with bad data', () => {
  it('clears and returns null for malformed JSON', () => {
    localStorage.setItem(PENDING_SAVE_KEY, 'not json{');

    expect(takePendingSave()).toBeNull();
    expect(localStorage.getItem(PENDING_SAVE_KEY)).toBeNull();
  });

  it('returns null when the stored shape is wrong', () => {
    localStorage.setItem(PENDING_SAVE_KEY, JSON.stringify({ nope: true }));

    expect(takePendingSave()).toBeNull();
  });

  it('returns null when there is no entry', () => {
    expect(takePendingSave()).toBeNull();
  });
});

describe('takePendingSave when localStorage throws', () => {
  it('returns null when getItem throws (private mode / denied)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });

    expect(takePendingSave()).toBeNull();
  });
});

describe('setPendingSave when localStorage throws', () => {
  it('swallows a throwing setItem (quota / private mode)', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });

    expect(() => setPendingSave('https://example.com')).not.toThrow();
  });
});

describe('clearPendingSave when localStorage throws', () => {
  it('swallows a throwing removeItem', () => {
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('denied');
    });

    expect(() => clearPendingSave()).not.toThrow();
  });
});
