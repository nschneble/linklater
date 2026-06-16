import { ApiReferenceReact } from '@scalar/api-reference-react';
import '@scalar/api-reference-react/style.css';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useDocumentTitle } from '../../lib/hooks/useDocumentTitle';
import { useApiDocsToken } from './useApiDocsToken';
import { useScalarConfiguration } from './useScalarConfiguration';
import type { CSSProperties } from 'react';

const OPENAPI_PATH = '/openapi.json';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string | undefined;

/**
 * API documentation. Carries the landing/marketing brand chrome instead of
 * the user's current theme. Token storage is sessionStorage-scoped, masked
 * by default, and never logged or URL-encoded. The docs are always in dark
 * mode to remain visually consistent against the dark brand chrome.
 */
export default function ApiDocsView() {
  useDocumentTitle('API documentation – Linklater');
  const [token] = useApiDocsToken();

  const openapiUrl = useMemo(() => {
    if (!API_BASE_URL) return OPENAPI_PATH;
    return `${API_BASE_URL}${OPENAPI_PATH}`;
  }, []);

  const scalarConfiguration = useScalarConfiguration(openapiUrl, token);

  return (
    // Locally redeclare `--base-bg` AND `--focus-ring` so the global
    // `[data-cvd='on'] *:focus-visible` halo (defined in index.css) and its
    // inner outline both paint brand-locked colors on this page instead of
    // the user-theme tokens. Some themes set `--focus-ring` to a hue that
    // fails SC 1.4.11 vs the navy gradient (e.g. before-sunrise dark), so
    // pin it to `--color-dazed` (#eeeede, ~16:1 vs #0a0812) — the same
    // brand-ring color used by the skip-link above. The override is
    // invisible-on-purpose: it doesn't define a bundle, it just keeps the
    // CVD halo coherent with the chrome.
    <div
      className="min-h-screen bg-hit-man"
      style={
        {
          '--base-bg': '#0a0812',
          '--focus-ring': '#eeeede',
        } as CSSProperties & Record<string, string>
      }
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
            className="text-dazed hover:text-[#ff9170] hover:underline focus-visible:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dazed focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0812] focus-visible:rounded"
          >
            <span aria-hidden="true">&larr;&nbsp;</span>Linklater
          </Link>
          <Link
            to="/settings"
            state={{ scrollTo: 'integrations' }}
            className="text-dazed hover:text-[#ff9170] hover:underline focus-visible:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dazed focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0812] focus-visible:rounded"
          >
            Manage tokens<span aria-hidden="true">&nbsp;&rarr;</span>
          </Link>
        </nav>
        <div className="flex flex-col gap-3">
          <h1 className="bg-gradient-to-br from-dazed to-sunrise bg-clip-text text-transparent text-4xl sm:text-5xl font-bold tracking-tight text-balance">
            Linklater API
          </h1>
          <p className="max-w-2xl text-dazed text-base sm:text-lg text-pretty leading-relaxed">
            Learn how to save, read, and delete links from your collection.
          </p>
        </div>
      </header>

      <section
        aria-labelledby="api-docs-reference-heading"
        id="api-docs"
        className="max-w-7xl mx-auto px-4 sm:px-6 pb-16 [color-scheme:dark] select-none"
      >
        <h2 className="sr-only" id="api-docs-reference-heading">
          API documentation
        </h2>
        {/*
         * Border #7d6ec0 clears SC 1.4.11 vs the bg-hit-man radial: 4.17:1 vs
         * the gradient top (#14103a) and 4.60:1 vs the base (#0a0812). The
         * prior `border-boyhood` (#2e2855) sat at ~1.4:1 on both stops — a
         * non-perceivable edge for low-vision users. Same hex as the Scalar
         * embed's interior border (see scalarBrandCss.ts `--scalar-border-
         * color`) so the inner-and-outer edge read as one coherent frame.
         */}
        <div className="overflow-hidden border border-[#7d6ec0] rounded-2xl animate-fade-in-up">
          {/* https://scalar.com/products/api-references/integrations/react */}
          <ApiReferenceReact configuration={scalarConfiguration} />
        </div>
      </section>
    </div>
  );
}
