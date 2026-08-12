/**
 * The user id this tab was last rendering, kept where the tab can find it
 * again after a reload.
 *
 * `sessionStorage`, not `localStorage`, and the distinction is the whole
 * point: the question being asked is "who was THIS tab showing", and
 * `localStorage` is shared, so it would always answer with the newest
 * identity anywhere in the browser. That is the very value the comparison
 * exists to detect a change against, so storing it there would make every
 * comparison agree with itself and never fire.
 *
 * A tab that has never rendered anyone answers `null`, and so does one
 * that signed out, because a signed-out tab has no prior identity to be
 * switched away from.
 *
 * Every access is best-effort. Blocked storage (private browsing, a
 * SecurityError) costs the cold-boot comparison, not the session.
 */

// distinct key name so a deploy-straddling session cannot misread an older shape
const RENDERED_IDENTITY_KEY = 'linklater_rendered_identity';

export function readRenderedIdentity(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage.getItem(RENDERED_IDENTITY_KEY);
  } catch {
    return null;
  }
}

export function noteRenderedIdentity(userId: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(RENDERED_IDENTITY_KEY, userId);
  } catch {
    // best-effort: a refused write costs detection, never the session
  }
}

export function forgetRenderedIdentity(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(RENDERED_IDENTITY_KEY);
  } catch {
    // best-effort, same as the write
  }
}
