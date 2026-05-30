/**
 * One-shot signal for transient post-auth messages (account deleted,
 * password reset confirmed, etc.). Written by the component that triggers
 * the auth state change, read once by `AuthForm` on mount, then cleared
 * so a page reload does not re-show the message.
 *
 * Uses `sessionStorage` (not `localStorage`) because the signal should not
 * survive across tabs or persist beyond the current browser session, and
 * (not `location.state`) because the implicit catch-all redirect from
 * authenticated routes to `/login` would overwrite any router state.
 */
const AUTH_NOTICE_KEY = 'linklater_auth_notice';

export type AuthNotice = 'account-deleted';

const NOTICE_MESSAGES: Record<AuthNotice, string> = {
  'account-deleted': 'Your account has been deleted.',
};

/** Safely writes a notice. No-op when sessionStorage is unavailable. */
export function setAuthNotice(notice: AuthNotice): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(AUTH_NOTICE_KEY, notice);
  } catch {
    // Best-effort — private browsing / blocked storage.
  }
}

/**
 * Reads and clears the pending notice in one step. Returns the human-readable
 * message, or `null` when no notice is queued or the value is unknown.
 */
export function consumeAuthNotice(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(AUTH_NOTICE_KEY);
    if (raw === null) return null;
    window.sessionStorage.removeItem(AUTH_NOTICE_KEY);
    if (raw in NOTICE_MESSAGES) {
      return NOTICE_MESSAGES[raw as AuthNotice];
    }
    return null;
  } catch {
    return null;
  }
}
