import { useEffect, useMemo, useRef } from 'react';
import PrimaryButton from '../common/PrimaryButton';
import {
  isMetadataPending,
  isMetadataSettled,
} from '../../lib/hooks/linksData.utils';
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
  /** Whether the link's metadata is still pending (drives the skeleton). */
  isPending: boolean;
  /** Staggered card-enter animation style threaded from the parent card. */
  style: React.CSSProperties;
}

/**
 * Decorative thumbnail region of a link card. Three mutually exclusive states:
 * - Pending (`isPending`): a skeleton block.
 * - Settled with an `imageUrl`: the remote OpenGraph image.
 * - Settled without an `imageUrl`: a locally generated inline-SVG placeholder.
 *
 * All three are `aria-hidden` because the card's accessible name comes from the
 * anchor overlay, not this image.
 */
function CardThumbnail({
  url,
  imageUrl,
  isPending,
  style,
}: CardThumbnailProps) {
  if (isPending) {
    return (
      <div
        aria-hidden="true"
        className="w-[60px] sm:w-[120px] h-[31.5px] sm:h-[63px] shrink-0 bg-[var(--mount-border)] border border-transparent rounded-md"
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
 * Pure presentation props for `SkeletonBar`.
 */
interface SkeletonBarProps {
  /** Width and height utility classes sizing this bar. */
  className: string;
}

/**
 * One placeholder bar in a card's loading skeleton. Purely decorative: the
 * loading state is announced by the anchor's "loading details" accessible name,
 * not by `aria-busy` (assistive tech gives aria-busy on a plain element weak
 * support), so the bar carries no text and stays `aria-hidden` – a visually
 * hidden "Loading" string or a live region here would double-announce. The
 * transparent border resolves to a visible outline under forced-colors, where
 * the background fill is flattened away.
 */
function SkeletonBar({ className }: SkeletonBarProps) {
  return (
    <span
      aria-hidden="true"
      className={`block ${className} bg-[var(--mount-border)] border border-transparent rounded-sm`}
    />
  );
}

/**
 * Pure visual structure of a link card. Handles all rendering decisions:
 * - Shows loading skeletons (title + description bars) and a "loading details"
 *   accessible name while metadata is still being fetched (`isMetadataPending`).
 * - Shows the favicon, title, and description once metadata arrives.
 * - Shows the raw URL as the description for a settled link that never got a title.
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
  const isPending = isMetadataPending(link);
  const hasTitle = Boolean(link.meta?.title);
  const displayTitle = link.meta?.title ?? '(No title)';
  const rawDescription = hasTitle ? link.meta?.description : link.url;
  let displayDescription: string | null | undefined;
  if (!isLinkSafe) {
    displayDescription =
      "This link can't be opened – the saved address isn't safe to open.";
  } else if (isPending) {
    // The description slot renders a skeleton while metadata loads, so there is
    // no text to show here yet.
    displayDescription = null;
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

  // The anchor name and the "Mark unread" label read from one subject so they
  // can never describe the same card differently. While loading the title is
  // unknown, so the subject is just the site name; the anchor adds a "loading
  // details" hint that the button label omits. It flips to the real title in
  // the same render fetchedAt arrives, with no cached state.
  const nameSubject = isPending
    ? displaySiteName
    : `${displayTitle} – ${displaySiteName}`;
  const openHint = isLinkSafe ? 'opens in new tab' : 'link unavailable';
  let cardAriaLabel: string;
  if (!isPending) {
    cardAriaLabel = `${nameSubject}, ${openHint}`;
  } else if (nameSubject) {
    cardAriaLabel = `${nameSubject} – loading details, ${openHint}`;
  } else {
    // While loading the subject is only the site name, which is empty for a
    // hostname-less URL (a `javascript:` row parses to an empty hostname). Drop
    // the leading "site – " so the name never opens on a dangling dash.
    cardAriaLabel = `loading details, ${openHint}`;
  }

  return (
    <div
      ref={cardReference}
      aria-busy={isMetadataPending(link) || undefined}
      /*
        border-shadow / hover:border-shadow are hand-written UNLAYERED classes
        in theme/styles/border-shadow.css, so no `aria-busy:` variant can reach
        them. They stay a conditional keyed off `isMetadataSettled`, while
        aria-busy keys off `isMetadataPending`. Those two predicates are
        complementary by construction in linksData.utils.ts, so the settled
        border and the pending aria-busy can never drift. The classes are
        withheld while pending on purpose: their unlayered box-shadow would
        otherwise outrank the layered selection `ring-2` and swallow the
        selection outline.
      */
      className={`relative overflow-visible pl-10 pr-8 py-4 bg-[var(--mount-bg)] border-l-4 border-[var(--mount-highlight)] aria-busy:border-[var(--mount-border)] rounded-r-xl ${isMetadataSettled(link) ? 'border-shadow hover:border-shadow' : ''} aria-busy:animate-meta-pulse-border ${isSelected ? 'ring-2 ring-[var(--mount-highlight)]/60' : ''}`}
    >
      {isMetadataSettled(link) ? (
        <div className="absolute left-0 top-4 -translate-x-1/2 z-20 pointer-events-none">
          <span className="relative flex items-center justify-center">
            {link.meta?.faviconUrl ? (
              <img
                src={link.meta.faviconUrl}
                alt=""
                loading="lazy"
                className="themed-asset w-8 h-8 bg-white object-cover outline outline-black/10 -outline-offset-1 rounded-4xl"
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
          className="absolute left-0 top-4 -translate-x-1/2 z-20 pointer-events-none"
        >
          <span className="block w-8 h-8 bg-[var(--mount-highlight)] ring-2 ring-[var(--mount-bg)] rounded-2xl animate-meta-pulse-bg" />
        </div>
      )}

      <div className="space-y-1">
        <div className="flex flex-row items-center">
          <CardThumbnail
            url={link.url}
            imageUrl={link.meta?.imageUrl}
            isPending={isPending}
            style={childStyle(3)}
          />

          <div className="flex flex-col items-start min-w-0 ml-3">
            {isPending ? (
              // The wrapper pins the same text-sm line box as the settled title
              // so the loading-to-settled swap shifts no geometry.
              <div
                style={childStyle(1)}
                className={`flex items-center w-full h-5 ${CARD_ENTER_CLASS}`}
              >
                <SkeletonBar className="w-3/5 h-3.5" />
              </div>
            ) : (
              /*
                `w-full` pins the title to the min-w-0 column so `line-clamp-1`
                can clip an unbreakable long word. Without it, the parent's
                `items-start` sizes this <p> to its content width, letting a long
                title overflow the (now overflow-visible) card and inflate the
                320px mobile viewport. The sibling site-name <p> below is pinned
                the same way.
              */
              <p
                style={childStyle(1)}
                className={`w-full text-[var(--mount-text)] text-sm text-balance font-semibold tracking-tight sm:tracking-normal line-clamp-1 ${CARD_ENTER_CLASS}`}
              >
                {displayTitle}
              </p>
            )}

            {/* --*-subtle-text is BASE-only by design; mount hints collapse to alt-text */}
            <p
              style={childStyle(0)}
              className={`w-full text-[var(--mount-alt-text)] text-xs truncate ${CARD_ENTER_CLASS}`}
            >
              {displaySiteName}
            </p>
          </div>
        </div>

        {(isPending || displayDescription || link.readAt) && (
          <div
            style={childStyle(2)}
            className={`relative flex items-start gap-3 overflow-hidden h-8 mt-2 leading-4 ${CARD_ENTER_CLASS} z-20 pointer-events-none`}
          >
            {displayDescription && (
              <p className="flex-1 min-w-0 text-[var(--mount-alt-text)] text-xs text-pretty tracking-tight sm:tracking-normal line-clamp-2">
                {displayDescription}
              </p>
            )}

            {/* The safety warning is real content and outranks the skeleton, so
                a loading, unsafe link shows the warning, never placeholder bars. */}
            {isPending && isLinkSafe && (
              <div
                aria-hidden="true"
                className="flex flex-col flex-1 gap-2 min-w-0"
              >
                <SkeletonBar className="w-full h-3" />
                <SkeletonBar className="w-4/5 h-3" />
              </div>
            )}

            {link.readAt && (
              <PrimaryButton
                className="relative shrink-0 ml-auto z-30 pointer-events-auto"
                onClick={onUnreadClick}
                aria-label={`Mark unread – ${nameSubject}`}
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
