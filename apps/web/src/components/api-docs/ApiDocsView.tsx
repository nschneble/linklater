import ApiReference from './ApiReference';
import MethodBadge from './MethodBadge';
import { Link } from 'react-router';
import { useAuth } from '../../auth/AuthContext';
import { useDocumentTitle } from '../../lib/hooks/useDocumentTitle';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string | undefined;

/**
 * API documentation. A single token-driven component tree that paints two
 * ways depending on auth:
 *
 *   - Logged OUT (`user === null`): the landing/marketing BRAND chrome. The
 *     wrapper pins `bg-hit-man`, forces dark `color-scheme`, and activates the
 *     off-book `branding` theme via `data-theme='branding'` (branding.css) so
 *     the now-token-driven tree resolves to the brand palette. The wrapper's
 *     `data-theme` shadows `<html data-theme>` for its subtree, and the
 *     branding cascade supplies every bundle slot plus `--focus-ring` and the
 *     `--base-bg` the CVD focus-halo anchors to.
 *
 *   - Logged IN (`user !== null`): the user's ACTIVE theme. `ThemeProvider`
 *     already sets `data-theme`/`data-mode` on `<html>` above the router
 *     (`main.tsx`), so every `var(--…)` bundle token cascades here for free.
 *     No inline token pins, no `bg-hit-man`; `color-scheme` follows the mode.
 *
 * The child components read bundle tokens via `var(--…)` in both branches –
 * the brand branch just swaps in the `branding` cascade for those tokens, so
 * one styling path serves both modes.
 */
export default function ApiDocsView() {
  useDocumentTitle('Linklater – API documentation');
  const { user } = useAuth();
  const isBrand = user === null;

  return (
    // brand branch pins branding so --focus-ring clears SC 1.4.11 on navy
    <div
      className={`min-h-screen ${isBrand ? 'bg-hit-man [color-scheme:dark]' : ''}`}
      data-theme={isBrand ? 'branding' : undefined}
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
         * Page navigation. ONE <nav> landmark so AT users land on a single
         * "API docs" region rather than scattered unlabeled landmarks. Sits
         * above the h1 in DOM order so a Tab from the skip link visits the
         * back-affordance before page identity (SC 2.4.3). Plain text (not
         * button-styled) keeps the h1 as focal point.
         *
         * The "← Linklater" back link is ALWAYS present. The "Manage tokens →"
         * link is logged-IN only (the docs are a public page; an anonymous
         * visitor has no tokens to manage), so logged-out the nav holds a
         * single link – `justify-between` leaves it at flex-start (upper-left).
         * "Manage tokens" returns to /settings via router state (NOT a
         * #fragment), because SettingsView reads `scrollTo` from
         * `location.state` to activate + scroll its sections; a plain hash
         * would scroll the browser but never wake the activation machinery.
         * The state convention matches WelcomeModal's "Go to bookmarks" link.
         */}
        <nav
          aria-label="API docs"
          className="flex items-center justify-between gap-3 text-sm"
        >
          <Link
            to="/"
            className="group flex items-center gap-2 text-[var(--base-subtle-text)] hover:text-[var(--base-text)] text-sm transition duration-200"
          >
            <i
              className="fa-solid fa-arrow-left text-[var(--base-subtle-text)] group-hover:text-[var(--base-text)] text-[0.7rem]"
              aria-hidden="true"
            />
            Linklater
          </Link>
          {!isBrand && (
            <Link
              className="group flex items-center gap-2 text-[var(--base-subtle-text)] hover:text-[var(--base-text)] text-sm transition duration-200"
              to="/settings"
              state={{ scrollTo: 'integrations' }}
            >
              Manage tokens
              <i
                className="fa-solid fa-arrow-right text-[var(--base-subtle-text)] group-hover:text-[var(--base-text)] text-[0.7rem]"
                aria-hidden="true"
              />
            </Link>
          )}
        </nav>
        <div className="flex flex-col gap-3">
          <h1
            className={
              isBrand
                ? 'bg-gradient-to-br from-[var(--base-text)] to-[var(--base-highlight)] bg-clip-text text-transparent forced-colors:bg-none forced-colors:bg-clip-border forced-colors:[-webkit-background-clip:border-box] forced-colors:text-[CanvasText] text-4xl sm:text-5xl font-bold tracking-tight text-balance'
                : 'text-[var(--base-text)] text-4xl sm:text-5xl font-bold tracking-tight text-balance'
            }
          >
            Linklater API
          </h1>
          <p className="flex items-center gap-2 max-w-2xl text-[var(--base-text)] text-base sm:text-lg text-pretty leading-relaxed">
            <MethodBadge method="POST" /> links now,
            <MethodBadge method="GET" /> them later.
          </p>
        </div>
      </header>

      <main
        className="max-w-5xl mx-auto px-4 sm:px-6 pb-16 focus:outline-none select-none"
        id="api-docs"
        tabIndex={-1}
        aria-labelledby="api-docs-heading"
      >
        <h2 className="sr-only" id="api-docs-heading">
          API documentation
        </h2>
        <ApiReference apiBaseUrl={API_BASE_URL} />
      </main>
    </div>
  );
}
