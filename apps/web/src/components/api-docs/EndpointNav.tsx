import MethodIconBadge from './MethodIconBadge';
import { endpointSlug } from './endpointId';
import { FOCUS_RING } from '../../lib/styles';
import type { NormalizedEndpoint } from '../../lib/openapi';

/**
 * Desktop sticky endpoint list – the master half of the master-detail
 * reference. A `<nav>` landmark of plain `<button>`s (not tabs): selecting one
 * swaps the detail region client-side, so navigation semantics + `aria-current`
 * are correct, and the detail's own form never fights a tablist for arrow keys.
 *
 * The selected item is signalled THREE redundant ways (not color alone, SC
 * 1.4.1): an `--orbit-border` ring, `font-semibold`, and the `--orbit-bg` fill –
 * all driven off the `aria-current` attribute via Tailwind `aria-[current]:`
 * variants, so the visual and ARIA state are locked together. The orbit accent
 * is measured against the page `--base-bg` (not the card surface), the project's
 * most-missed contrast rule.
 *
 * Each item's accessible name is the full "GET /links" (method first) via an
 * sr-only span – the `MethodIconBadge` is decorative and the visible path is
 * `aria-hidden`, so AT hears method+path exactly once.
 */

interface EndpointNavProps {
  endpoints: NormalizedEndpoint[];
  /** Slug of the selected endpoint, or `''` when the welcome panel is showing. */
  selectedSlug: string;
  /** Select an endpoint by slug. */
  onSelect: (slug: string) => void;
}

export default function EndpointNav({
  endpoints,
  selectedSlug,
  onSelect,
}: EndpointNavProps) {
  return (
    <nav
      aria-label="API endpoints"
      className="hidden md:block md:sticky md:top-4 md:self-start"
    >
      {/*
       * role="list" is NOT redundant: Tailwind v4's preflight sets
       * `list-style: none` on every <ul>, which drops list semantics in
       * Safari + VoiceOver. The lint rule can't see the reset.
       */}
      {/* eslint-disable-next-line jsx-a11y/no-redundant-roles */}
      <ul role="list" className="space-y-1">
        {endpoints.map((endpoint) => {
          const slug = endpointSlug(endpoint.method, endpoint.path);
          const accessibleMethod = endpoint.method.toUpperCase();
          return (
            <li key={slug}>
              <button
                type="button"
                aria-current={selectedSlug === slug ? 'page' : undefined}
                onClick={() => onSelect(slug)}
                className={`group flex items-center gap-2.5 w-full min-h-10 px-3 py-2 hover:bg-[var(--mount-bg)] aria-[current]:bg-[var(--orbit-bg)] aria-[current]:ring-1 aria-[current]:ring-[var(--orbit-border)] text-[var(--base-alt-text)] hover:text-[var(--base-text)] aria-[current]:text-[var(--orbit-text)] text-sm font-medium aria-[current]:font-semibold ${FOCUS_RING} rounded-lg motion-safe:active:scale-[0.96] motion-safe:[transition:background-color_150ms,color_150ms,scale_150ms] cursor-pointer`}
              >
                <MethodIconBadge method={endpoint.method} />
                <span className="sr-only">
                  {accessibleMethod} {endpoint.path}
                </span>
                <span aria-hidden="true" className="min-w-0 truncate font-mono">
                  {endpoint.path.substring(1)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
