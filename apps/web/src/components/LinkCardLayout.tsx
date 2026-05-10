import { useEffect, useMemo, useRef } from 'react';
import type { Link } from '../lib/api';

/**
 * Pure presentation props for `LinkCardLayout`. Interaction callbacks are
 * owned by `LinkCard` so they are not duplicated here.
 */
interface LinkCardLayoutProps {
  /** The link to render. */
  link: Link;
  /**
   * Base delay for the card-enter animation in milliseconds.
   *
   * @default 0
   */
  animationDelay?: number;
  /** When `true`, the card shows a keyboard-selection highlight. */
  isSelected?: boolean;
  /** Called when the card body is clicked. */
  onCardClick: () => void;
  /**
   * Called when the "Mark as unread" button is clicked. Must call
   * `event.stopPropagation()` (handled in `LinkCard`) to prevent the card
   * click from also firing.
   */
  onUnarchiveClick: (event: React.MouseEvent) => void;
}

const CARD_ENTER_CLASS = 'animate-card-enter';

/**
 * Generates a placeholder image URL using placehold.co, colored to match the
 * current theme's accent and accent-fg CSS variables. Falls back gracefully
 * if CSS variables are not defined.
 */
function getPlaceholderUrl(url: string) {
  const style = getComputedStyle(document.documentElement);
  const accent = style.getPropertyValue('--accent').trim().replace('#', '');
  const accentFg = style
    .getPropertyValue('--accent-fg')
    .trim()
    .replace('#', '');
  const text = new URL(url).hostname.replace(/^www\./, '');
  return `https://placehold.co/284x160/${accent}/${accentFg}?text=${text}`;
}

/**
 * Pure visual structure of a link card. Handles all rendering decisions:
 * - Shows a pulsing indicator while metadata is still being fetched (`!meta.fetchedAt`).
 * - Shows the favicon once metadata arrives.
 * - Shows a placeholder image if no `imageUrl` is available.
 * - Shows the raw URL as the description when no title is present.
 * - Shows a "Mark as unread" button for archived links.
 *
 * The card uses `role="link"` and responds to Enter/Space so keyboard users
 * can activate it without a pointer device.
 */
export default function LinkCardLayout({
  link,
  animationDelay = 0,
  isSelected = false,
  onCardClick,
  onUnarchiveClick,
}: LinkCardLayoutProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const placeholderUrl = useMemo(() => getPlaceholderUrl(link.url), [link.url]);

  useEffect(() => {
    if (isSelected) {
      cardRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [isSelected]);

  function childStyle(elementIndex: number) {
    return {
      animationDelay: `${animationDelay + elementIndex * 60}ms`,
    };
  }

  const hasTitle = Boolean(link.meta?.title);
  const displayTitle = link.meta?.title ?? '(No title)';
  const displayDescription = hasTitle ? link.meta?.description : link.url;
  const rawSiteName = link.meta?.siteName ?? new URL(link.url).hostname;
  const displaySiteName = rawSiteName.replace(/^www\./, '');

  const cardAriaLabel = `${displayTitle} — ${displaySiteName}`;

  return (
    <div
      ref={cardRef}
      role="link"
      aria-label={cardAriaLabel}
      onClick={onCardClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onCardClick();
      }}
      tabIndex={0}
      className={`relative overflow-visible pl-10 pr-8 py-4 bg-[var(--bg-surface)] border-l-4 ${link.meta?.fetchedAt ? 'border-[var(--accent)] border-shadow hover:border-shadow' : 'border-transparent'} rounded-r-xl ${isSelected ? 'ring-2 ring-[var(--accent)]/60' : ''} focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none cursor-pointer`}
    >
      {link.meta?.fetchedAt ? (
        <div className="absolute left-0 top-4 -translate-x-1/2 z-10">
          <span className="relative flex items-center justify-center">
            {link.meta?.faviconUrl ? (
              <img
                src={link.meta.faviconUrl}
                alt=""
                className="w-8 h-8 bg-white outline outline-black/10 -outline-offset-1 rounded-4xl object-cover"
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
        </div>
      ) : (
        <div className="absolute inset-0 pointer-events-none animate-pulse">
          <div className="absolute top-0 bottom-0 left-0 -translate-x-full w-1 bg-[var(--accent)]" />
          <span
            aria-label="Fetching info…"
            className="absolute left-0 top-4 -translate-x-1/2 z-10 block w-8 h-8 bg-[var(--accent)] ring-2 ring-[var(--bg-surface)] rounded-2xl"
          />
        </div>
      )}

      <div className="space-y-1">
        <div className="flex flex-row items-center">
          {link.meta?.fetchedAt && (
            <img
              src={link.meta.imageUrl ?? placeholderUrl}
              alt=""
              aria-hidden="true"
              style={childStyle(3)}
              className={`w-[60px] sm:w-[120px] h-[32px] sm:h-[63px] object-cover rounded-md outline outline-1 outline-black/10 -outline-offset-1 ${CARD_ENTER_CLASS}`}
              onError={(event) => {
                (event.target as HTMLImageElement).src = placeholderUrl;
              }}
            />
          )}

          <div className="flex flex-col items-start min-w-0 ml-3">
            <p
              style={childStyle(1)}
              className={`text-[var(--text)] text-sm font-semibold line-clamp-2 [text-wrap:balance] ${CARD_ENTER_CLASS}`}
            >
              {displayTitle}
            </p>

            <p
              style={childStyle(0)}
              className={`w-full text-[var(--text-subtle)] text-xs truncate ${CARD_ENTER_CLASS}`}
            >
              {displaySiteName}
            </p>
          </div>
        </div>

        {displayDescription && (
          <div
            style={childStyle(2)}
            className={`overflow-hidden h-8 mt-2 leading-4 ${CARD_ENTER_CLASS}`}
          >
            <p className="text-[var(--text-muted)] text-xs text-pretty line-clamp-2">
              {displayDescription}
            </p>
          </div>
        )}

        {link.readAt && (
          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={onUnarchiveClick}
              className="py-1.5 px-2 -mx-2 -my-1.5 text-[var(--text-muted)] hover:text-[var(--accent)] text-xs transition-colors active:scale-[0.96] cursor-pointer"
            >
              Mark as unread
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
