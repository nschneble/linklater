import { useEffect, useState } from 'react';
import Alert from '../common/Alert';
import { createLink, getSuggestions } from '../../lib/api';
import type { Suggestion } from '../../lib/api';
import { FOCUS_RING } from '../../lib/styles';
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
}

/**
 * Discovery callout shown beneath the "No unread links" empty state on
 * the main unread view AND on the `/stumble` empty state. Fetches a
 * single suggested article from one random source (Wikipedia, Aeon,
 * Atlas Obscura, Colossal, Low-Tech Magazine, or Nautilus) and offers a
 * one-click "Add and read" action that:
 *
 * 1. POSTs the URL to `/links` so it lands in the user's collection.
 * 2. Navigates the browser to the article so the user can read it
 *    immediately.
 *
 * Accessibility:
 * - The button's accessible name is "Add and read" (visible text). The
 *   suggested title and source are exposed via `aria-describedby` so a
 *   screen reader hears the full context without violating WCAG 2.5.3
 *   Label in Name.
 * - During the round-trip, `aria-busy="true"` + `aria-disabled="true"`
 *   keep focus on the button (a hard `disabled` would steal focus and
 *   suppress the error announcement).
 * - Errors render via the shared `Alert` component which sets
 *   `role="alert"` — do not duplicate `aria-live` here.
 */
export default function SuggestionCallout({
  fallback = null,
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

  async function handleAddAndRead() {
    if (!suggestion || adding) return;
    setError(null);
    setAdding(true);
    try {
      await createLink({ url: suggestion.url });
      window.location.assign(suggestion.url);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Something went wrong',
      );
      setAdding(false);
    }
  }

  if (loading) {
    return (
      <div
        className="mt-6 mx-auto w-full max-w-md p-4 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg animate-pulse"
        aria-busy="true"
        aria-live="polite"
      >
        <p className="text-[var(--text-muted)] text-xs">
          Looking for something to read…
        </p>
      </div>
    );
  }

  if (!suggestion || !sourceName) {
    return <>{fallback}</>;
  }

  const titleId = 'suggestion-callout-title';
  const sourceLabel = `How about something from ${sourceName}?`;

  return (
    <div className="mt-6 mx-auto w-full max-w-md p-4 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg text-left animate-fade-in-up">
      <p className="mb-2 text-[var(--text-muted)] text-xs font-medium">
        {sourceLabel}
      </p>
      <p
        id={titleId}
        className="mb-1 text-[var(--text)] text-sm font-semibold text-balance"
      >
        {suggestion.title}
      </p>
      {suggestion.description && (
        <p className="mb-3 text-[var(--text-muted)] text-xs text-pretty line-clamp-3">
          {suggestion.description}
        </p>
      )}
      <button
        type="button"
        onClick={handleAddAndRead}
        aria-busy={adding}
        aria-disabled={adding}
        aria-describedby={titleId}
        className={`group inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-fg)] text-xs font-semibold ${FOCUS_RING} rounded-full transition cursor-pointer aria-disabled:cursor-progress aria-disabled:opacity-80`}
      >
        <span className="group-aria-busy:hidden">Add and read</span>
        <span className="hidden group-aria-busy:inline">Adding…</span>
        <i
          className="fa-solid fa-arrow-right text-[10px] group-aria-busy:hidden"
          aria-hidden="true"
        />
        <i
          className="fa-solid fa-circle-notch fa-spin text-[10px] hidden group-aria-busy:inline"
          aria-hidden="true"
        />
      </button>
      {error && (
        <Alert className="mt-3" variant="error">
          {error}
        </Alert>
      )}
    </div>
  );
}
