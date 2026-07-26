import privacyPolicyMarkdown from '../../../../../docs/PRIVACY.md?raw';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Link } from 'react-router';
import { policyMarkdownComponents } from './policyMarkdownComponents';
import { useAuth } from '../../auth/AuthContext';
import { useDocumentTitle } from '../../lib/hooks/useDocumentTitle';

/**
 * The privacy policy, rendered from the canonical `docs/PRIVACY.md` (imported
 * raw at build time, so the repo document and this page can never drift).
 *
 * Mirrors ApiDocsView's two-way public chrome: logged OUT pins the off-book
 * `branding` theme over the brand navy; logged IN inherits the user's active
 * theme from the `<html>` token cascade. See ApiDocsView for the full
 * reasoning — including why the skip link and brand h1 carry their exact
 * class lists.
 *
 * One deliberate departure from ApiDocsView: no `select-none` on `<main>`.
 * This is a legal document; readers must be able to select and copy it.
 */
export default function PrivacyPolicyPage() {
  useDocumentTitle('Linklater – Privacy policy');
  const { user } = useAuth();
  const isBrand = user === null;

  return (
    <div
      className={`min-h-screen ${isBrand ? 'bg-hit-man [color-scheme:dark]' : ''}`}
      data-theme={isBrand ? 'branding' : undefined}
    >
      <a
        href="#privacy-policy"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-white focus:text-[#14103a] focus:text-sm focus:font-semibold focus:outline-none focus:ring-2 focus:ring-white focus:rounded-lg"
      >
        Skip to privacy policy
      </a>

      <header className="max-w-3xl mx-auto px-6 sm:px-8 pt-12 sm:pt-16 pb-2 space-y-6 select-none">
        <nav
          aria-label="Privacy policy"
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
        </nav>
        <h1
          className={
            isBrand
              ? 'bg-gradient-to-br from-[var(--base-text)] to-[var(--base-highlight)] bg-clip-text text-transparent forced-colors:bg-none forced-colors:bg-clip-border forced-colors:[-webkit-background-clip:border-box] forced-colors:text-[CanvasText] text-4xl sm:text-5xl font-bold tracking-tight text-balance'
              : 'text-[var(--base-text)] text-4xl sm:text-5xl font-bold tracking-tight text-balance'
          }
        >
          Privacy policy
        </h1>
      </header>

      <main
        className="max-w-3xl mx-auto px-6 sm:px-8 pb-16 focus:outline-none"
        id="privacy-policy"
        tabIndex={-1}
        aria-labelledby="privacy-policy-heading"
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={policyMarkdownComponents}
        >
          {privacyPolicyMarkdown}
        </ReactMarkdown>
      </main>
    </div>
  );
}
