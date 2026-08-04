import ApiReference from './ApiReference';
import MethodBadge from './MethodBadge';
import { Link } from 'react-router';
import { useAuth } from '../../auth/AuthContext';
import { useDocumentTitle } from '../../lib/hooks/useDocumentTitle';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string | undefined;

/**
 * API documentation. A single token-driven component tree that paints two
 * ways depending on auth, off one attribute:
 *
 *   - Logged OUT (`user === null`): the landing/marketing BRAND chrome. The
 *     wrapper sets `data-theme='branding'` (branding.css), which both activates
 *     the off-book `branding` theme so the token-driven tree resolves to the
 *     brand palette AND drives the `data-[theme='branding']:` variants that pin
 *     the navy `bg-hit-man` surface and force dark `color-scheme`. The
 *     wrapper's `data-theme` shadows `<html data-theme>` for its subtree, and
 *     the branding cascade supplies every bundle slot plus `--focus-ring` and
 *     the `--base-bg` the CVD focus-halo anchors to.
 *
 *   - Logged IN (`user !== null`): the user's ACTIVE theme. `ThemeProvider`
 *     already sets `data-theme`/`data-mode` on `<html>` above the router
 *     (`main.tsx`), so every `var(--…)` bundle token cascades here for free.
 *     Without the branding attribute the gated brand variants stay inactive, so
 *     nothing pins `bg-hit-man` and `color-scheme` follows the mode.
 *
 * The chrome (wrapper surface, gradient title) is now data-attribute-driven the
 * same way as the legal `PolicyDocumentPage` shell: the class strings are
 * auth-invariant and the lone `data-theme` ternary decides whether the brand
 * paint activates. The child components read bundle tokens via `var(--…)` in
 * both branches; the brand branch just swaps in the `branding` cascade for
 * those tokens, so one styling path serves both modes.
 */
export default function ApiDocsView() {
  useDocumentTitle('Linklater – API documentation');
  const { user } = useAuth();
  const isBrand = user === null;

  return (
    // brand branch pins branding so --focus-ring clears SC 1.4.11 on navy
    <div
      className="group/document min-h-screen data-[theme='branding']:bg-hit-man data-[theme='branding']:[color-scheme:dark]"
      data-theme={isBrand ? 'branding' : undefined}
    >
      <a
        href="#api-docs"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-[var(--base-highlight)] focus:text-[var(--base-highlight-fg)] focus:text-sm focus:font-semibold focus:outline-2 focus:outline-offset-2 focus:outline-[var(--focus-ring)] focus:rounded-lg"
      >
        Skip to API documentation
      </a>

      <header className="max-w-6xl mx-auto px-6 sm:px-8 pt-12 sm:pt-16 pb-8 sm:pb-10 space-y-6 select-none">
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
          <h1 className="group-data-[theme='branding']/document:bg-gradient-to-br group-data-[theme='branding']/document:from-[var(--base-text)] group-data-[theme='branding']/document:to-[var(--base-highlight)] group-data-[theme='branding']/document:bg-clip-text group-data-[theme='branding']/document:forced-colors:bg-none group-data-[theme='branding']/document:forced-colors:bg-clip-border group-data-[theme='branding']/document:forced-colors:[-webkit-background-clip:border-box] text-[var(--base-text)] group-data-[theme='branding']/document:text-transparent group-data-[theme='branding']/document:forced-colors:text-[CanvasText] text-4xl sm:text-5xl font-bold tracking-tight text-balance">
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
