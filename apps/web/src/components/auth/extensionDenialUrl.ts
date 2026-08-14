/**
 * The destination a declined consent grant sends the browser to.
 *
 * Declining is a navigation rather than a closed window because
 * `window.close()` does nothing at all unless the tab was script-opened:
 * no navigation, no DOM change, nothing announced, so a screen reader user
 * waits on a control that already finished doing nothing. Handing the
 * denial back lets the extension close its own window, which it may do.
 *
 * The destination is the API's own decline route rather than the
 * extension's callback, because deciding whether a callback may be
 * forwarded to needs the allowlist, and the allowlist is the server's.
 * What stood here before was a guess at its shape, and it disagreed with
 * the real list in both directions: it refused plain https callbacks the
 * server would have granted on, dropping the user in the app while the
 * extension heard nothing, and it would have forwarded to any
 * `chromiumapp.org` host whether or not anyone had registered it. The
 * server appends the `error=access_denied` that RFC 6749 4.1.2.1
 * specifies, and answers with the app instead for anything it cannot
 * vouch for.
 *
 * It always returns a string. An `undefined` here would render an anchor
 * with no `href`, which carries no link role, takes no focus, and cannot
 * be reached from the keyboard at all, while still painting as if it
 * could. The base is joined as text rather than parsed, so a relative one
 * works and no input can make this throw on the way to that href.
 */

import { API_BASE_URL } from '../../lib/api';

export function extensionDenialUrl(redirectUri: string): string {
  const query = new URLSearchParams({ redirect_uri: redirectUri });
  return `${API_BASE_URL}/auth/extension/deny?${query.toString()}`;
}
