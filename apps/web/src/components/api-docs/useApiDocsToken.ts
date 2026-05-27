import { useEffect, useState } from 'react';

const TOKEN_SESSION_KEY = 'linklater.api-docs.pat';

/**
 * Reads the cached token from sessionStorage. Returns an empty string when
 * no token is cached or when sessionStorage access fails (Safari private
 * browsing throws on read). Intentionally silent — never emits a live-region
 * announcement on hydration.
 */
function readCachedToken(): string {
  if (typeof window === 'undefined') return '';
  try {
    return window.sessionStorage.getItem(TOKEN_SESSION_KEY) ?? '';
  } catch {
    return '';
  }
}

/**
 * Writes (or clears) the cached token in sessionStorage. Failures are
 * swallowed — the docs page still works without persistence.
 */
function writeCachedToken(value: string): void {
  if (typeof window === 'undefined') return;
  try {
    if (value.length === 0) {
      window.sessionStorage.removeItem(TOKEN_SESSION_KEY);
    } else {
      window.sessionStorage.setItem(TOKEN_SESSION_KEY, value);
    }
  } catch {
    // sessionStorage unavailable — fall through silently.
  }
}

/**
 * React state hook that mirrors a PAT into sessionStorage for the lifetime
 * of the browser tab. The lazy `useState` initializer keeps hydration silent
 * — the token is present on first render with no flash-of-empty.
 *
 * @returns `[token, setToken]` tuple matching `useState` ergonomics.
 */
export function useApiDocsToken(): [string, (value: string) => void] {
  const [token, setToken] = useState<string>(() => readCachedToken());

  useEffect(() => {
    writeCachedToken(token);
  }, [token]);

  return [token, setToken];
}
