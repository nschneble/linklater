import BrandTokenInput from './BrandTokenInput';
import { useApiDocsToken } from './useApiDocsToken';
import { useDocumentTitle } from '../../lib/hooks/useDocumentTitle';
import { ApiReferenceReact } from '@scalar/api-reference-react';
import '@scalar/api-reference-react/style.css';
import { useMemo } from 'react';

const OPENAPI_PATH = '/openapi.json';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string | undefined;

/**
 * Style overrides concatenated into Scalar's `customCss` so the rules live
 * inside its style scope.
 *
 * REDUCED_MOTION_CSS — collapses every animation/transition inside the embed
 * under `prefers-reduced-motion: reduce`.
 *
 * HIDE_SPEC_TITLE_CSS — hides Scalar's own h1 (the spec's `info.title`), so
 * the brand page banner is the sole visible H1. The selector is the h1
 * rendered by Scalar's `IntroductionLayout` component, which wraps
 * `info.title` in `<SectionHeaderTag level="1">`. That emits
 * `<h1 class="section-header-label">` inside an ancestor with the
 * `.introduction-section` class (verified in `@scalar/api-reference@0.9.46`
 * dist sources). Only the introduction h1 is hidden; operation/section
 * headings (h2, h3, …) elsewhere in the embed remain visible.
 */
const REDUCED_MOTION_CSS = `
@media (prefers-reduced-motion: reduce) {
  .scalar-app *,
  .scalar-app *::before,
  .scalar-app *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
`;

const HIDE_SPEC_TITLE_CSS = `
.scalar-app .introduction-section h1.section-header-label {
  display: none;
}
`;

/**
 * Standalone page at `/settings/api`. Carries the landing/marketing brand
 * chrome (`bg-hit-man` gradient, brand palette) instead of the user's
 * theme bundles — the API docs are a brand surface, not an app surface.
 *
 * Renders a single visible H1 (brand-gradient typography), a lede paragraph,
 * a `BrandTokenInput` for live PAT auth, and the `<ApiReferenceReact>`
 * embed at full width with reasonable gutters.
 *
 * Token storage is sessionStorage-scoped, masked by default, never logged
 * or URL-encoded. The embed is forced into Scalar's dark mode regardless of
 * the user's theme so it always reads against the dark brand chrome.
 */
export default function ApiDocsView() {
  useDocumentTitle('API documentation – Linklater');
  const [token, setToken] = useApiDocsToken();

  const openapiUrl = useMemo(() => {
    if (!API_BASE_URL) return OPENAPI_PATH;
    return `${API_BASE_URL}${OPENAPI_PATH}`;
  }, []);

  // Memoize the configuration so Scalar does not re-mount on unrelated renders
  // (e.g. a parent component re-rendering without changing openapiUrl or
  // token). A new object is returned — and Scalar sees a changed prop —
  // whenever openapiUrl or token changes (including each keystroke in
  // BrandTokenInput).
  const scalarConfiguration = useMemo(
    () => ({
      url: openapiUrl,
      layout: 'modern' as const,
      hideDarkModeToggle: true,
      // Force dark unconditionally: the brand chrome is dark regardless of
      // the user's theme.
      darkMode: true,
      hideModels: false,
      customCss: REDUCED_MOTION_CSS + HIDE_SPEC_TITLE_CSS,
      authentication: {
        preferredSecurityScheme: 'pat',
        securitySchemes: {
          pat: {
            type: 'http' as const,
            scheme: 'bearer' as const,
            token,
          },
        },
      },
    }),
    [openapiUrl, token],
  );

  return (
    // Locally redeclare `--base-bg` so the global `[data-cvd='on']
    // *:focus-visible` halo (defined in index.css) paints near-gradient color
    // on this brand-chrome page instead of the user-theme base bg. The
    // override is invisible-on-purpose — it doesn't define a bundle, it
    // just keeps the CVD halo from clashing with the navy gradient.
    <div
      className="min-h-screen bg-hit-man"
      style={{ ['--base-bg' as string]: '#0a0812' }}
    >
      {/*
       * Skip link mirrors the LandingPage pattern: brand-locked white-on-navy
       * (clears ~16:1 vs the gradient) rather than user-theme `--focus-ring`,
       * which is not safe on the fixed brand gradient.
       */}
      <a
        href="#api-reference"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-white focus:text-[#14103a] focus:text-sm focus:font-semibold focus:outline-none focus:ring-2 focus:ring-white focus:rounded-lg"
      >
        Skip to API reference
      </a>

      <header className="max-w-6xl mx-auto px-6 sm:px-8 pt-12 sm:pt-16 pb-8 sm:pb-10 space-y-6">
        <div className="flex flex-col gap-3">
          <h1 className="bg-gradient-to-br from-dazed to-sunrise bg-clip-text text-4xl sm:text-5xl text-transparent font-bold tracking-tight text-balance">
            Linklater API
          </h1>
          <p className="max-w-2xl text-dazed text-base sm:text-lg text-pretty leading-relaxed">
            Personal access tokens unlock the link-management endpoints below.
            Paste a token to try requests live against your own account.
          </p>
        </div>

        <section aria-labelledby="api-docs-auth-heading" className="space-y-3">
          <h2
            className="text-dazed text-sm font-semibold uppercase tracking-wider"
            id="api-docs-auth-heading"
          >
            Authenticate
          </h2>
          <BrandTokenInput value={token} onChange={setToken} />
        </section>
      </header>

      <a
        className="sr-only focus:not-sr-only focus:inline-flex focus:mx-auto focus:px-3 focus:py-1.5 focus:bg-white focus:text-[#14103a] focus:text-xs focus:font-semibold focus:rounded-full focus:ring-2 focus:ring-white"
        href="#after-api-reference"
      >
        Skip past the API reference
      </a>

      <section
        aria-labelledby="api-docs-reference-heading"
        id="api-reference"
        className="max-w-7xl mx-auto px-4 sm:px-6 pb-16 [color-scheme:dark]"
      >
        <h2 className="sr-only" id="api-docs-reference-heading">
          API reference
        </h2>
        {/*
         * Visual seam between the gradient chrome and the Scalar embed.
         * `bg-midnight/40` + `border-boyhood` reads as a distinct surface
         * without competing with the gradient framing. The border is
         * decorative (not a SC 1.4.11 UI affordance), so `border-boyhood`
         * is fine here even though it would fail UI-border contrast math.
         */}
        <div className="border border-boyhood bg-midnight/40 overflow-hidden rounded-2xl">
          <ApiReferenceReact configuration={scalarConfiguration} />
        </div>
      </section>

      <div
        aria-label="End of API reference"
        id="after-api-reference"
        tabIndex={-1}
      />
    </div>
  );
}
