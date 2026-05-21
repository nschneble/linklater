import { getStoredToken } from '../../lib/api';
import { FOCUS_RING } from '../../lib/styles';
import { useEffect, useRef } from 'react';

/**
 * Settings section that generates and renders the Linklater bookmarklet.
 *
 * The bookmarklet is a `javascript:` URL that, when clicked in the browser,
 * calls `POST /links` with the current page's URL using the user's stored JWT.
 * A small toast notification (built into the bookmarklet itself) shows the
 * result inline on whatever page the user is visiting.
 *
 * GOTCHA: React sanitizes `javascript:` URLs set declaratively via the `href`
 * prop. The href is therefore set imperatively via `setAttribute` inside a
 * `useEffect` to bypass this sanitization. This is intentional.
 *
 * The JWT is embedded at render time and expires after 90 days. Users must
 * return to this page to reinstall the bookmarklet when it expires.
 */
export default function BookmarkletSection() {
  const bookmarkletReference = useRef<HTMLAnchorElement>(null);

  // NOTE: React sanitizes `javascript:` URLs that are set declaratively via
  // the `href` prop (it replaces them with `about:blank`). Setting the href
  // via `setAttribute` after render bypasses this safety check. This is the
  // intended approach for bookmarklet generation.
  // See: https://github.com/facebook/react/issues/16382

  useEffect(() => {
    if (!bookmarkletReference.current) return;

    const token = getStoredToken() ?? '';
    const apiUrl = import.meta.env.VITE_API_BASE_URL as string;
    const code =
      'javascript:(function(){' +
      'var t=' +
      JSON.stringify(token) +
      ',a=' +
      JSON.stringify(apiUrl) +
      ';' +
      "function n(m,k){var e=document.createElement('div');e.textContent=m;" +
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
      "?n('\u2713 Saved to Linklater',true)" +
      ":r.text().then(function(m){n('\u26a0 '+(m||'Error saving link'),false)})})" +
      ".catch(function(){n('\u26a0 Could not reach Linklater',false)})" +
      '})();';
    bookmarkletReference.current.setAttribute('href', code);
  }, []);

  return (
    <div className="max-w-md space-y-3">
      <h2 className="text-[var(--text)] text-sm font-semibold text-balance">
        Bookmarklet
      </h2>
      <p className="text-[var(--text-muted)] text-xs text-pretty">
        Drag this button to your bookmarks bar. Click it on any page to save the
        link directly to Linklater.
      </p>
      {/* eslint-disable-next-line jsx-a11y/anchor-is-valid, jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <a
        className={`inline-flex items-center justify-center gap-1.5 pl-3.5 pr-4 py-2 bg-[var(--bg-elevated)] hover:bg-[var(--bg-surface)] border-shadow hover:border-shadow text-[var(--text)] text-xs font-semibold ring-1 ring-[var(--border)] ${FOCUS_RING} rounded-full cursor-grab active:cursor-grabbing active:scale-[0.96] transition duration-200`}
        ref={bookmarkletReference}
        aria-label="Save to Linklater bookmarklet — drag to bookmarks bar to install"
        onClick={(event) => event.preventDefault()}
        draggable
      >
        <i
          className="fa-solid fa-bookmark text-[var(--text-subtle)] text-[0.7rem]"
          aria-hidden="true"
        />
        Save to Linklater
      </a>
      <p className="text-[var(--text-subtle)] text-xs text-pretty">
        Your auth token is embedded in this bookmarklet. Keep it private. It
        expires after 90 days. Reinstall it from this page when it does.
      </p>
    </div>
  );
}
