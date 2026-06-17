import EndpointList from './EndpointList';
import { BRAND_CHROME_STYLE } from '../../lib/apiDocs/apiDocsColors';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { useDocumentTitle } from '../../lib/hooks/useDocumentTitle';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string | undefined;

/**
 * API documentation. A single token-driven component tree that paints two
 * ways depending on auth (Wave 6):
 *
 *   - Logged OUT (`user === null`): the landing/marketing BRAND chrome. The
 *     wrapper pins `bg-hit-man`, forces dark `color-scheme`, and supplies the
 *     brand literals to every bundle slot the child components consume
 *     (`BRAND_CHROME_STYLE`) so the now-token-driven tree resolves to the
 *     brand palette. The CVD focus-halo override + `--focus-ring` pin live in
 *     this branch only.
 *
 *   - Logged IN (`user !== null`): the user's ACTIVE theme. `ThemeProvider`
 *     already sets `data-theme`/`data-mode` on `<html>` above the router
 *     (`main.tsx`), so every `var(--…)` bundle token cascades here for free.
 *     No inline token pins, no `bg-hit-man`; `color-scheme` follows the mode.
 *
 * The child components read bundle tokens via `var(--…)` in both branches —
 * the brand branch just pins those tokens to brand literals, so one styling
 * path serves both modes.
 */
export default function ApiDocsView() {
  useDocumentTitle('API documentation – Linklater');
  const { user } = useAuth();
  const isBrand = user === null;

  return (
    // BRAND branch only: pin `bg-hit-man` and the brand token literals so the
    // token-driven children paint the marketing palette, and force dark
    // `color-scheme`. The wrapper also redeclares `--base-bg` AND
    // `--focus-ring` (inside `BRAND_CHROME_STYLE`) so the global
    // `[data-cvd='on'] *:focus-visible` halo (index.css) paints brand colors:
    // some themes set `--focus-ring` to a hue that fails SC 1.4.11 vs the navy
    // gradient (e.g. before-sunrise dark), so it pins `--color-dazed`
    // (#eeeede, ~16:1 vs #0a0812). THEMED branch: no pins — the `<html>`
    // cascade supplies every slot, the theme's own `--focus-ring` wins, and
    // `color-scheme` follows the active mode.
    <div
      className={`min-h-screen ${isBrand ? 'bg-hit-man [color-scheme:dark]' : ''}`}
      style={isBrand ? BRAND_CHROME_STYLE : undefined}
    >
      {/*
       * Skip link mirrors the LandingPage pattern: brand-locked white-on-navy
       * (clears ~16:1 vs the gradient) rather than user-theme `--focus-ring`,
       * which is not safe on the fixed brand gradient.
       */}
      <a
        href="#api-docs"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-white focus:text-[#14103a] focus:text-sm focus:font-semibold focus:outline-none focus:ring-2 focus:ring-white focus:rounded-lg"
      >
        Skip to API documentation
      </a>

      <header className="max-w-6xl mx-auto px-6 sm:px-8 pt-12 sm:pt-16 pb-8 sm:pb-10 space-y-6 select-none">
        {/*
         * Back/forward navigation pair. ONE <nav> landmark wraps both links
         * so AT users land on a single "API docs" region with two items, not
         * two unlabeled landmarks. Sits above the h1 in DOM order so a Tab
         * from the skip link visits the back-affordance before page identity
         * (SC 2.4.3). Plain text (not button-styled) keeps the h1 as focal
         * point. The "Manage tokens" link returns to /settings via router
         * state (NOT a #fragment), because SettingsView reads `scrollTo`
         * from `location.state` to activate + scroll its sections; a plain
         * hash would scroll the browser but never wake the activation
         * machinery. The state convention matches WelcomeModal's "Go to
         * bookmarks" link (see SettingsView lines 109-121).
         */}
        <nav
          aria-label="API docs"
          className="flex items-center justify-between gap-3 text-sm"
        >
          {/*
           * Arrow glyphs are wrapped in aria-hidden spans so they don't leak
           * into the accessible name of each link (SC 1.1.1, SC 2.4.4). The
           * non-breaking space inside each span keeps the visual gap between
           * arrow and word even when the surrounding text node is collapsed
           * away by the screen reader.
           */}
          <Link
            to="/"
            className="text-[var(--base-text)] hover:text-[var(--base-highlight)] hover:underline focus-visible:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--base-bg)] focus-visible:rounded"
          >
            <span aria-hidden="true">&larr;&nbsp;</span>Linklater
          </Link>
          <Link
            to="/settings"
            state={{ scrollTo: 'integrations' }}
            className="text-[var(--base-text)] hover:text-[var(--base-highlight)] hover:underline focus-visible:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--base-bg)] focus-visible:rounded"
          >
            Manage tokens<span aria-hidden="true">&nbsp;&rarr;</span>
          </Link>
        </nav>
        <div className="flex flex-col gap-3">
          {/*
           * BRAND branch keeps the marketing gradient h1 (dazed→sunrise clip).
           * THEMED branch renders a solid `--base-text` h1 — a per-theme
           * gradient is not part of the bundle vocabulary, and the page
           * identity reads cleaner as solid theme text.
           */}
          <h1
            className={
              isBrand
                ? 'bg-gradient-to-br from-dazed to-sunrise bg-clip-text text-transparent text-4xl sm:text-5xl font-bold tracking-tight text-balance'
                : 'text-[var(--base-text)] text-4xl sm:text-5xl font-bold tracking-tight text-balance'
            }
          >
            Linklater API
          </h1>
          <p className="max-w-2xl text-[var(--base-text)] text-base sm:text-lg text-pretty leading-relaxed">
            Learn how to save, read, and delete links from your collection.
          </p>
        </div>
      </header>

      <section
        aria-labelledby="api-docs-reference-heading"
        id="api-docs"
        className="max-w-7xl mx-auto px-4 sm:px-6 pb-16 select-none"
      >
        <h2 className="sr-only" id="api-docs-reference-heading">
          API documentation
        </h2>
        {/*
         * Outer list border consumes `--mount-border` (§2: the list is the
         * card surface). In the BRAND branch this pins to #7d6ec0, which clears
         * SC 1.4.11 vs the bg-hit-man radial (4.17:1 vs the gradient top
         * #14103a, 4.60:1 vs the base #0a0812); in the THEMED branch the
         * theme's own `--mount-border` carries the contract, mechanized by the
         * card-style-border-vs-page-base-bg test in bundles.contrast.test.ts.
         *
         * `animate-fade-in-up` carries `motion-reduce:animate-none` so the
         * enter animation collapses to instant for users who prefer reduced
         * motion (CONSTRAINT M1).
         */}
        <div className="overflow-hidden border border-[var(--mount-border)] rounded-2xl animate-fade-in-up motion-reduce:animate-none">
          <EndpointList apiBaseUrl={API_BASE_URL} />
        </div>
      </section>
    </div>
  );
}
