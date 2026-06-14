/**
 * One-shot signal for transient post-action messages surfaced on a later
 * route mount (account deleted, email verified, password reset confirmed,
 * etc.). Written by the component that triggers the underlying state
 * change, read once by whichever entry point mounts next, then cleared so
 * a page reload does not re-show the message.
 *
 * Consumers today: `AuthForm` (login/signup/auth arrivals) and `LinksView`
 * (links-page arrivals, e.g. after verify-email redirect to /unread).
 * The sessionStorage key is shared — whichever entry point mounts first
 * consumes the notice and clears the key, so the other won't double-fire.
 *
 * Uses `sessionStorage` (not `localStorage`) because the signal should not
 * survive across tabs or persist beyond the current browser session, and
 * (not `location.state`) because the implicit catch-all redirect from
 * authenticated routes to `/login` would overwrite any router state.
 */

// The key value is intentionally renamed (was `linklater_auth_notice`) so
// any in-flight sessions during a deploy don't fire stale notices keyed
// under the old constant. Older queued notices stranded under the old key
// simply expire when the session ends.
const PENDING_NOTICE_KEY = 'linklater_pending_notice';

export type PendingNotice =
  | 'account-deleted'
  | 'email-verified'
  | 'email-verified-please-sign-in'
  | 'email-change-verified'
  | 'email-change-verified-please-sign-in';

const NOTICE_MESSAGES: Record<PendingNotice, string> = {
  'account-deleted': 'Your account has been deleted.',
  'email-verified': 'Your email has been verified.',
  'email-verified-please-sign-in':
    'Your email has been verified. Please sign in.',
  'email-change-verified': 'Your email has been updated.',
  'email-change-verified-please-sign-in':
    'Your email has been updated. Please sign in.',
};

/** Safely writes a notice. No-op when sessionStorage is unavailable. */
export function setPendingNotice(notice: PendingNotice): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(PENDING_NOTICE_KEY, notice);
  } catch {
    // Best-effort — private browsing / blocked storage.
  }
}

/**
 * Reads and clears the pending notice in one step. Returns the human-readable
 * message, or `null` when no notice is queued or the value is unknown.
 */
export function consumePendingNotice(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(PENDING_NOTICE_KEY);
    if (raw === null) return null;
    window.sessionStorage.removeItem(PENDING_NOTICE_KEY);
    if (raw in NOTICE_MESSAGES) {
      return NOTICE_MESSAGES[raw as PendingNotice];
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Peeks at the pending notice without consuming it. Returns `true` when any
 * value is queued (even an unknown one). Used by effects that need to branch
 * on the presence of a pending notice before the consumer effect clears it —
 * e.g. AuthForm's mode-change effect skips auto-focusing the email input when
 * a notice is queued, so the focus shift doesn't switch a screen reader into
 * forms mode mid-announcement.
 */
export function hasPendingNotice(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem(PENDING_NOTICE_KEY) !== null;
  } catch {
    return false;
  }
}
