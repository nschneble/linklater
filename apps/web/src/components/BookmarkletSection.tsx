import { useEffect, useRef } from 'react';

export default function BookmarkletSection() {
  const bookmarkletRef = useRef<HTMLAnchorElement>(null);

  // Note: React sanitizes `javascript:` urls that are set declaratively
  // Setting the href via setAttribute (after render) bypasses this

  useEffect(() => {
    if (!bookmarkletRef.current) return;

    const token = localStorage.getItem('linklater_token') ?? '';
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
      'body:JSON.stringify({url:location.href,title:document.title})})' +
      '.then(function(r){r.ok' +
      "?n('Saved to Linklater \u2713',true)" +
      ":r.text().then(function(m){n(m||'Error saving link',false)})})" +
      ".catch(function(){n('Could not reach Linklater',false)})" +
      '})();';
    bookmarkletRef.current.setAttribute('href', code);
  }, []);

  return (
    <div className="max-w-md space-y-3">
      <h3 className="text-[var(--text)] text-sm font-semibold">Bookmarklet</h3>
      <p className="text-[var(--text-muted)] text-xs">
        Drag this button to your bookmarks bar. Click it on any page to save the
        link directly to Linklater.
      </p>
      <a
        className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--bg-elevated)] hover:bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text)] text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded-full select-none transition cursor-grab active:cursor-grabbing"
        ref={bookmarkletRef}
        onClick={(event) => event.preventDefault()}
        draggable
      >
        <i className="fa-solid fa-bookmark text-[var(--accent)] text-[0.7rem]" />
        Save to Linklater
      </a>
      <p className="text-[var(--text-subtle)] text-xs">
        Your auth token is embedded in this bookmarklet. Keep it private. It
        expires after 90 days. Reinstall it from this page when it does.
      </p>
    </div>
  );
}
