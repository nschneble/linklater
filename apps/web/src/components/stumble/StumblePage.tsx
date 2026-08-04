import Alert from '../common/Alert';
import IconButton from '../common/IconButton';
import { isSafeRedirectUrl } from '../../lib/safe-redirect-url';
import StumbleEmptyView from './StumbleEmptyView';
import { stumbleLink } from '../../lib/api';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useDocumentTitle } from '../../lib/hooks/useDocumentTitle';

type StumbleState = 'loading' | 'empty' | 'error';

/**
 * Standalone page rendered at `/stumble`. On mount it calls
 * `POST /links/stumble`, which atomically picks a random unread link and
 * marks it as read.
 *
 * Outcomes:
 * - URL passes `isSafeRedirectUrl` → `window.location.replace(url)` so the
 *   browser back button returns to wherever the user clicked the Stumble!
 *   bookmark; `/stumble` itself drops from history, avoiding a redirect loop.
 * - URL is null → `StumbleEmptyView` (the user's unread list is empty).
 * - URL is non-null but fails the safety check, or the request errors →
 *   `error` state with an `Alert` + a retry button that pulls another link.
 *   Without the dedicated state, an unsafe-URL link silently looked
 *   identical to "no unread links" and the user lost access to it.
 */
export default function StumblePage() {
  const [state, setState] = useState<StumbleState>('loading');
  useDocumentTitle(
    state === 'error' ? 'Linklater – Stumble error' : 'Linklater – Stumble',
  );

  const isMountedReference = useRef(true);
  const retryButtonReference = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    isMountedReference.current = true;
    return () => {
      isMountedReference.current = false;
    };
  }, []);

  const handleStumble = useCallback(() => {
    setState('loading');
    stumbleLink()
      .then((result) => {
        if (!isMountedReference.current) return;
        if (!result.url) {
          // no unread links - backend signals this with a null/empty URL
          setState('empty');
          return;
        }
        if (isSafeRedirectUrl(result.url)) {
          window.location.replace(result.url);
          return;
        }
        // URL failed safety check: recoverable error, not the empty view
        setState('error');
      })
      .catch(() => {
        if (!isMountedReference.current) return;
        setState('error');
      });
  }, []);

  useEffect(() => {
    handleStumble();
  }, [handleStumble]);

  // move keyboard focus onto the retry button when the error state appears
  // so a keyboard-only user can recover without hunting for it.
  useEffect(() => {
    if (state === 'error') {
      retryButtonReference.current?.focus();
    }
  }, [state]);

  if (state === 'empty') return <StumbleEmptyView />;

  if (state === 'error') {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen max-w-md mx-auto px-4 bg-[var(--base-bg)] text-[var(--base-text)] text-center gap-4">
        <Alert variant="error" icon="fa-triangle-exclamation">
          We couldn't open that link. It may have been saved with an unsupported
          address.
        </Alert>
        <IconButton
          ref={retryButtonReference}
          variant="elevated"
          surface="base"
          onClick={handleStumble}
        >
          <i className="fa-solid fa-arrows-rotate text-xs" aria-hidden="true" />
          Try another link
        </IconButton>
      </main>
    );
  }

  return (
    <main className="flex items-center justify-center min-h-screen bg-[var(--base-bg)] text-[var(--base-alt-text)] select-none">
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
