import termsMarkdown from '../../../../../docs/TERMS.md?raw';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Link } from 'react-router';
import { makePolicyMarkdownComponents } from '../privacy/policyMarkdownComponents';
import { rehypeBreakTags } from '../privacy/rehypeBreakTags';
import { useAuth } from '../../auth/AuthContext';
import { useDocumentTitle } from '../../lib/hooks/useDocumentTitle';

const termsMarkdownComponents = makePolicyMarkdownComponents({
  headingId: 'terms-heading',
});

/**
 * The terms and conditions. Renders a placeholder template that must be
 * legally reviewed and have its bracketed placeholders filled before it is
 * published; the draft banner states this to anyone who lands on the page.
 */
export default function TermsPage() {
  useDocumentTitle('Linklater – Terms and conditions');
  const { user } = useAuth();
  const isBrand = user === null;

  return (
    <div
      className={`min-h-screen ${isBrand ? 'bg-hit-man [color-scheme:dark]' : ''}`}
      data-theme={isBrand ? 'branding' : undefined}
    >
      <a
        href="#terms"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-white focus:text-[#14103a] focus:text-sm focus:font-semibold focus:outline-none focus:ring-2 focus:ring-white focus:rounded-lg"
      >
        Skip to terms and conditions
      </a>

      <header className="max-w-3xl mx-auto px-6 sm:px-8 pt-12 sm:pt-16 pb-2 space-y-6 select-none">
        <nav
          aria-label="Terms and conditions"
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
          Terms and conditions
        </h1>
      </header>

      <main
        className="max-w-3xl mx-auto px-6 sm:px-8 pb-16 focus:outline-none"
        id="terms"
        tabIndex={-1}
        aria-labelledby="terms-heading"
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeBreakTags]}
          components={termsMarkdownComponents}
        >
          {termsMarkdown}
        </ReactMarkdown>
      </main>
    </div>
  );
}
