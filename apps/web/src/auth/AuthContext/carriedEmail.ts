/**
 * The login form's typed email, carried across the one navigation that
 * would otherwise destroy it.
 *
 * `AlreadySignedInNotice` offers a full document load into a session it
 * cannot verify is still good. When that session is gone the auth gate
 * lands the user back on the login form, and without this the address is
 * demanded again because an offer they accepted did not land. The
 * password is deliberately not carried: it was never submitted, and a
 * value nobody asked to store should not outlive the document that holds
 * it.
 *
 * Two halves, because the form knows the value and the notice knows the
 * navigation. The form keeps this module told in memory; the notice
 * persists what it was told at the instant its link is followed, so the
 * only email ever written to storage belongs to a user who just asked to
 * leave the page.
 *
 * It sits here rather than beside either half for the reason
 * `renderedIdentity.ts` does: a per-tab store both a component and the
 * auth state read is owned by neither, and the dependency between the
 * two directories already runs this way.
 *
 * `sessionStorage` rather than `localStorage`, because an address in
 * `localStorage` would reach every tab of the browser and outlive the
 * one visit it was typed during, and neither is true of the value: it
 * belongs to the document the link opens and to nothing else.
 *
 * What is stored is the email and only the email. A click is not a
 * bounce, and this value is not evidence of one: the common case is a
 * link that works, which leaves the value unread in a tab that mounted no
 * login form. Whether the navigation FAILED is the auth gate's
 * observation, and `components/auth/offerBounce.ts` is where the gate
 * records it. A successful arrival drops the value (`useAuthState`
 * adopts a user), so nothing armed here outlives the offer it belongs to.
 */

// distinct key so a deploy-straddling session cannot misread an old shape
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

/**
 * Whether this document load began by following the offer. An empty box
 * is carried as `''` rather than skipped, so presence and not truthiness
 * is the question.
 */
export function hasCarriedEmail(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem(CARRIED_EMAIL_KEY) !== null;
  } catch {
    return false;
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

/** Forgets a carry the arrival proved was never needed. */
export function dropCarriedEmail(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(CARRIED_EMAIL_KEY);
  } catch {
    // best-effort: an unreachable store holds nothing to forget
  }
}
