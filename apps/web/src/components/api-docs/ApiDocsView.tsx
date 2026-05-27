import TokenInput from './TokenInput';
import { ApiReferenceReact } from '@scalar/api-reference-react';
import { Link } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { useTheme } from '../../theme/ThemeContext';

const TOKEN_SESSION_KEY = 'linklater.api-docs.pat';
const OPENAPI_PATH = '/openapi.json';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string | undefined;

/**
 * Reads the cached token from sessionStorage. Returns an empty string when
 * no token is cached or when sessionStorage access fails (Safari private
 * browsing throws on read). Intentionally silent — never emits a live-region
 * announcement on hydration.
 */
function readCachedToken(): string {
  if (typeof window === 'undefined') return '';
  try {
    return window.sessionStorage.getItem(TOKEN_SESSION_KEY) ?? '';
  } catch {
    return '';
  }
}

/**
 * Writes (or clears) the cached token in sessionStorage. Failures are
 * swallowed — the docs page still works without persistence.
 */
function writeCachedToken(value: string) {
  if (typeof window === 'undefined') return;
  try {
    if (value.length === 0) {
      window.sessionStorage.removeItem(TOKEN_SESSION_KEY);
    } else {
      window.sessionStorage.setItem(TOKEN_SESSION_KEY, value);
    }
  } catch {
    // sessionStorage unavailable — fall through silently.
  }
}

/**
 * Reduces Scalar's animations to a near-instant transition under
 * `prefers-reduced-motion: reduce`. Concatenated into the `customCss` config
 * so the rule lives inside Scalar's style scope and overrides its defaults.
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

/**
 * The /settings/api page. Renders a labeled token-paste field on top of a
 * Scalar API Reference component pointed at the backend's /openapi.json.
 *
 * Token storage is sessionStorage-scoped, masked by default, never logged
 * or URL-encoded. Dark mode follows the global Linklater theme (no FOUC).
 */
export default function ApiDocsView() {
  const { mode } = useTheme();
  const [token, setToken] = useState<string>(() => readCachedToken());

  useEffect(() => {
    writeCachedToken(token);
  }, [token]);

  const openapiUrl = useMemo(() => {
    if (!API_BASE_URL) return OPENAPI_PATH;
    return `${API_BASE_URL}${OPENAPI_PATH}`;
  }, []);

  // Memoize the configuration so Scalar does not re-mount when the token
  // changes — the same object reference is mutated in place via the
  // `securitySchemes.pat.token` slot below by recreating only when the
  // token actually changes. Re-creating on every render would tear down
  // the entire Scalar tree on each keystroke.
  const scalarConfiguration = useMemo(
    () => ({
      url: openapiUrl,
      layout: 'modern' as const,
      hideDarkModeToggle: true,
      darkMode: mode === 'dark',
      hideModels: false,
      customCss: REDUCED_MOTION_CSS,
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
    [mode, openapiUrl, token],
  );

  return (
    <div className="space-y-8">
      {/*
       * Scalar renders the spec's `info.title` ("Linklater API") as its own
       * H1 inside its embed. To avoid two H1s on the same page, our visible
       * page label is a styled paragraph and the page-level H1 is sr-only.
       * Screen readers still hear "API documentation" first, then Scalar's
       * "Linklater API" as a second heading at H2 level inside the embed.
       */}
      <div className="flex flex-col gap-2">
        <Link
          to="/settings"
          className="inline-flex items-center gap-1.5 self-start text-[var(--text-muted)] hover:text-[var(--accent)] text-xs underline underline-offset-3"
        >
          <i
            aria-hidden="true"
            className="fa-solid fa-arrow-left text-[0.7rem]"
          />
          Back to Settings
        </Link>
        <h1 className="sr-only">API documentation</h1>
        <p
          aria-hidden="true"
          className="text-[var(--text)] text-2xl font-semibold text-balance"
        >
          API documentation
        </p>
        <p className="text-[var(--text-muted)] text-sm max-w-2xl">
          Personal access tokens unlock the link-management endpoints below.
          Paste a token to try requests live against your own account.
        </p>
      </div>

      <section aria-labelledby="api-docs-auth-heading" className="space-y-3">
        <h2
          className="text-[var(--text)] text-base font-semibold"
          id="api-docs-auth-heading"
        >
          Authenticate
        </h2>
        <TokenInput value={token} onChange={setToken} />
      </section>

      <a
        className="sr-only focus:not-sr-only focus:inline-flex focus:px-3 focus:py-1.5 focus:bg-[var(--bg-surface)] focus:text-[var(--text)] focus:text-xs focus:rounded-full focus:ring-2 focus:ring-[var(--accent)]"
        href="#after-api-reference"
      >
        Skip past the API reference
      </a>

      <section
        aria-labelledby="api-docs-reference-heading"
        className="-mx-4 sm:-mx-0 [color-scheme:light] [[data-mode='dark']_&]:[color-scheme:dark]"
      >
        <h2 className="sr-only" id="api-docs-reference-heading">
          API reference
        </h2>
        <ApiReferenceReact configuration={scalarConfiguration} />
      </section>

      <div id="after-api-reference" tabIndex={-1} />
    </div>
  );
}
