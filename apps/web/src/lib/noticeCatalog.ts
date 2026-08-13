/**
 * The copy and ARIA shape of every cross-route notice, and the vocabulary
 * naming them. It sits apart from the store that carries them
 * (`pendingNotice.ts`) because it is the half that gets edited: a new
 * flow adds a row here, while the read/write/clear mechanics stay put.
 * Nothing here reaches back into the store, so it can be imported from
 * anywhere without ordering worries.
 *
 * Error copies inline the recovery hint (WCAG 3.3.3) when it is behind
 * auth. Success AND warning variants ride `role="status"` +
 * `aria-live="polite"`; error variants ride `role="alert"` +
 * `aria-live="assertive"` - both channels MUST match per a11y-lead
 * (divergence is worse than either channel alone). Warning shares the
 * polite channel with success because the underlying user action was
 * intentional; the warn paint + icon glyph carry the "heads-up,
 * side-effect happened" signal redundantly.
 */

export type PendingNotice =
  | 'account-deleted'
  | 'account-switched'
  | 'already-logged-in'
  | 'email-verified'
  | 'email-verified-please-sign-in'
  | 'email-change-verified'
  | 'email-change-verified-please-sign-in'
  | 'password-reset-success'
  | 'session-unavailable'
  | 'deletion-link-invalid'
  | 'verification-link-invalid'
  | 'email-change-link-invalid'
  | 'login-link-invalid'
  | 'oauth-failed';

export interface NoticeEntry {
  message: string;
  variant: 'success' | 'warning' | 'error';
  /**
   * Whether the message is the arriving page's own account of itself
   * rather than a report on something the user just did. Those cannot
   * ride a dismiss timer (WCAG 2.2.1 Timing Adjustable): the page will
   * still be there, unexplained, after the timer runs out. The surfacing
   * UI paints them in the flow instead of in a toast.
   */
  standing?: boolean;
}

export const NOTICE_CATALOG: Record<PendingNotice, NoticeEntry> = {
  'account-deleted': {
    message: 'Your account has been deleted.',
    variant: 'success',
  },
  // generic copy: toast auto-dismiss is too short for SRs to read an email
  'account-switched': {
    message: "You're now signed in to a different account",
    variant: 'warning',
  },
  // past tense, so it cannot be heard as the login screen's standing
  // offer (`AlreadySignedInNotice`) arriving a second time
  'already-logged-in': {
    message: 'You were already signed in, so nothing changed',
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
  // names what the attempt did, not what the server did: a bounce off the
  // auth gate reads the same whether the session ended or the network
  // blipped. No instruction to log in, for the reason the two
  // please-sign-in entries above dropped theirs: the form is right there
  'session-unavailable': {
    message: "We couldn't get you back into that session",
    variant: 'warning',
    standing: true,
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
  // generic copy: toast is too short for SRs to parse a raw provider error
  'oauth-failed': {
    message: "We couldn't sign you in. Please try again.",
    variant: 'error',
  },
};
