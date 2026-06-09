import { useTheme } from '../../theme/ThemeContext';
import LinkButton from '../common/LinkButton';
import TokenInput from './TokenInput';
import { useApiDocsToken } from './useApiDocsToken';
import { ApiReferenceReact } from '@scalar/api-reference-react';
import '@scalar/api-reference-react/style.css';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

const OPENAPI_PATH = '/openapi.json';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string | undefined;

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
  const [token, setToken] = useApiDocsToken();
  const navigate = useNavigate();

  const openapiUrl = useMemo(() => {
    if (!API_BASE_URL) return OPENAPI_PATH;
    return `${API_BASE_URL}${OPENAPI_PATH}`;
  }, []);

  // Memoize the configuration so Scalar does not re-mount on unrelated renders
  // (e.g. a parent component re-rendering without changing mode or token).
  // A new object is returned — and Scalar sees a changed prop — whenever
  // mode, openapiUrl, or token changes (including each keystroke in TokenInput).
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
        <LinkButton
          className="self-start"
          onClick={() => navigate('/settings')}
        >
          Back to Settings
        </LinkButton>
        <h1 className="sr-only">API documentation</h1>
        <p
          aria-hidden="true"
          className="text-[var(--base-text)] text-2xl font-semibold text-balance"
        >
          API documentation
        </p>
        <p className="text-[var(--base-alt-text)] text-sm text-pretty">
          Personal access tokens unlock the link-management endpoints below.
          Paste a token to try requests live against your own account.
        </p>
      </div>

      <section aria-labelledby="api-docs-auth-heading" className="space-y-3">
        <h2
          className="text-[var(--base-text)] text-base font-semibold"
          id="api-docs-auth-heading"
        >
          Authenticate
        </h2>
        <TokenInput value={token} onChange={setToken} />
      </section>

      <a
        className="sr-only focus:not-sr-only focus:inline-flex focus:px-3 focus:py-1.5 focus:bg-[var(--mount-bg)] focus:text-[var(--mount-text)] focus:text-xs focus:rounded-full focus:ring-2 focus:ring-[var(--focus-ring)]"
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

      <div
        aria-label="End of API reference"
        id="after-api-reference"
        tabIndex={-1}
      />
    </div>
  );
}
