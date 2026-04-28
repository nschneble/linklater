import type { Link } from '../lib/api';

interface LinkCardLayoutProps {
  link: Link;
  animationDelay?: number;
  onCardClick: () => void;
  onUnarchiveClick: (event: React.MouseEvent) => void;
}

function getPlaceholderUrl(link) {
  const style = getComputedStyle(document.documentElement);
  const accent = style.getPropertyValue('--accent').trim().replace('#', '');
  const accentFg = style
    .getPropertyValue('--accent-fg')
    .trim()
    .replace('#', '');
  const text = new URL(link.url).hostname.replace(/^www\./, '');
  return `https://placehold.co/284x160/${accent}/${accentFg}?text=${text}`;
}

export default function LinkCardLayout({
  link,
  animationDelay = 0,
  onCardClick,
  onUnarchiveClick,
}: LinkCardLayoutProps) {
  const hasTitle = Boolean(link.meta?.title);
  const displayTitle = link.meta?.title ?? '(No title)';
  const displayDescription = hasTitle ? link.meta?.description : link.url;
  const rawSiteName = link.meta?.siteName ?? new URL(link.url).hostname;
  const displaySiteName = rawSiteName.replace(/^www\./, '');

  return (
    <article
      onClick={onCardClick}
      style={{ animationDelay: `${animationDelay}ms` }}
      className="relative border-l-4 border-[var(--accent)] rounded-r-xl bg-[var(--bg-surface)] cursor-pointer pl-10 pr-8 py-4 animate-fade-in-up overflow-visible hover:-translate-y-0.5 hover:shadow-lg transition-[transform,box-shadow] duration-150 ease-out"
    >
      {/* Favicon — straddles left border */}
      <div className="absolute left-0 top-4 -translate-x-1/2 z-10">
        {!link.meta?.fetchedAt && (
          <span
            title="Fetching info…"
            className="block w-5 h-5 rounded-full bg-[var(--accent)] ring-2 ring-[var(--bg-surface)] animate-pulse"
          />
        )}

        {link.meta?.fetchedAt && (
          <span className="relative w-8 h-8 rounded-full overflow-hidden flex items-center justify-center bg-white">
            {link.meta?.faviconUrl ? (
              <img
                src={link.meta.faviconUrl}
                className="w-8 h-8 rounded-full object-cover"
                aria-hidden="true"
                onError={(event) => {
                  (event.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <i
                className="fa-regular fa-bookmark text-[var(--text-muted)] text-xs"
                aria-hidden="true"
              />
            )}
          </span>
        )}
      </div>

      {/* Card content */}
      <div className="space-y-1">
        <p className="text-[var(--text-subtle)] text-xs truncate">
          {displaySiteName}
        </p>

        <p className="text-[var(--text)] text-sm font-semibold line-clamp-2 [text-wrap:balance]">
          {displayTitle}
        </p>

        {displayDescription && (
          <div className="leading-6 h-12 overflow-hidden">
            <p className="text-[var(--text-muted)] text-xs line-clamp-2">
              {displayDescription}
            </p>
          </div>
        )}

        {link.meta?.fetchedAt && (
          <img
            src={link.meta.imageUrl ?? getPlaceholderUrl(link)}
            alt=""
            aria-hidden="true"
            className="w-full max-h-40 object-cover rounded-md mt-0 mb-4 outline outline-1 outline-black/10 -outline-offset-1"
            onError={(event) => {
              (event.target as HTMLImageElement).src = getPlaceholderUrl(link);
            }}
          />
        )}

        {link.archivedAt && (
          <div className="flex justify-end pt-1">
            <button
              onClick={onUnarchiveClick}
              className="text-[var(--text-muted)] text-xs hover:text-[var(--accent)] transition-colors"
            >
              Mark as unread
            </button>
          </div>
        )}
      </div>
    </article>
  );
}
