/**
 * Builds the minified `javascript:` URL that becomes the bookmarklet's href.
 * Embeds the user's PAT (`token`) inline so the bookmarklet authenticates
 * its `POST /links` call from any page the user clicks it on.
 *
 * Identifiers are minified to keep the bookmarklet URL short (bookmark UIs
 * truncate long URLs and some browsers cap them): `t` = token, `a` = API
 * base URL, `n(m, k)` = notification toast (`m` = message text, `k` = ok
 * flag — true for success, false for error), `e` = toast element, `r` =
 * fetch response.
 *
 * The injected toast carries `role` + `aria-live` so assistive technology
 * on the host page announces the save result. Success uses
 * `role="status"` (polite) and error uses `role="alert"` (assertive).
 */
export function buildBookmarkletCode(token: string): string {
  const apiUrl = import.meta.env.VITE_API_BASE_URL as string;
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
    ":r.text().then(function(m){n('⚠ '+(m||'Error saving link'),false)})})" +
    ".catch(function(){n('⚠ Could not reach Linklater',false)})" +
    '})();'
  );
}
