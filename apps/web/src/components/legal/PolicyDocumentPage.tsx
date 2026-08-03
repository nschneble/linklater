import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Link } from 'react-router';
import { rehypeBreakTags } from './rehypeBreakTags';
import { useAuth } from '../../auth/AuthContext';
import { useDocumentTitle } from '../../lib/hooks/useDocumentTitle';
import type { Components } from 'react-markdown';

interface PolicyDocumentPageProps {
  /** browser tab title, e.g. 'Linklater – Terms and conditions'. */
  documentTitle: string;
  /** visible <h1> chrome heading. */
  heading: string;
  /** skip-link target + <main> id, e.g. 'terms'. */
  anchorId: string;
  /** id pairing the demoted markdown title with <main aria-labelledby>. */
  headingId: string;
  /** raw markdown source rendered inside <main>. */
  markdown: string;
  /** tag → element mapping from makePolicyMarkdownComponents. */
  markdownComponents: Components;
  /** accessible name for the back-to-home <nav>. */
  navLabel: string;
  /** visible skip-link text. */
  skipLinkText: string;
}

/**
 * Shared shell for the standalone legal documents (privacy policy, terms and
 * conditions). Owns the brand-or-theme chrome, skip link, back-to-home nav,
 * gradient page title, and the <main> markdown surface; each page supplies
 * only its per-document copy and markdown mapping.
 *
 * Logged out, the wrapper activates the off-book `branding` theme via
 * `data-theme='branding'` and lets the matching `data-[theme='branding']:`
 * variants pin the navy `bg-hit-man` surface and the gradient title; logged
 * in, the attribute is absent so the page inherits the user's active theme.
 */
export default function PolicyDocumentPage({
  documentTitle,
  heading,
  anchorId,
  headingId,
  markdown,
  markdownComponents,
  navLabel,
  skipLinkText,
}: PolicyDocumentPageProps) {
  useDocumentTitle(documentTitle);
  const { user } = useAuth();
  const isBrand = user === null;

  return (
    <div
      className="group/document min-h-screen data-[theme='branding']:bg-hit-man data-[theme='branding']:[color-scheme:dark]"
      data-theme={isBrand ? 'branding' : undefined}
    >
      <a
        href={`#${anchorId}`}
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-white focus:text-[#14103a] focus:text-sm focus:font-semibold focus:outline-none focus:ring-2 focus:ring-white focus:rounded-lg"
      >
        {skipLinkText}
      </a>

      <header className="max-w-3xl mx-auto px-6 sm:px-8 pt-12 sm:pt-16 pb-2 space-y-6 select-none">
        <nav
          aria-label={navLabel}
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
        <h1 className="group-data-[theme='branding']/document:bg-gradient-to-br group-data-[theme='branding']/document:from-[var(--base-text)] group-data-[theme='branding']/document:to-[var(--base-highlight)] group-data-[theme='branding']/document:bg-clip-text text-[var(--base-text)] group-data-[theme='branding']/document:text-transparent group-data-[theme='branding']/document:forced-colors:bg-none group-data-[theme='branding']/document:forced-colors:bg-clip-border group-data-[theme='branding']/document:forced-colors:[-webkit-background-clip:border-box] group-data-[theme='branding']/document:forced-colors:text-[CanvasText] text-4xl sm:text-5xl font-bold tracking-tight text-balance">
          {heading}
        </h1>
      </header>

      <main
        className="max-w-3xl mx-auto px-6 sm:px-8 pb-16 focus:outline-none"
        id={anchorId}
        tabIndex={-1}
        aria-labelledby={headingId}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeBreakTags]}
          components={markdownComponents}
        >
          {markdown}
        </ReactMarkdown>
      </main>
    </div>
  );
}
