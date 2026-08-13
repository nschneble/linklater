/**
 * One-shot signal for transient post-action messages surfaced on a later
 * route mount (account deleted, email verified, password reset confirmed,
 * etc.). Written by the component that triggers the underlying state
 * change, read once by whichever entry point mounts next, then cleared so
 * a page reload does not re-show the message.
 *
 * Consumers today: `useAuthFormArrival` (login/signup/auth arrivals) and
 * `LinksView` (links-page arrivals, e.g. after verify-email redirect to
 * /unread). The sessionStorage key is shared, so whichever entry point
 * mounts first consumes the notice and clears the key and the other will
 * not double-fire.
 *
 * One entry, `session-unavailable`, is queued by the auth gate itself
 * (`components/auth/offerBounce.ts`) rather than by a flow the user
 * asked for, one commit before the login form it explains mounts. It
 * goes through the catalog like every other message so the copy and the
 * ARIA shape have one home, and so the form's focus bail sees it pending.
 *
 * Uses `sessionStorage` (not `localStorage`) because the signal should not
 * survive across tabs or persist beyond the current browser session, and
 * (not `location.state`) because the implicit catch-all redirect from
 * authenticated routes to `/login` would overwrite any router state.
 *
 * The copy and the ARIA shape each entry carries live in
 * `noticeCatalog.ts`. Both its types are re-exported here so a caller
 * that only knows about the store has one import to reach for.
 *
 * A stored value is matched against the catalog's own keys rather than
 * against everything the lookup would answer to. The inherited ones
 * (`toString`, `constructor`, `valueOf`, `__proto__`) resolve to a
 * function or to the prototype object, and a function reaching the
 * caller's `setNotice` is read by React as a state updater and invoked.
 */

import { NOTICE_CATALOG } from './noticeCatalog';
import type { NoticeEntry, PendingNotice } from './noticeCatalog';

export type { NoticeEntry, PendingNotice };

// distinct key name so deploy-straddling sessions don't fire stale notices
const PENDING_NOTICE_KEY = 'linklater_pending_notice';

/**
 * The catalog's own census. A test that enumerates the notice keys has to
 * hand-write them, because the union erases at runtime and `tsconfig.app`
 * excludes test files from the typecheck that would have caught the list
 * going stale. This is what such a list can be compared against.
 */
export function pendingNoticeKeys(): PendingNotice[] {
  return Object.keys(NOTICE_CATALOG) as PendingNotice[];
}

/** Safely writes a notice. No-op when sessionStorage is unavailable. */
export function setPendingNotice(notice: PendingNotice): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(PENDING_NOTICE_KEY, notice);
  } catch (error) {
    // SecurityError in private browsing / blocked storage - best-effort write
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
    // own keys only, per the inherited-name note in the overview
    if (Object.hasOwn(NOTICE_CATALOG, raw)) {
      return NOTICE_CATALOG[raw as PendingNotice];
    }
    return null;
  } catch (error) {
    // SecurityError in private browsing / blocked storage - best-effort read
    void error;
    return null;
  }
}

/**
 * Peeks at the pending notice without consuming it. Returns `true` when any
 * value is queued, even an unknown one, since the question is whether the
 * slot is taken rather than what is in it.
 *
 * Two callers, asking opposite questions of the same answer. The arrival
 * effect in `useAuthFormArrival.ts` skips auto-focusing the email input
 * while a notice is queued, so the focus shift does not switch a screen
 * reader into forms mode mid-announcement, which is why the peek has to
 * happen before the consumer effect empties the slot. The auth gate in
 * `components/auth/offerBounce.ts` asks so it can stand down: the slot is
 * one-shot, and whatever is already there was queued by a flow the user
 * asked for.
 */
export function hasPendingNotice(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem(PENDING_NOTICE_KEY) !== null;
  } catch {
    return false;
  }
}
