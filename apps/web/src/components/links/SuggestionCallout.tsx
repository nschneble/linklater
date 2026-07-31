import Alert from '../common/Alert';
import PrimaryButton from '../common/PrimaryButton';
import { createLink, getSuggestions, readLink } from '../../lib/api';
import { isSafeRedirectUrl } from '../../lib/safe-redirect-url';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Suggestion } from '../../lib/api';
import type { ReactNode } from 'react';

interface SuggestionCalloutProps {
  /**
   * Rendered in place of the callout when no suggestion can be shown
   * (empty result or fetch failure). Defaults to `null` – the unread-list
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
   * destination – same-tab nav is the expected behaviour there).
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
 *    list – the user is opening it to read it now.
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
 *   `role="alert"` – do not duplicate `aria-live` here.
 */
export default function SuggestionCallout({
  fallback = null,
  inNewTab = false,
}: SuggestionCalloutProps = {}) {
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [sourceName, setSourceName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchFailed, setFetchFailed] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // only the initial fetch may unmount the card, preserving focus (WCAG 2.4.3)
  const isInitialFetchRef = useRef(true);

  // guards effect + imperative refetch against setState after unmount
  const isMountedRef = useRef(true);

  const fetchSuggestion = useCallback(() => {
    getSuggestions(1)
      .then((response) => {
        if (!isMountedRef.current) return;
        const next = response.suggestions[0] ?? null;
        if (isInitialFetchRef.current) {
          setSuggestion(next);
          setSourceName(response.sourceName);
          setLoading(false);
          isInitialFetchRef.current = false;
        } else if (next) {
          // refetch swaps only on non-null, keeping focus on the card (WCAG 2.4.3)
          setSuggestion(next);
          setSourceName(response.sourceName);
        }
      })
      .catch((caught) => {
        if (!isMountedRef.current) return;
        if (import.meta.env.DEV) {
          console.warn('SuggestionCallout: fetch failed', caught);
        }
        if (isInitialFetchRef.current) {
          setFetchFailed(true);
          setLoading(false);
          isInitialFetchRef.current = false;
        }
        // refetch failure keeps the card for focus; silent, user already navigated
      });
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    fetchSuggestion();
  }, [fetchSuggestion]);

  function handleAddAndRead() {
    if (!suggestion || adding) return;
    setError(null);
    setAdding(true);

    const url = suggestion.url;

    if (!isSafeRedirectUrl(url)) {
      setError('Suggestion URL is not safe to open.');
      setAdding(false);
      return;
    }

    // open synchronously in the handler; awaiting first loses user activation (popup blocked)
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
          // clear busy, then refetch so the just-added article isn't re-suggested
          setAdding(false);
          fetchSuggestion();
        }
      } catch (caught) {
        setError(
          caught instanceof Error ? caught.message : 'Something went wrong',
        );
        setAdding(false);
      }
    })();
  }

  // empty result shows the fallback; fetch errors go to the live region
  if (!loading && !fetchFailed && (!suggestion || !sourceName)) {
    return <>{fallback}</>;
  }

  return (
    <>
      <p
        className="mb-2 text-[var(--base-alt-text)] text-xs font-medium animate-card-enter"
        aria-live="polite"
        aria-atomic="true"
      >
        {loading
          ? 'Looking for something to read…'
          : fetchFailed
            ? "Couldn't load suggestions right now."
            : `How about something from ${sourceName}?`}
      </p>
      {!loading && !fetchFailed && suggestion && (
        <div className="mt-2 mx-auto w-full max-w-md pl-10 pr-8 py-4 bg-[var(--mount-bg)] border-shadow hover:border-shadow rounded-xl text-left">
          <p
            style={{ animationDelay: '60ms' }}
            className="mb-1 text-[var(--mount-text)] text-sm font-semibold text-balance line-clamp-1 animate-card-enter"
            id="suggestion-callout-title"
          >
            {suggestion.title}
          </p>
          {suggestion.description && (
            <p
              style={{ animationDelay: '120ms' }}
              className="mb-3 text-[var(--mount-alt-text)] text-xs text-pretty line-clamp-2 animate-card-enter"
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
