import { stumbleLink } from '../../lib/api';
import { useDocumentTitle } from '../../lib/hooks/useDocumentTitle';
import { isSafeRedirectUrl } from '../../lib/safe-redirect-url';
import StumbleEmptyView from './StumbleEmptyView';
import { useEffect, useRef, useState } from 'react';

type StumbleState = 'loading' | 'empty';

/**
 * Standalone page rendered at `/stumble`. On mount it calls
 * `POST /links/stumble`, which atomically picks a random unread link and
 * marks it as read. If a link is found, the page redirects via
 * `window.location.replace(url)` so the browser back button returns to
 * whatever page the user was on before clicking the Stumble! bookmark —
 * `/stumble` itself is dropped from history, avoiding a redirect loop.
 * When no unread links exist, renders `StumbleEmptyView` instead.
 */
export default function StumblePage() {
  useDocumentTitle('Stumble — Linklater');
  const [state, setState] = useState<StumbleState>('loading');
  const isMountedReference = useRef(true);

  useEffect(() => {
    isMountedReference.current = true;
    return () => {
      isMountedReference.current = false;
    };
  }, []);

  useEffect(() => {
    stumbleLink()
      .then((result) => {
        if (!isMountedReference.current) return;
        if (isSafeRedirectUrl(result.url)) {
          window.location.replace(result.url);
        } else {
          setState('empty');
        }
      })
      .catch(() => {
        if (!isMountedReference.current) return;
        setState('empty');
      });
  }, []);

  if (state === 'empty') return <StumbleEmptyView />;

  return (
    <main className="flex items-center justify-center min-h-screen bg-[var(--bg)] text-[var(--text-muted)] select-none">
      <p role="status" aria-live="polite" className="sr-only">
        Finding a random link…
      </p>
      <i
        className="fa-solid fa-arrows-rotate fa-spin text-4xl opacity-50"
        aria-hidden="true"
      />
    </main>
  );
}
