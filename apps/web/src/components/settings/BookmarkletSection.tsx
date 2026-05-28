import { getBookmarkletToken, regenerateBookmarkletToken } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import { FOCUS_RING } from '../../lib/styles';
import Alert from '../common/Alert';
import BookmarkletRegenerateButton from './BookmarkletRegenerateButton';
import { buildBookmarkletCode } from './bookmarkletCode';
import { useEffect, useRef, useState } from 'react';

/**
 * Settings section that renders the Linklater bookmarklet.
 *
 * Embeds a never-expiring `ltk_` PAT (`kind = BOOKMARKLET`) that is lazily
 * provisioned on first render via `getBookmarkletToken()` and revoked +
 * reissued by the Regenerate button. The `setAttribute` href-bypass for
 * `javascript:` URLs (React sanitizes declarative ones) remains.
 */
export default function BookmarkletSection() {
  const bookmarkletReference = useRef<HTMLAnchorElement>(null);
  const [rawToken, setRawToken] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getBookmarkletToken()
      .then((token) => {
        if (!cancelled) setRawToken(token.rawToken);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLoadError(
            getErrorMessage(error, 'Failed to load bookmarklet token'),
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const code = rawToken ? buildBookmarkletCode(rawToken) : null;

  // GOTCHA: React sanitizes `javascript:` URLs that are set declaratively via
  // the `href` prop (replaces them with `about:blank`). Setting it via
  // `setAttribute` after render bypasses this. See:
  // https://github.com/facebook/react/issues/16382
  useEffect(() => {
    if (!bookmarkletReference.current || !code) return;
    bookmarkletReference.current.setAttribute('href', code);
  }, [code]);

  const loading = rawToken === null && !loadError;

  return (
    <div
      id="bookmarklet"
      tabIndex={-1}
      className="scroll-mt-24 max-w-md space-y-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
    >
      <div className="flex items-start justify-between gap-3">
        <h3
          id="bookmarklet-heading"
          className="text-[var(--text)] text-sm font-semibold text-balance"
        >
          Bookmarklet
        </h3>
        {rawToken && (
          <BookmarkletRegenerateButton
            regenerate={regenerateBookmarkletToken}
            onRegenerated={setRawToken}
          />
        )}
      </div>
      <p className="text-[var(--text-muted)] text-xs text-pretty">
        Drag this button to your bookmarks bar. Click it on any page to save the
        link directly to Linklater.
      </p>
      <p className="text-[var(--text-subtle)] text-xs" role="status">
        {loading ? 'Generating your bookmarklet…' : ''}
      </p>
      {loadError && (
        <Alert id="bookmarklet-load-error" variant="error">
          {loadError}
        </Alert>
      )}
      {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
      <a
        ref={bookmarkletReference}
        // Placeholder href so the element exposes the `link` role from
        // first paint; the real `javascript:` URL is swapped in via
        // `setAttribute` once the token resolves.
        href="#"
        aria-busy={loading}
        aria-disabled={Boolean(loadError) || undefined}
        aria-describedby={loadError ? 'bookmarklet-load-error' : undefined}
        aria-label="Save to Linklater — drag to your bookmarks bar, or click on any page to save that link"
        className={`inline-flex items-center justify-center gap-1.5 pl-3.5 pr-4 py-2 bg-[var(--bg-elevated)] hover:bg-[var(--bg-surface)] border-shadow hover:border-shadow text-[var(--text)] text-xs font-semibold ring-1 ring-[var(--border)] ${FOCUS_RING} rounded-full cursor-grab active:cursor-grabbing active:scale-[0.96] transition duration-200 aria-busy:opacity-50 aria-busy:cursor-wait aria-busy:pointer-events-none aria-disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:pointer-events-none`}
        draggable={!loadError}
        onClick={(event) => event.preventDefault()}
      >
        <i
          aria-hidden="true"
          className="fa-solid fa-bookmark text-[var(--text-subtle)] text-[0.7rem]"
        />
        Save to Linklater
      </a>
      <p className="mb-8 text-[var(--text-subtle)] text-xs text-pretty">
        Your auth token is embedded in this bookmarklet. It never expires, but
        it can be regenerated if someone else gains access to it.
      </p>
    </div>
  );
}
