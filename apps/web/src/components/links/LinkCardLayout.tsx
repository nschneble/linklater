import { useEffect, useMemo, useRef } from 'react';
import PrimaryButton from '../common/PrimaryButton';
import { isSafeRedirectUrl } from '../../lib/safe-redirect-url';
import { hostnameOf, stripHtml } from '../../lib/strings';
import { FOCUS_RING } from '../../lib/styles';
import type { Link } from '../../lib/api';

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
   * Native anchor activation handles opening the URL – this callback exists
   * so callers can run side effects like marking the link read.
   */
  onCardActivate: (event: React.MouseEvent) => void;
  /**
   * Called when the "Mark as unread" button is clicked. The button is a
   * sibling of the anchor overlay, so its click does not propagate to the
   * card-open behavior – no `stopPropagation()` needed.
   */
  onUnreadClick: (event: React.MouseEvent) => void;
}

const CARD_ENTER_CLASS = 'animate-card-enter';

/**
 * Pure presentation props for `CardThumbnail`.
 */
interface CardThumbnailProps {
  /** The link URL, used to label the locally generated placeholder. */
  url: string;
  /** OpenGraph image URL when metadata provided one. */
  imageUrl?: string | null;
  /** Timestamp metadata finished fetching, or nullish while still loading. */
  fetchedAt?: string | null;
  /** Staggered card-enter animation style threaded from the parent card. */
  style: React.CSSProperties;
}

/**
 * Decorative thumbnail region of a link card. Three mutually exclusive states:
 * - Not-yet-fetched (`!fetchedAt`): a skeleton block.
 * - Fetched with an `imageUrl`: the remote OpenGraph image.
 * - Fetched without an `imageUrl`: a locally generated inline-SVG placeholder.
 *
 * All three are `aria-hidden` because the card's accessible name comes from the
 * anchor overlay, not this image.
 */
function CardThumbnail({
  url,
  imageUrl,
  fetchedAt,
  style,
}: CardThumbnailProps) {
  if (!fetchedAt) {
    return (
      <div
        aria-hidden="true"
        className="w-[60px] sm:w-[120px] h-[31.5px] sm:h-[63px] shrink-0 rounded-md bg-[var(--orbit-bg)]"
      />
    );
  }

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt=""
        aria-hidden="true"
        loading="lazy"
        style={style}
        className={`themed-asset w-[60px] sm:w-[120px] h-[32px] sm:h-[63px] shrink-0 bg-white object-cover rounded-md outline outline-1 outline-black/10 -outline-offset-1 ${CARD_ENTER_CLASS}`}
      />
    );
  }

  return (
    /*
      Locally generated placeholder: an inline SVG whose fills bind to
      the mount-highlight pair (fill = --mount-highlight, text =
      --mount-highlight-fg) so it inherits the WCAG 1.4.3 contrast
      guarantee pinned in bundles.contrast.test.ts. Because the fills
      are CSS variables, the placeholder recolors on both theme and
      light/dark toggle with no JS read. Decorative: aria-hidden, the
      anchor already carries the card's accessible name.
    */
    <svg
      aria-hidden="true"
      viewBox="0 0 240 126"
      style={style}
      className={`w-[60px] sm:w-[120px] h-[32px] sm:h-[63px] shrink-0 rounded-md outline outline-1 outline-black/10 -outline-offset-1 ${CARD_ENTER_CLASS}`}
    >
      <rect width="240" height="126" fill="var(--mount-highlight)" />
      <text
        x="120"
        y="63"
        fill="var(--mount-highlight-fg)"
        fontSize="22"
        fontWeight="600"
        fontFamily="system-ui, sans-serif"
        textAnchor="middle"
        dominantBaseline="central"
      >
        {hostnameOf(url)}
      </text>
    </svg>
  );
}

/**
 * Pure visual structure of a link card. Handles all rendering decisions:
 * - Shows a pulsing indicator while metadata is still being fetched (`!meta.fetchedAt`).
 * - Shows the favicon once metadata arrives.
 * - Shows the raw URL as the description when no title is present.
 * - Shows a "Mark as unread" button for read links.
 * - Shows an inert, `aria-disabled` overlay in place of the real link when
 *   `link.url` fails `isSafeRedirectUrl` (a legacy non-http(s) row) – `href`
 *   never carries the unsafe value, and click/keyboard activation no-ops,
 *   so the URL can never reach the browser via this card.
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

  const isLinkSafe = isSafeRedirectUrl(link.url);
  const hasTitle = Boolean(link.meta?.title);
  const displayTitle = link.meta?.title ?? '(No title)';
  const rawDescription = hasTitle ? link.meta?.description : link.url;
  let displayDescription: string | null | undefined;
  if (!isLinkSafe) {
    displayDescription =
      "This link can't be opened – the saved address isn't safe to open.";
  } else if (rawDescription) {
    displayDescription = stripHtml(rawDescription);
  } else {
    displayDescription = rawDescription;
  }
  const displaySiteName = useMemo(
    () =>
      link.meta?.siteName
        ? link.meta.siteName.replace(/^www\./, '')
        : hostnameOf(link.url),
    [link.meta?.siteName, link.url],
  );

  const cardAriaLabel = isLinkSafe
    ? `${displayTitle} – ${displaySiteName}, opens in new tab`
    : `${displayTitle} – ${displaySiteName}, link unavailable`;

  return (
    <div
      ref={cardReference}
      aria-busy={!link.meta?.fetchedAt || undefined}
      className={`relative overflow-visible pl-10 pr-8 py-4 bg-[var(--mount-bg)] border-l-4 ${link.meta?.fetchedAt ? 'border-[var(--mount-highlight)] border-shadow hover:border-shadow' : 'border-dashed border-[var(--mount-border)]'} rounded-r-xl ${isSelected ? 'ring-2 ring-[var(--mount-highlight)]/60' : ''}`}
    >
      {link.meta?.fetchedAt ? (
        <div className="absolute left-0 top-4 -translate-x-1/2 z-20 pointer-events-none">
          <span className="relative flex items-center justify-center">
            {link.meta?.faviconUrl ? (
              <img
                src={link.meta.faviconUrl}
                alt=""
                loading="lazy"
                className="themed-asset object-cover w-8 h-8 bg-white outline outline-black/10 -outline-offset-1 rounded-4xl"
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
                  className="fa-solid fa-bookmark text-[var(--mount-highlight)] text-lg"
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
          <div className="absolute top-0 bottom-0 left-0 -translate-x-full w-1 bg-[var(--mount-highlight)]" />
          <span className="absolute left-0 top-4 -translate-x-1/2 z-10 block w-8 h-8 bg-[var(--mount-highlight)] ring-2 ring-[var(--mount-bg)] rounded-2xl" />
        </div>
      )}

      <div className="space-y-1">
        <div className="flex flex-row items-center">
          <CardThumbnail
            url={link.url}
            imageUrl={link.meta?.imageUrl}
            fetchedAt={link.meta?.fetchedAt}
            style={childStyle(3)}
          />

          <div className="flex flex-col items-start min-w-0 ml-3">
            {/*
              `w-full` pins the title to the min-w-0 column so `line-clamp-1`
              can clip an unbreakable long word. Without it, the parent's
              `items-start` sizes this <p> to its content width, letting a long
              title overflow the (now overflow-visible) card and inflate the
              320px mobile viewport. The sibling site-name <p> below is pinned
              the same way.
            */}
            <p
              style={childStyle(1)}
              className={`w-full text-[var(--mount-text)] text-sm text-balance font-semibold tracking-tight sm:tracking-normal line-clamp-1 ${CARD_ENTER_CLASS}`}
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
                className="relative shrink-0 ml-auto z-30 pointer-events-auto"
                onClick={onUnreadClick}
                aria-label={`Mark unread – ${displayTitle} – ${displaySiteName}`}
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
        href={isLinkSafe ? link.url : '#'}
        target={isLinkSafe ? '_blank' : undefined}
        rel={isLinkSafe ? 'noreferrer' : undefined}
        aria-label={cardAriaLabel}
        aria-disabled={isLinkSafe ? undefined : true}
        onClick={(event) => {
          if (!isLinkSafe) {
            event.preventDefault();
            return;
          }
          onCardActivate(event);
        }}
        className={`absolute inset-0 z-10 ${FOCUS_RING} rounded-r-xl cursor-pointer aria-disabled:cursor-not-allowed`}
      />
    </div>
  );
}
