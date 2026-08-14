/**
 * What a slow boot actually landed on, and the sentence that says so.
 *
 * Separate from `useBootStatus.ts` because the copy is a table and the
 * hook is a clock; nothing here needs a render to be asked.
 *
 * The signed-out sentence reports auth state and names no screen, which
 * is what makes it safe. `App` renders `commonRoutes()` on both branches,
 * so a boot that finishes with no user lands on any of the twelve paths
 * in `authAgnosticPaths.ts` or on `/` and its landing page, and only
 * three of those hold a form. Copy naming one would be false on the rest.
 * It is a state sentence rather than an instruction for a second reason:
 * a `role="status"` region reports and never commands, and the message
 * catalog's own rule is "Log in" over "sign in" (WCAG 3.2.4), which an
 * instruction here would have to either break or duplicate.
 *
 * Two landings say nothing, and withholding is the whole of what they
 * say; emptying the region is `useBootStatus`'s job and happens either
 * way. A consumed notice on the signed-out landing has already said more
 * than this would: `session-unavailable` reports that the boot finished,
 * that it landed on a login form, and why. And a boot that ended on the
 * error fallback has a view that takes focus into its own landmark and a
 * heading the reader gets instead, so a second sentence in a hidden
 * region would describe a screen the user is already being read.
 *
 * The suppression does not reach the signed-in landing. That sentence
 * predates the distinction, and when it speaks is part of what it is.
 */

export type BootLanding = 'app' | 'signed-out' | 'error';

const READY_MESSAGE = 'Linklater is ready.';
const SIGNED_OUT_MESSAGE = `${READY_MESSAGE} You're not signed in.`;

export function resolveBootLanding(
  crashed: boolean,
  signedIn: boolean,
): BootLanding {
  if (crashed) return 'error';
  if (signedIn) return 'app';
  return 'signed-out';
}

/** The terminal sentence, or an empty string to withhold it. */
export function terminalBootMessage(
  landing: BootLanding,
  noticeConsumed: boolean,
): string {
  if (landing === 'app') return READY_MESSAGE;
  if (landing === 'error') return '';
  if (noticeConsumed) return '';
  return SIGNED_OUT_MESSAGE;
}
