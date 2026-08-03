import { useAuth } from '../../auth/AuthContext';
import { useDocumentTitle } from '../../lib/hooks/useDocumentTitle';
import { rehypeBreakTags } from './rehypeBreakTags';
import ReactMarkdown from 'react-markdown';
import { Link } from 'react-router';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';

/** Per-document copy and markdown mapping for the shared legal-page shell. */
interface PolicyDocumentPageProps {
  documentTitle: string;
  heading: string;
  /** skip-link target + `<main>` id (e.g. 'terms'). */
  anchorId: string;
  /** id shared by the chrome `<h1>` and `<main aria-labelledby>`. */
  headingId: string;
  markdown: string;
  /** tag → element mapping from `makePolicyMarkdownComponents`. */
  markdownComponents: Components;
  skipLinkText: string;
}

/**
 * Shared shell for the standalone legal documents (privacy policy, terms and
 * conditions). Owns the brand-or-theme chrome, skip link, back-to-home link,
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
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-[var(--base-highlight)] focus:text-[var(--base-highlight-fg)] focus:text-sm focus:font-semibold focus:outline-2 focus:outline-offset-2 focus:outline-[var(--focus-ring)] focus:rounded-lg"
      >
        {skipLinkText}
      </a>

      <header className="max-w-3xl mx-auto px-6 sm:px-8 pt-12 sm:pt-16 pb-2 space-y-6 select-none">
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
        <h1
          id={headingId}
          className="group-data-[theme='branding']/document:bg-gradient-to-br group-data-[theme='branding']/document:from-[var(--base-text)] group-data-[theme='branding']/document:to-[var(--base-highlight)] group-data-[theme='branding']/document:bg-clip-text group-data-[theme='branding']/document:forced-colors:bg-none group-data-[theme='branding']/document:forced-colors:bg-clip-border group-data-[theme='branding']/document:forced-colors:[-webkit-background-clip:border-box] text-[var(--base-text)] group-data-[theme='branding']/document:text-transparent group-data-[theme='branding']/document:forced-colors:text-[CanvasText] text-4xl sm:text-5xl font-bold tracking-tight text-balance"
        >
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
