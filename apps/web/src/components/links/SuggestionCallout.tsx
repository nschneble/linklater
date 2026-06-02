import { useEffect, useState } from 'react';
import Alert from '../common/Alert';
import PrimaryButton from '../common/PrimaryButton';
import { createLink, getSuggestions, readLink } from '../../lib/api';
import type { Suggestion } from '../../lib/api';
import type { ReactNode } from 'react';

interface SuggestionCalloutProps {
  /**
   * Rendered in place of the callout when no suggestion can be shown
   * (empty result or fetch failure). Defaults to `null` — the unread-list
   * use case already has "No unread links" above it, so silence is fine
   * there. The Stumble empty view passes a "Suggestions are napping too."
   * note so the page acknowledges the attempt instead of going blank.
   */
  fallback?: ReactNode;
  /**
   * When `true`, the "Add and read" action opens the suggestion in a new
   * tab and lets the user stay on the originating page. When `false`
   * (default), the current tab navigates to the suggestion. Use `true`
   * from the unread-list empty state (so `/unread` stays in place); leave
   * `false` on the Stumble empty page (which is itself a discovery
   * destination — same-tab nav is the expected behaviour there).
   */
  inNewTab?: boolean;
}

/**
 * Discovery callout shown beneath the "No unread links" empty state on
 * the main unread view AND on the `/stumble` empty state. Fetches a
 * single suggested article from one random source (Wikipedia, Aeon,
 * Atlas Obscura, Colossal, Low-Tech Magazine, or Nautilus) and offers a
 * one-click "Add and read" action that:
 *
 * 1. Saves the URL to the user's collection via `POST /links`.
 * 2. Marks the newly saved link as read so it doesn't sit in the unread
 *    list — the user is opening it to read it now.
 * 3. Navigates the user to the article. In `inNewTab` mode the tab is
 *    opened synchronously inside the click handler so popup blockers do
 *    not fire; the create + read calls then run in the background. In
 *    same-tab mode the navigation waits for the create + read to finish
 *    so the page does not unload before the bookkeeping is durable.
 *
 * Accessibility:
 * - The button's accessible name is "Add and read" (visible text). The
 *   suggested title and source are exposed via `aria-describedby` so a
 *   screen reader hears the full context without violating WCAG 2.5.3
 *   Label in Name. In `inNewTab` mode the `aria-label` extends the name
 *   with "(opens in new tab)" to match the project convention in
 *   `LinkCardLayout`.
 * - During the round-trip, `aria-busy="true"` + `aria-disabled="true"`
 *   keep focus on the button (a hard `disabled` would steal focus and
 *   suppress the error announcement).
 * - Errors render via the shared `Alert` component which sets
 *   `role="alert"` — do not duplicate `aria-live` here.
 */
export default function SuggestionCallout({
  fallback = null,
  inNewTab = false,
}: SuggestionCalloutProps = {}) {
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [sourceName, setSourceName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    getSuggestions(1)
      .then((response) => {
        if (cancelled) return;
        setSuggestion(response.suggestions[0] ?? null);
        setSourceName(response.sourceName);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function handleAddAndRead() {
    if (!suggestion || adding) return;
    setError(null);
    setAdding(true);

    const url = suggestion.url;

    // For new-tab mode, open the tab synchronously inside the click
    // handler. Waiting for `await createLink` first puts the
    // `window.open` outside the user-activation window and many browsers
    // will block the popup. The create + read calls then run in the
    // background; if they fail the alert appears on the original tab.
    if (inNewTab) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }

    void (async () => {
      try {
        const link = await createLink({ url });
        await readLink(link.id);
        if (!inNewTab) {
          window.location.assign(url);
        } else {
          // Tab is already open; clear the busy state so a returning user
          // sees the original callout in its idle state.
          setAdding(false);
        }
      } catch (caught) {
        setError(
          caught instanceof Error ? caught.message : 'Something went wrong',
        );
        setAdding(false);
      }
    })();
  }

  // Failure path: after the fetch resolves with no usable suggestion,
  // render the caller-provided fallback (the Stumble page passes the
  // "Suggestions are napping too." line; the unread list passes nothing).
  if (!loading && (!suggestion || !sourceName)) {
    return <>{fallback}</>;
  }

  return (
    <>
      <p
        className="mb-2 text-[var(--text-muted)] text-xs font-medium animate-card-enter"
        aria-live="polite"
        aria-atomic="true"
      >
        {loading
          ? 'Looking for something to read…'
          : `How about something from ${sourceName}?`}
      </p>
      {loading || !suggestion ? (
        <SuggestionCalloutSkeleton />
      ) : (
        <div
          className="mt-2 mx-auto w-full max-w-md pl-10 pr-8 py-4 bg-[var(--bg-surface)] border-shadow hover:border-shadow rounded-xl text-left"
          aria-busy={loading}
        >
          <p
            style={{ animationDelay: '60ms' }}
            className="mb-1 text-[var(--text)] text-sm font-semibold text-balance line-clamp-1 animate-card-enter"
            id="suggestion-callout-title"
          >
            {suggestion.title}
          </p>
          {suggestion.description && (
            <p
              style={{ animationDelay: '120ms' }}
              className="mb-3 text-[var(--text-muted)] text-xs text-pretty line-clamp-2 animate-card-enter"
            >
              {suggestion.description}
            </p>
          )}
          <div
            style={{ animationDelay: '180ms' }}
            className="flex items-center gap-2 animate-card-enter"
          >
            <PrimaryButton
              className="-ml-2"
              onClick={handleAddAndRead}
              aria-busy={adding}
              aria-disabled={adding}
              aria-describedby="suggestion-callout-title"
              aria-label={
                inNewTab ? 'Add and read (opens in new tab)' : undefined
              }
            >
              <i
                className="fa-solid fa-book-bookmark text-xs"
                aria-hidden="true"
              />
              Add and read
            </PrimaryButton>
          </div>
          {error && (
            <Alert className="mt-3" variant="error">
              {error}
            </Alert>
          )}
        </div>
      )}
    </>
  );
}

function SuggestionCalloutSkeleton() {
  return (
    <div
      className="mt-6 mx-auto w-full max-w-md pl-10 pr-8 py-4 bg-[var(--bg-surface)] border-shadow hover:border-shadow rounded-xl text-left animate-pulse"
      aria-hidden="true"
      aria-busy="true"
    >
      <div className="w-10/12 h-5 mb-1 bg-[var(--text)]/50 rounded-xs"></div>
      <div className="flex flex-col items-start gap-1 mb-3">
        <div className="w-11/12 h-[13px] bg-[var(--text-muted)]/50 rounded-xs"></div>
        <div className="w-9/12 h-[13px] bg-[var(--text-muted)]/50 rounded-xs"></div>
      </div>
      <div className="w-[129.5px] h-[31px] bg-[var(--accent)]/50 border-shadow rounded-full"></div>
    </div>
  );
}
