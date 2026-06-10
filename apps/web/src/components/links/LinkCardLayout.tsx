import { useEffect, useMemo, useRef } from 'react';
import PrimaryButton from '../common/PrimaryButton';
import type { Link } from '../../lib/api';
import { hostnameOf, stripHtml } from '../../lib/strings';
import { FOCUS_RING } from '../../lib/styles';
import { useTheme } from '../../theme/ThemeContext';

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
  /**
   * Called when the card anchor is activated (mouse click, Enter, Cmd-click).
   * Native anchor activation handles opening the URL — this callback exists
   * so callers can run side effects like marking the link read.
   */
  onCardActivate: (event: React.MouseEvent) => void;
  /**
   * Called when the "Mark as unread" button is clicked. The button is a
   * sibling of the anchor overlay, so its click does not propagate to the
   * card-open behavior — no `stopPropagation()` needed.
   */
  onUnreadClick: (event: React.MouseEvent) => void;
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
  return `https://placehold.co/240x126/${accent}/${accentFg}?text=${hostnameOf(url)}`;
}

/**
 * Pure visual structure of a link card. Handles all rendering decisions:
 * - Shows a pulsing indicator while metadata is still being fetched (`!meta.fetchedAt`).
 * - Shows the favicon once metadata arrives.
 * - Shows a placeholder image if no `imageUrl` is available.
 * - Shows the raw URL as the description when no title is present.
 * - Shows a "Mark as unread" button for read links.
 *
 * The card is interactive via a native `<a>` overlay that covers the entire
 * card surface. The "Mark as unread" button sits at a higher z-index so its
 * clicks do not reach the anchor. Native anchor semantics give middle-click,
 * Cmd-click, Enter/Space activation, and "Open in new tab" context-menu
 * support for free.
 */
export default function LinkCardLayout({
  link,
  animationDelay = 0,
  isSelected = false,
  onCardActivate,
  onUnreadClick,
}: LinkCardLayoutProps) {
  const cardReference = useRef<HTMLDivElement>(null);
  // included so the placeholder regenerates when the theme changes
  const { baseTheme } = useTheme();
  const placeholderUrl = useMemo(
    () => getPlaceholderUrl(link.url),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [link.url, baseTheme],
  );

  useEffect(() => {
    if (isSelected) {
      cardReference.current?.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    }
  }, [isSelected]);

  function childStyle(elementIndex: number) {
    return {
      animationDelay: `${animationDelay + elementIndex * 60}ms`,
    };
  }

  const hasTitle = Boolean(link.meta?.title);
  const displayTitle = link.meta?.title ?? '(No title)';
  const rawDescription = hasTitle ? link.meta?.description : link.url;
  const displayDescription = rawDescription
    ? stripHtml(rawDescription)
    : rawDescription;
  const displaySiteName = useMemo(
    () =>
      link.meta?.siteName
        ? link.meta.siteName.replace(/^www\./, '')
        : hostnameOf(link.url),
    [link.meta?.siteName, link.url],
  );

  const cardAriaLabel = `${displayTitle} — ${displaySiteName}, opens in new tab`;

  return (
    <div
      ref={cardReference}
      aria-busy={!link.meta?.fetchedAt || undefined}
      className={`relative overflow-visible pl-10 pr-8 py-4 bg-[var(--mount-bg)] border-l-4 ${link.meta?.fetchedAt ? 'border-[var(--accent)] border-shadow hover:border-shadow' : 'border-dashed border-[var(--mount-border)]'} rounded-r-xl ${isSelected ? 'ring-2 ring-[var(--accent)]/60' : ''}`}
    >
      {link.meta?.fetchedAt ? (
        <div className="absolute left-0 top-4 -translate-x-1/2 z-20 pointer-events-none">
          <span className="relative flex items-center justify-center">
            {link.meta?.faviconUrl ? (
              <img
                src={link.meta.faviconUrl}
                alt=""
                className="themed-asset w-8 h-8 bg-white outline outline-black/10 -outline-offset-1 rounded-4xl object-cover"
                aria-hidden="true"
                onError={(event) => {
                  (event.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <div
                className="flex items-center justify-center w-8 h-8 bg-white outline outline-black/10 -outline-offset-1 rounded-4xl"
                aria-hidden="true"
              >
                <i
                  className="fa-solid fa-bookmark text-[var(--accent)] text-lg"
                  aria-hidden="true"
                />
              </div>
            )}
          </span>
        </div>
      ) : (
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none animate-pulse z-20"
        >
          <div className="absolute top-0 bottom-0 left-0 -translate-x-full w-1 bg-[var(--accent)]" />
          <span className="absolute left-0 top-4 -translate-x-1/2 z-10 block w-8 h-8 bg-[var(--accent)] ring-2 ring-[var(--mount-bg)] rounded-2xl" />
        </div>
      )}

      <div className="space-y-1">
        <div className="flex flex-row items-center">
          {link.meta?.fetchedAt ? (
            <img
              src={link.meta.imageUrl ?? placeholderUrl}
              alt=""
              aria-hidden="true"
              style={childStyle(3)}
              className={`themed-asset w-[60px] sm:w-[120px] h-[32px] sm:h-[63px] shrink-0 bg-white object-cover rounded-md outline outline-1 outline-black/10 -outline-offset-1 ${CARD_ENTER_CLASS}`}
              onError={(event) => {
                (event.target as HTMLImageElement).src = placeholderUrl;
              }}
            />
          ) : (
            <div
              aria-hidden="true"
              className="w-[60px] sm:w-[120px] h-[31.5px] sm:h-[63px] shrink-0 rounded-md bg-[var(--orbit-bg)]"
            />
          )}

          <div className="flex flex-col items-start min-w-0 ml-3">
            <p
              style={childStyle(1)}
              className={`text-[var(--mount-text)] text-sm text-balance font-semibold tracking-tight sm:tracking-normal line-clamp-1 ${CARD_ENTER_CLASS}`}
            >
              {displayTitle}
            </p>

            {/* --*-subtle-text is BASE-only by design; mount hints collapse to alt-text */}
            <p
              style={childStyle(0)}
              className={`w-full text-[var(--mount-alt-text)] text-xs truncate ${CARD_ENTER_CLASS}`}
            >
              {displaySiteName}
            </p>
          </div>
        </div>

        {(displayDescription || link.readAt) && (
          <div
            style={childStyle(2)}
            className={`relative flex items-start gap-3 overflow-hidden h-8 mt-2 leading-4 ${CARD_ENTER_CLASS} z-20 pointer-events-none`}
          >
            {displayDescription && (
              <p className="flex-1 min-w-0 text-[var(--mount-alt-text)] text-xs text-pretty tracking-tight sm:tracking-normal line-clamp-2">
                {displayDescription}
              </p>
            )}

            {link.readAt && (
              <PrimaryButton
                className="relative shrink-0 z-30 pointer-events-auto"
                onClick={onUnreadClick}
                aria-label="Mark unread"
              >
                <span className="hidden sm:inline-flex">Mark unread</span>
                <span className="inline-flex sm:hidden">
                  <i
                    className="fa-solid fa-rotate-left text-xs"
                    aria-hidden="true"
                  />
                </span>
              </PrimaryButton>
            )}
          </div>
        )}
      </div>

      <a
        href={link.url}
        target="_blank"
        rel="noreferrer"
        aria-label={cardAriaLabel}
        onClick={onCardActivate}
        className={`absolute inset-0 z-10 ${FOCUS_RING} rounded-r-xl cursor-pointer`}
      />
    </div>
  );
}
