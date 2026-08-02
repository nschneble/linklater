import { useEffect, useMemo, useRef } from 'react';
import PrimaryButton from '../common/PrimaryButton';
import {
  isMetadataPending,
  isMetadataSettled,
} from '../../lib/hooks/linksData.utils';
import { useSkeletonPresence } from '../../lib/hooks/useSkeletonPresence';
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

// motion-reduce clamp zeroes duration but not delay, so drop the keyframe
const CARD_ENTER_CLASS = 'animate-card-enter motion-reduce:animate-none';

// skeleton mounted post-settle so lift-out plays; matches SKELETON_LIFT
const SKELETON_EXIT_MS = 300;

// transition (not keyframe) so a refetch mid-settle stays interruptible
const SKELETON_LIFT =
  'transition-[opacity,translate,filter] duration-300 ease-[cubic-bezier(0.2,0,0,1)] ' +
  'opacity-0 -translate-y-1.5 blur-[2px] ' +
  'group-aria-busy:opacity-100 group-aria-busy:translate-y-0 group-aria-busy:blur-[0px]';

/**
 * Pure presentation props for `SkeletonOverlay`.
 */
interface SkeletonOverlayProps {
  /** Staggered card-enter style threaded from the parent card. */
  style: React.CSSProperties;
  /** Layout classes positioning the bars/block within the slot. */
  className?: string;
  /** The skeleton bars or block for this slot. */
  children: React.ReactNode;
}

/**
 * A slot's loading skeleton, stacked over the (still-absent) real content. The
 * outer layer plays the staggered card-enter on first paint so the skeleton
 * rides the same intro as a settled card; the inner layer holds the lift-out
 * transition that plays when the card settles and `aria-busy` clears, so the
 * skeleton fades and lifts away while the real content rises in beneath it. The
 * whole overlay is `aria-hidden` – the anchor carries the "loading details"
 * accessible name, and no focusable ever lives inside it.
 */
function SkeletonOverlay({
  style,
  className = '',
  children,
}: SkeletonOverlayProps) {
  return (
    <div
      aria-hidden="true"
      style={style}
      className={`absolute inset-0 ${CARD_ENTER_CLASS}`}
    >
      <div className={`${SKELETON_LIFT} ${className}`}>{children}</div>
    </div>
  );
}

/**
 * Pure presentation props for `ThumbnailContent`.
 */
interface ThumbnailContentProps {
  /** The link URL, used to label the locally generated placeholder. */
  url: string;
  /** OpenGraph image URL when metadata provided one. */
  imageUrl?: string | null;
  /** Staggered card-enter style threaded from the parent card. */
  style: React.CSSProperties;
}

/**
 * The settled thumbnail: the remote OpenGraph image when metadata provided one,
 * otherwise a locally generated inline-SVG placeholder. Both are `aria-hidden`
 * because the card's accessible name comes from the anchor overlay.
 */
function ThumbnailContent({ url, imageUrl, style }: ThumbnailContentProps) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt=""
        aria-hidden="true"
        loading="lazy"
        style={style}
        className={`themed-asset w-full h-full bg-white object-cover rounded-md outline outline-1 outline-black/10 -outline-offset-1 ${CARD_ENTER_CLASS}`}
      />
    );
  }

  return (
    /* inline SVG fills bind the mount-highlight pair for WCAG 1.4.3 contrast */
    <svg
      aria-hidden="true"
      viewBox="0 0 240 126"
      style={style}
      className={`w-full h-full rounded-md outline outline-1 outline-black/10 -outline-offset-1 ${CARD_ENTER_CLASS}`}
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
 * Pure presentation props for `CardThumbnail`.
 */
interface CardThumbnailProps {
  /** The link URL, used to label the locally generated placeholder. */
  url: string;
  /** OpenGraph image URL when metadata provided one. */
  imageUrl?: string | null;
  /** Whether the link's metadata is still pending (hides the real thumbnail). */
  isPending: boolean;
  /** Whether the loading skeleton should render (through its lift-out exit). */
  renderSkeleton: boolean;
  /** Staggered card-enter animation style threaded from the parent card. */
  style: React.CSSProperties;
}

/**
 * Decorative thumbnail region of a link card. A fixed-size box holds two stacked
 * layers: the real thumbnail (once settled) and a loading skeleton block that
 * pulses while pending and lifts out on settle. The box keeps its size in both
 * states so the swap shifts no geometry.
 */
function CardThumbnail({
  url,
  imageUrl,
  isPending,
  renderSkeleton,
  style,
}: CardThumbnailProps) {
  return (
    <div className="relative w-[60px] sm:w-[120px] h-[32px] sm:h-[63px] shrink-0">
      {!isPending && (
        <ThumbnailContent url={url} imageUrl={imageUrl} style={style} />
      )}

      {renderSkeleton && (
        <SkeletonOverlay style={style} className="h-full">
          <div
            aria-hidden="true"
            className="w-full h-full bg-[var(--mount-border)] border border-transparent rounded-md group-aria-busy:animate-meta-pulse-bg"
          />
        </SkeletonOverlay>
      )}
    </div>
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
 * hidden "Loading" string or a live region here would double-announce. It pulses
 * its fill between the mount border and highlight ONLY while the card is
 * aria-busy (`group-aria-busy:`), so a settled card mid-exit carries no running
 * animation. The transparent border resolves to a visible outline under
 * forced-colors, where the background fill is flattened away.
 */
function SkeletonBar({ className }: SkeletonBarProps) {
  return (
    <span
      aria-hidden="true"
      className={`block ${className} bg-[var(--mount-border)] border border-transparent rounded-sm group-aria-busy:animate-meta-pulse-bg`}
    />
  );
}

/**
 * Pure visual structure of a link card. Handles all rendering decisions:
 * - Shows loading skeletons (thumbnail + title + description) and a "loading
 *   details" accessible name while metadata is still being fetched
 *   (`isMetadataPending`). The skeletons pulse while pending and lift out as the
 *   real content rises in when metadata settles.
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
  // keeps the skeleton mounted through its lift-out exit after settle
  const renderSkeleton = useSkeletonPresence(isPending, SKELETON_EXIT_MS);
  const hasTitle = Boolean(link.meta?.title);
  const displayTitle = link.meta?.title ?? '(No title)';
  const rawDescription = hasTitle ? link.meta?.description : link.url;
  let displayDescription: string | null | undefined;
  if (!isLinkSafe) {
    displayDescription =
      "This link can't be opened – the saved address isn't safe to open.";
  } else if (isPending) {
    // description slot shows a skeleton while loading, so no text yet
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

  // anchor name and "Mark unread" label share one subject, never diverging
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
    // hostname-less URL (javascript:) has no site name; avoid a dangling dash
    cardAriaLabel = `loading details, ${openHint}`;
  }

  return (
    <div
      ref={cardReference}
      aria-busy={isMetadataPending(link) || undefined}
      /* border-shadow is unlayered, so withheld while pending; else it outranks the selection ring-2 */
      className={`group relative overflow-visible pl-10 pr-8 py-4 bg-[var(--mount-bg)] border-l-4 border-[var(--mount-highlight)] aria-busy:border-[var(--mount-border)] rounded-r-xl ${isMetadataSettled(link) ? 'border-shadow hover:border-shadow' : ''} aria-busy:animate-meta-pulse-border ${isSelected ? 'ring-2 ring-[var(--mount-highlight)]/60' : ''}`}
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
          <span className="block w-8 h-8 bg-[var(--mount-highlight)] rounded-2xl animate-meta-pulse-bg" />
        </div>
      )}

      <div className="space-y-1">
        <div className="flex flex-row items-center">
          <CardThumbnail
            url={link.url}
            imageUrl={link.meta?.imageUrl}
            isPending={isPending}
            renderSkeleton={renderSkeleton}
            style={childStyle(3)}
          />

          <div className="flex flex-col items-start min-w-0 ml-3">
            <div className="relative w-full h-5">
              {!isPending && (
                /* w-full pins the title to the min-w-0 column so line-clamp-1 can clip a long word; guards 320px reflow */
                <p
                  style={childStyle(1)}
                  className={`w-full text-[var(--mount-text)] text-sm text-balance font-semibold tracking-tight sm:tracking-normal line-clamp-1 ${CARD_ENTER_CLASS}`}
                >
                  {displayTitle}
                </p>
              )}

              {renderSkeleton && (
                <SkeletonOverlay
                  style={childStyle(1)}
                  className="flex items-center h-full"
                >
                  <SkeletonBar className="w-3/5 h-3.5" />
                </SkeletonOverlay>
              )}
            </div>

            {/* --*-subtle-text is BASE-only by design; mount hints collapse to alt-text */}
            <p
              style={childStyle(0)}
              className={`w-full text-[var(--mount-alt-text)] text-xs truncate ${CARD_ENTER_CLASS}`}
            >
              {displaySiteName}
            </p>
          </div>
        </div>

        {(renderSkeleton || displayDescription || link.readAt) && (
          <div className="relative flex items-start gap-3 overflow-hidden h-8 mt-2 leading-4 z-20 pointer-events-none">
            {displayDescription && (
              <p
                style={childStyle(2)}
                className={`flex-1 min-w-0 text-[var(--mount-alt-text)] text-xs text-pretty tracking-tight sm:tracking-normal line-clamp-2 ${CARD_ENTER_CLASS}`}
              >
                {displayDescription}
              </p>
            )}

            {/* The safety warning is real content and outranks the skeleton, so
                a loading, unsafe link shows the warning, never placeholder bars. */}
            {renderSkeleton && isLinkSafe && (
              <SkeletonOverlay
                style={childStyle(2)}
                className="flex flex-col justify-center gap-2 h-full"
              >
                <SkeletonBar className="w-full h-3" />
                <SkeletonBar className="w-4/5 h-3" />
              </SkeletonOverlay>
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
