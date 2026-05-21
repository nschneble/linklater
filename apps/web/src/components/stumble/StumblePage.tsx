import StumbleEmptyView from './StumbleEmptyView';
import { stumbleLink } from '../../lib/api';
import { hostnameOf } from '../../lib/strings';
import { useCallback, useEffect, useRef, useState } from 'react';
import PrimaryButton from '../common/PrimaryButton';
import { FOCUS_RING } from '../../lib/styles';

type StumbleState =
  | { kind: 'loading' }
  | { kind: 'ready'; url: string }
  | { kind: 'empty' };

/**
 * Standalone page rendered at `/stumble`. On mount it calls
 * `POST /links/stumble`, which atomically picks a random unread link and
 * marks it as read.
 *
 * When a link is found, the page shows an interstitial confirmation card
 * with the title, hostname, and an "Open link" button. This replaces the
 * earlier auto-redirect, which triggered an unannounced context change
 * (WCAG 3.2.5) and broke the browser back button. When no unread links
 * exist, renders `StumbleEmptyView` instead.
 */
export default function StumblePage() {
  const [state, setState] = useState<StumbleState>({ kind: 'loading' });
  const openButtonReference = useRef<HTMLAnchorElement>(null);
  const isMountedReference = useRef(true);

  useEffect(() => {
    isMountedReference.current = true;
    return () => {
      isMountedReference.current = false;
    };
  }, []);

  const fetchStumble = useCallback(() => {
    stumbleLink()
      .then((result) => {
        if (!isMountedReference.current) return;
        if (result.url) {
          setState({ kind: 'ready', url: result.url });
        } else {
          setState({ kind: 'empty' });
        }
      })
      .catch(() => {
        if (!isMountedReference.current) return;
        setState({ kind: 'empty' });
      });
  }, []);

  useEffect(() => {
    fetchStumble();
  }, [fetchStumble]);

  // Move keyboard focus to the primary action as soon as the interstitial
  // renders so users can confirm with Enter without hunting for the button.
  useEffect(() => {
    if (state.kind === 'ready') {
      openButtonReference.current?.focus();
    }
  }, [state.kind]);

  if (state.kind === 'empty') return <StumbleEmptyView />;

  if (state.kind === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[var(--bg)] text-[var(--text-muted)] select-none">
        <p role="status" aria-live="polite" className="sr-only">
          Finding a random link…
        </p>
        <i
          className="fa-solid fa-arrows-rotate fa-spin text-4xl opacity-50"
          aria-hidden="true"
        />
      </div>
    );
  }

  const hostname = hostnameOf(state.url);

  return (
    <main className="flex items-center justify-center min-h-screen px-4 py-12 bg-[var(--bg)] text-[var(--text)] select-none">
      <section
        aria-labelledby="stumble-heading"
        className="w-full max-w-md p-6 bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl shadow-xl space-y-4 text-center"
      >
        <p role="status" aria-live="polite" className="sr-only">
          Found a link from {hostname}
        </p>
        <h1
          id="stumble-heading"
          className="text-[var(--text)] text-xl font-semibold text-balance"
        >
          We found something for you
        </h1>
        <p className="text-[var(--text)] text-sm font-medium break-all">
          {state.url}
        </p>
        <p className="text-[var(--text-muted)] text-xs">{hostname}</p>
        <div className="flex flex-col gap-2">
          <a
            ref={openButtonReference}
            href={state.url}
            target="_blank"
            rel="noreferrer"
            aria-label="Open link in new tab"
            className={`inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[var(--accent)] text-[var(--accent-fg)] text-sm font-semibold ${FOCUS_RING} rounded-full cursor-pointer transition`}
          >
            <i
              className="fa-solid fa-up-right-from-square text-xs"
              aria-hidden="true"
            />
            Open link
          </a>
          <PrimaryButton
            type="button"
            onClick={() => {
              setState({ kind: 'loading' });
              fetchStumble();
            }}
          >
            <i
              className="fa-brands fa-stumbleupon text-xs"
              aria-hidden="true"
            />
            Stumble again
          </PrimaryButton>
        </div>
      </section>
    </main>
  );
}
