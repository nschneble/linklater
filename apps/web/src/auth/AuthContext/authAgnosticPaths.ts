/**
 * The paths that render without consulting auth state, and the reduction
 * that decides whether the address bar is standing on one of them.
 *
 * Lives beside `useIdentityGuard` rather than inside it because the guard
 * asks this question from three places and the table has a test of its
 * own; the guard is left holding only what it does about the answer.
 */

/**
 * Every path `routes/Common.tsx` declares. Whole-table rather than the
 * subset holding a form or a single-use token: missing a form costs
 * input nobody can retype, while protecting a static document costs a
 * tab that goes on rendering the previous account until the next
 * navigation, the deferred announcement included. That second cost is
 * not nothing, and `ExtensionAuthorizePage` is where it shows: it names
 * the account it is about to grant on, and it would name the one that
 * left. Which account the grant then lands on is an open question, not
 * a guarantee: the hand-off is a top-level navigation carrying no
 * bearer header, so the endpoint's guard refuses it before any account
 * is chosen. The controller spec stubs that guard, which is why a green
 * suite says nothing here. Delivering the token is its own change.
 * Exported so `authAgnosticPaths.test.ts` can fail when the two drift.
 */
export const AUTH_AGNOSTIC_PATHS = new Set([
  '/account/confirm-deletion',
  '/docs',
  '/extension/authorize',
  '/failwhale',
  '/logout',
  '/oauth/callback',
  '/privacy',
  '/reset-password',
  '/terms',
  '/verify-email',
  '/verify-email-change',
  '/verify-login',
]);

/**
 * Percent-decoding, spelled the way React Router spells it (`decodePath`
 * in `react-router/dist/development/lib/router/utils.js`). Segment by
 * segment, with a `/` that decoding produced put back as an escape, so
 * `%2F` cannot smuggle in a separator the router would never honor. A
 * malformed escape throws, and the raw value is returned, which is also
 * what the router falls back to: a path neither side can decode is one
 * the router will not match, and the guard should take the move.
 */
function decodePathname(pathname: string): string {
  try {
    return pathname
      .split('/')
      .map((segment) => decodeURIComponent(segment).replaceAll('/', '%2F'))
      .join('/');
  } catch {
    return pathname;
  }
}

/**
 * The address bar's spelling of a path, reduced to the one the table is
 * written in. The router decodes, matches case-insensitively and ignores
 * trailing slashes, so a raw string compare recognizes fewer pages than
 * actually render, and it fails in the direction that costs the most: an
 * emailed link opened as `/Reset-Password` or `/reset%2Dpassword` renders
 * the form and gets replaced mid-entry, spending the single-use token
 * with it (Postel's law).
 *
 * It over-recognizes in one spot, and in the same safe direction:
 * `toLowerCase` folds the Kelvin sign to an ASCII `k` while the router's
 * unflagged `i` regex does not, so `/oauth/callbacK` reads as a table
 * entry here and matches no route there.
 */
export function normalizePathname(pathname: string): string {
  const withoutTrailingSlash = decodePathname(pathname)
    .toLowerCase()
    .replace(/\/+$/, '');
  if (withoutTrailingSlash === '') return '/';
  return withoutTrailingSlash;
}

export function rendersRegardlessOfAuth(): boolean {
  return AUTH_AGNOSTIC_PATHS.has(normalizePathname(window.location.pathname));
}
