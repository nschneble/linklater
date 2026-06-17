import { useAuth } from '../../auth/AuthContext';
import { getApiDocsToken } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import { useEffect, useState } from 'react';

/** The state returned by {@link useApiDocsToken}. */
export interface ApiDocsTokenState {
  /** The raw `ltk_` token, or an empty string when logged out or not yet loaded. */
  token: string;
  /** `true` while auth state or the token fetch is still settling. */
  loading: boolean;
  /** A human-readable fetch error, or `null` when there is none. */
  error: string | null;
}

/**
 * Fetches the authenticated user's hidden API-docs token so the "try it out"
 * explorer can sign live requests.
 *
 * The token is server-sourced and re-fetched fresh on every mount — it is a
 * secret, so it is intentionally NOT cached in `sessionStorage`. It is only
 * requested when a user is logged in (`useAuth().user` is non-null); the
 * endpoint is JWT-guarded, so calling it logged-out would 401. The fetch waits
 * for auth `loading` to settle before deciding, and is cancelled on unmount.
 *
 * Intentionally silent — never emits a live-region announcement on hydration.
 *
 * @returns The token state for the API explorer to consume.
 */
export function useApiDocsToken(): ApiDocsTokenState {
  const { loading: authLoading, user } = useAuth();
  const [token, setToken] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Wait for auth to settle before deciding whether to fetch.
    if (authLoading) {
      setLoading(true);
      return;
    }

    // Logged out: the endpoint is JWT-guarded, so do not call it.
    if (!user) {
      setToken('');
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    getApiDocsToken()
      .then((apiDocsToken) => {
        if (!cancelled) {
          setToken(apiDocsToken.rawToken);
          setLoading(false);
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(getErrorMessage(caught, 'Failed to load API docs token'));
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [authLoading, user]);

  return { token, loading, error };
}
