/**
 * The destination a declined consent grant sends the browser to, or `null`
 * when the extension's callback cannot be trusted with one.
 *
 * Declining is a navigation rather than a closed window because
 * `window.close()` does nothing at all unless the tab was script-opened:
 * no navigation, no DOM change, nothing announced, so a screen reader user
 * waits on a control that already finished doing nothing. Handing the
 * denial back lets the extension close its own window, which it may do.
 *
 * `error=access_denied` on the callback's query component is what RFC 6749
 * 4.1.2.1 specifies for a resource owner who refuses. That section also
 * requires `state` be echoed when the request carried one; nothing in this
 * flow sends one, and the success path does not echo one either, so
 * neither does this.
 *
 * The allowlist is the point. `redirect_uri` arrives on this page's own
 * URL, so a destination taken on trust turns a consent screen into an open
 * redirect that a phishing link aims wherever it likes. The server holds
 * the real allowlist (`EXTENSION_REDIRECT_URIS`) and applies it on the
 * grant, but declining never reaches the server, so the shapes an
 * extension callback can actually have are checked here instead: the two
 * extension schemes, and the host `chrome.identity.getRedirectURL()` mints
 * for a web auth flow.
 */

const EXTENSION_SCHEMES = new Set(['chrome-extension:', 'moz-extension:']);

const WEB_AUTH_FLOW_HOST_SUFFIX = '.chromiumapp.org';

function isExtensionCallback(destination: URL): boolean {
  if (EXTENSION_SCHEMES.has(destination.protocol)) return true;
  return (
    destination.protocol === 'https:' &&
    destination.hostname.endsWith(WEB_AUTH_FLOW_HOST_SUFFIX)
  );
}

export function extensionDenialUrl(redirectUri: string): string | null {
  let destination: URL;
  try {
    destination = new URL(redirectUri);
  } catch {
    return null;
  }

  if (!isExtensionCallback(destination)) return null;

  destination.searchParams.set('error', 'access_denied');
  return destination.toString();
}
