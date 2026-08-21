import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  forgetRefusedWrite,
  hasRecentLocalChange,
  MODE_STORAGE_KEY,
  persistWithTimestamp,
  readLocalStorage,
  readPersistedValue,
  RECENT_LOCAL_CHANGE_MS,
  THEME_STORAGE_KEY,
  THEME_UPDATED_AT_KEY,
  writeLocalStorage,
} from './storage';
import { withRefusedStorage } from '../../test/refusedStorage';

let refusalKeyCounter = 0;

// the refusal map has no reset, so a shared key couples the cases
function freshRefusalKey(): string {
  refusalKeyCounter += 1;
  return `linklater_test_refusal_${refusalKeyCounter}`;
}

function recordRefusedWrite(key: string, value: string): void {
  withRefusedStorage(
    'setItem',
    () => writeLocalStorage(key, value),
    'localStorage',
  );
}

describe('readLocalStorage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it('returns the stored value when localStorage has the key', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'scanner-darkly');
    expect(readLocalStorage(THEME_STORAGE_KEY)).toBe('scanner-darkly');
  });

  it('returns null when the key has not been set', () => {
    expect(readLocalStorage(MODE_STORAGE_KEY)).toBeNull();
  });

  it('returns null when localStorage throws (private browsing / blocked storage)', () => {
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new DOMException('SecurityError: localStorage is blocked');
    });
    expect(readLocalStorage(THEME_STORAGE_KEY)).toBeNull();
  });

  it('returns null when window is undefined (SSR guard)', () => {
    const originalWindow = globalThis.window;
    // @ts-expect-error -- deliberately removing the global to exercise the SSR branch
    delete globalThis.window;
    try {
      expect(readLocalStorage(THEME_STORAGE_KEY)).toBeNull();
    } finally {
      globalThis.window = originalWindow;
    }
  });
});

describe('readPersistedValue', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('returns the stored value when this tab never failed to write the key', () => {
    const key = freshRefusalKey();
    window.localStorage.setItem(key, 'boyhood');

    expect(readPersistedValue(key, 'school-of-rock')).toBe('boyhood');
  });

  it('returns the cached value when nothing is stored under the key', () => {
    expect(readPersistedValue(freshRefusalKey(), 'school-of-rock')).toBe(
      'school-of-rock',
    );
  });

  it('returns the cached value when the store has not moved since it refused', () => {
    const key = freshRefusalKey();
    window.localStorage.setItem(key, 'boyhood');
    recordRefusedWrite(key, 'school-of-rock');

    expect(readPersistedValue(key, 'school-of-rock')).toBe('school-of-rock');
  });

  it('returns the stored value once a later write to the key lands', () => {
    const key = freshRefusalKey();
    window.localStorage.setItem(key, 'boyhood');
    recordRefusedWrite(key, 'school-of-rock');

    writeLocalStorage(key, 'boyhood');

    expect(readPersistedValue(key, 'school-of-rock')).toBe('boyhood');
  });

  it('returns the stored value when another tab moved it after the refusal', () => {
    const key = freshRefusalKey();
    window.localStorage.setItem(key, 'boyhood');
    recordRefusedWrite(key, 'school-of-rock');

    window.localStorage.setItem(key, 'scanner-darkly');

    expect(readPersistedValue(key, 'school-of-rock')).toBe('scanner-darkly');
  });
});

describe('forgetRefusedWrite', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it("drops the named key's record and leaves every other one standing", () => {
    const forgotten = freshRefusalKey();
    const kept = freshRefusalKey();
    window.localStorage.setItem(forgotten, 'boyhood');
    window.localStorage.setItem(kept, 'boyhood');
    recordRefusedWrite(forgotten, 'school-of-rock');
    recordRefusedWrite(kept, 'school-of-rock');

    forgetRefusedWrite(forgotten);

    expect(readPersistedValue(forgotten, 'school-of-rock')).toBe('boyhood');
    expect(readPersistedValue(kept, 'school-of-rock')).toBe('school-of-rock');
  });
});

describe('hasRecentLocalChange', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('returns true when the timestamp is within the guard window', () => {
    window.localStorage.setItem(THEME_UPDATED_AT_KEY, String(Date.now()));
    expect(hasRecentLocalChange(THEME_UPDATED_AT_KEY)).toBe(true);
  });

  it('returns false once the timestamp is older than the guard window', () => {
    window.localStorage.setItem(
      THEME_UPDATED_AT_KEY,
      String(Date.now() - RECENT_LOCAL_CHANGE_MS - 1),
    );
    expect(hasRecentLocalChange(THEME_UPDATED_AT_KEY)).toBe(false);
  });

  it('returns false when no timestamp has been stored', () => {
    expect(hasRecentLocalChange(THEME_UPDATED_AT_KEY)).toBe(false);
  });
});

describe('persistWithTimestamp', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('writes the value under valueKey and a timestamp under updatedAtKey', () => {
    const before = Date.now();
    persistWithTimestamp({
      valueKey: THEME_STORAGE_KEY,
      value: 'boyhood',
      updatedAtKey: THEME_UPDATED_AT_KEY,
    });

    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('boyhood');

    const stamped = Number(window.localStorage.getItem(THEME_UPDATED_AT_KEY));
    expect(stamped).toBeGreaterThanOrEqual(before);
    expect(stamped).toBeLessThanOrEqual(Date.now());
  });

  it('stamps a fresh time inside the guard window', () => {
    persistWithTimestamp({
      valueKey: THEME_STORAGE_KEY,
      value: 'boyhood',
      updatedAtKey: THEME_UPDATED_AT_KEY,
    });
    expect(hasRecentLocalChange(THEME_UPDATED_AT_KEY)).toBe(true);
  });
});
