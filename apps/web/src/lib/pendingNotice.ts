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
 *
 * Each entry carries a `variant` so the surfacing UI (toast + sr-only
 * mirror) can pick the right ARIA shape and bundle paint. Success AND
 * warning variants ride `role="status"` + `aria-live="polite"`; error
 * variants ride `role="alert"` + `aria-live="assertive"` — both channels
 * MUST match per a11y-lead (divergence is worse than either channel
 * alone). Warning shares the polite channel with success because the
 * underlying user action was intentional; the warn paint + icon glyph
 * carry the "heads-up, side-effect happened" signal redundantly.
 */

// The key value is intentionally renamed (was `linklater_auth_notice`) so
// any in-flight sessions during a deploy don't fire stale notices keyed
// under the old constant. Older queued notices stranded under the old key
// simply expire when the session ends.
const PENDING_NOTICE_KEY = 'linklater_pending_notice';

export type PendingNotice =
  | 'account-deleted'
  | 'account-switched'
  | 'already-logged-in'
  | 'email-verified'
  | 'email-verified-please-sign-in'
  | 'email-change-verified'
  | 'email-change-verified-please-sign-in'
  | 'password-reset-success'
  | 'deletion-link-invalid'
  | 'verification-link-invalid'
  | 'email-change-link-invalid'
  | 'login-link-invalid'
  | 'oauth-failed';

export interface NoticeEntry {
  message: string;
  variant: 'success' | 'warning' | 'error';
}

// Error-variant copies for verification-link-invalid + email-change-link-invalid
// carry an inline recovery hint per WCAG 3.3.3 (Error Suggestion). The actual
// recovery path (Settings → request a fresh verification email) lives behind
// auth, so the toast surfaces the hint at the error moment rather than relying
// on the destination page to spell it out. Deletion-link-invalid and
// login-link-invalid recovery lives on the page the user lands on (/login),
// so those toast copies stay short.
const NOTICE_CATALOG: Record<PendingNotice, NoticeEntry> = {
  'account-deleted': {
    message: 'Your account has been deleted.',
    variant: 'success',
  },
  // Generic copy (not "signed in as X@Y") per a11y-lead: the toast
  // auto-dismiss window is too short for SRs to parse a full email address
  // mid route transition. The /unread destination already surfaces the
  // now-current account identity in the header avatar/menu.
  'account-switched': {
    message: "You're now signed in to a different account",
    variant: 'warning',
  },
  'already-logged-in': {
    message: "You're already signed in",
    variant: 'success',
  },
  'email-verified': {
    message: 'Your email address has been verified',
    variant: 'success',
  },
  'email-verified-please-sign-in': {
    message: 'Your email address has been verified',
    variant: 'success',
  },
  'email-change-verified': {
    message: 'Your email address has been updated',
    variant: 'success',
  },
  'email-change-verified-please-sign-in': {
    message: 'Your email address has been updated',
    variant: 'success',
  },
  'password-reset-success': {
    message: 'Your password has been updated',
    variant: 'success',
  },
  'deletion-link-invalid': {
    message: 'Account deletion link has expired',
    variant: 'error',
  },
  'verification-link-invalid': {
    message: 'Verification link has expired',
    variant: 'error',
  },
  'email-change-link-invalid': {
    message: 'Confirmation link has expired',
    variant: 'error',
  },
  'login-link-invalid': {
    message: 'Login link has expired',
    variant: 'error',
  },
  // Generic copy (not the provider's raw error) per a11y-lead: the toast
  // auto-dismiss window is too short for SRs to parse a free-form provider
  // message, and the recovery path is identical regardless of the underlying
  // OAuth failure (retry sign-in on /login).
  'oauth-failed': {
    message: "We couldn't sign you in. Please try again.",
    variant: 'error',
  },
};

/** Safely writes a notice. No-op when sessionStorage is unavailable. */
export function setPendingNotice(notice: PendingNotice): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(PENDING_NOTICE_KEY, notice);
  } catch (error) {
    // SecurityError in private browsing / blocked storage — best-effort write.
    void error;
  }
}

/**
 * Reads and clears the pending notice in one step. Returns the full
 * `{message, variant}` entry, or `null` when no notice is queued or the
 * value is unknown.
 */
export function consumePendingNotice(): NoticeEntry | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(PENDING_NOTICE_KEY);
    if (raw === null) return null;
    window.sessionStorage.removeItem(PENDING_NOTICE_KEY);
    if (raw in NOTICE_CATALOG) {
      return NOTICE_CATALOG[raw as PendingNotice];
    }
    return null;
  } catch (error) {
    // SecurityError in private browsing / blocked storage — best-effort read.
    void error;
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
