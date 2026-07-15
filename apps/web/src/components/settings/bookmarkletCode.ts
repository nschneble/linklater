/**
 * Resolves the configured API base URL to an absolute URL.
 *
 * Production bakes a same-origin relative base (`VITE_API_BASE_URL=/api`,
 * reverse-proxied by Caddy). That works for the web app because it runs on the
 * Linklater origin, but the bookmarklet runs on arbitrary third-party pages,
 * where a relative `fetch('/api/links')` resolves against the HOST page's
 * origin (e.g. `https://example.com/api/links`) and never reaches Linklater.
 * The Settings page that generates the bookmarklet is served from the
 * Linklater origin — the same origin the API is proxied under — so resolving
 * the base against `window.location.origin` at generation time bakes an
 * absolute URL that works from any page.
 *
 * An already-absolute base (split-domain deployments, e.g.
 * `https://api.example.com`) is origin-qualified and passes through unchanged.
 */
function resolveAbsoluteApiUrl(configuredApiUrl: string): string {
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(configuredApiUrl)) {
    return configuredApiUrl;
  }
  return new URL(configuredApiUrl, window.location.origin).href;
}

/**
 * Builds the minified `javascript:` URL that becomes the bookmarklet's href.
 * Embeds the user's PAT (`token`) inline so the bookmarklet authenticates
 * its `POST /links` call from any page the user clicks it on.
 *
 * Identifiers are minified to keep the bookmarklet URL short (bookmark UIs
 * truncate long URLs and some browsers cap them): `t` = token, `a` = API
 * base URL, `n(m, k)` = notification toast (`m` = message text, `k` = ok
 * flag – true for success, false for error), `e` = toast element, `r` =
 * fetch response.
 *
 * The injected toast carries `role` + `aria-live` so assistive technology
 * on the host page announces the save result. Success uses
 * `role="status"` (polite) and error uses `role="alert"` (assertive).
 */
export function buildBookmarkletCode(token: string): string {
  const apiUrl = resolveAbsoluteApiUrl(
    import.meta.env.VITE_API_BASE_URL as string,
  );
  return (
    'javascript:(function(){' +
    'var t=' +
    JSON.stringify(token) +
    ',a=' +
    JSON.stringify(apiUrl) +
    ';' +
    "function n(m,k){var e=document.createElement('div');e.textContent=m;" +
    "e.setAttribute('role',k?'status':'alert');" +
    "e.setAttribute('aria-live',k?'polite':'assertive');" +
    "e.style.cssText='position:fixed;top:16px;right:16px;padding:12px 18px;" +
    'border-radius:8px;font:600 14px/1 system-ui;z-index:2147483647;' +
    'box-shadow:0 4px 16px rgba(0,0,0,.35);transition:opacity .3s;' +
    "color:'+(k?'#020617':'#fff')+';background:'+(k?'#34d399':'#ef4444');" +
    'document.body.appendChild(e);' +
    "setTimeout(function(){e.style.opacity='0';setTimeout(function(){e.remove()},350)},2500)}" +
    "fetch(a+'/links',{method:'POST'," +
    "headers:{'Content-Type':'application/json','Authorization':'Bearer '+t}," +
    'body:JSON.stringify({url:location.href})})' +
    '.then(function(r){r.ok' +
    "?n('✓ Saved to Linklater',true)" +
    ":r.text().then(function(m){var p;try{p=JSON.parse(m).message;if(p&&p.join)p=p.join(', ')}catch(_){}" +
    "n('⚠ '+(p||m||'Error saving link'),false)})})" +
    ".catch(function(){n('⚠ Could not reach Linklater',false)})" +
    '})();'
  );
}
