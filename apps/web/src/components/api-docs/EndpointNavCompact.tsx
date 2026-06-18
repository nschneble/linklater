import MethodBadge from './MethodBadge';
import { endpointSlug } from './endpointId';
import { FOCUS_RING } from '../../lib/styles';
import { useEffect, useRef } from 'react';
import type { NormalizedEndpoint } from '../../lib/openapi';

/**
 * Mobile horizontal endpoint picker — the compact stand-in for `EndpointNav`
 * below `md`. A scrollable `<nav>` of chips, modeled on `SettingsSectionNav`.
 * Same model as desktop: plain buttons + `aria-current`, no tablist, no arrow
 * roving. Selecting a chip swaps the detail region below it.
 *
 * When the selection changes (e.g. a keyboard pick, or a deep-link landing),
 * the active chip can sit off-screen in the overflow scroller; an effect calls
 * `scrollIntoView` so the `aria-current` chip is always visible. The landmark
 * label differs from the desktop nav ("API endpoints (compact)") so the two
 * don't read as duplicate landmarks while both are in the AT tree.
 */

interface EndpointNavCompactProps {
  endpoints: NormalizedEndpoint[];
  /** Slug of the selected endpoint, or `''` when the welcome panel is showing. */
  selectedSlug: string;
  /** Select an endpoint by slug. */
  onSelect: (slug: string) => void;
}

export default function EndpointNavCompact({
  endpoints,
  selectedSlug,
  onSelect,
}: EndpointNavCompactProps) {
  const activeChipRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (selectedSlug === '') return;
    activeChipRef.current?.scrollIntoView({
      inline: 'nearest',
      block: 'nearest',
    });
  }, [selectedSlug]);

  return (
    <nav
      aria-label="API endpoints (compact)"
      className="sticky md:hidden top-2 z-10 -mx-4 px-4 py-2 bg-[var(--base-bg)]"
    >
      {/* eslint-disable-next-line jsx-a11y/no-redundant-roles */}
      <ul
        role="list"
        className="flex gap-2 overflow-x-auto snap-x snap-mandatory scroll-px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {endpoints.map((endpoint) => {
          const slug = endpointSlug(endpoint.method, endpoint.path);
          const isSelected = selectedSlug === slug;
          const accessibleMethod = endpoint.method.toUpperCase();
          return (
            <li key={slug} className="shrink-0 snap-start">
              <button
                ref={isSelected ? activeChipRef : undefined}
                type="button"
                aria-current={isSelected ? 'page' : undefined}
                onClick={() => onSelect(slug)}
                className={`group inline-flex items-center gap-2 min-h-10 px-3 py-2 bg-transparent text-[var(--base-alt-text)] hover:text-[var(--base-text)] ring-1 ring-[var(--base-border)]/60 aria-[current]:bg-[var(--orbit-bg)] aria-[current]:text-[var(--orbit-text)] aria-[current]:ring-[var(--orbit-border)] font-medium aria-[current]:font-semibold ${FOCUS_RING} rounded-full cursor-pointer motion-safe:active:scale-[0.96] motion-safe:[transition:background-color_150ms,color_150ms,scale_150ms] whitespace-nowrap`}
              >
                <MethodBadge method={endpoint.method} />
                <span className="sr-only">
                  {accessibleMethod} {endpoint.path}
                </span>
                <span aria-hidden="true" className="font-mono text-xs">
                  {endpoint.path}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
