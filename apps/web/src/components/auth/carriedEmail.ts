/**
 * The login form's typed email, carried across the one navigation that
 * would otherwise destroy it.
 *
 * `AlreadySignedInNotice` offers a full document load into a session it
 * cannot verify is still good. When that session is gone the auth gate
 * lands the user back on the login form, and without this the email is
 * demanded a second time (WCAG 3.3.7 Redundant Entry). The password is
 * deliberately not carried: it was never submitted, and a value nobody
 * asked to store should not outlive the document that holds it.
 *
 * Two halves, because the form knows the value and the notice knows the
 * navigation. The form keeps this module told in memory; the notice
 * persists what it was told at the instant its link is followed, so the
 * only email ever written to storage belongs to a user who just asked to
 * leave the page.
 *
 * The stored value doubles as the record that the offer was taken, which
 * is why an empty box is written as `''` rather than skipped: the arrival
 * has to announce whether or not anything was typed.
 *
 * A link that WORKS leaves the value unread, since a tab that lands in
 * the app mounts no login form. It is then picked up by whatever bounce
 * comes next in that tab, and both things it does there are still true:
 * the user really was returned to the form, and the email really is
 * theirs.
 */

// distinct key name so a deploy-straddling session cannot misread an older shape
const CARRIED_EMAIL_KEY = 'linklater_carried_email';

let typedEmail = '';

export function noteTypedEmail(email: string): void {
  typedEmail = email;
}

/** Hands the noted email to the document the offer's link opens. */
export function carryTypedEmail(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(CARRIED_EMAIL_KEY, typedEmail);
  } catch {
    // best-effort: a refused write costs the prefill, never the sign-in
  }
}

/** Reads and clears in one step, so a reload cannot re-announce. */
export function takeCarriedEmail(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const carried = window.sessionStorage.getItem(CARRIED_EMAIL_KEY);
    if (carried !== null) window.sessionStorage.removeItem(CARRIED_EMAIL_KEY);
    return carried;
  } catch {
    return null;
  }
}
