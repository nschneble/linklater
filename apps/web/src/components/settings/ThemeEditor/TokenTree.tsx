import ColorRow from './ColorRow';
import { useMemo, useRef, useState } from 'react';
import {
  VAR_GROUPS,
  type Bundle,
  type BundleGroup,
  type ThemeVariable,
} from './useThemeOverrides';
import type { TokenContrastFailure } from './contrastResults';

/** Shared between the "show all colors" toggle (`aria-controls`) and this root. */
export const TOKEN_TREE_ID = 'theme-editor-token-tree';

const SEARCH_INPUT_ID = 'theme-editor-token-search';
const SEARCH_STATUS_ID = 'theme-editor-token-search-status';

interface TokenTreeProps {
  /** Current (possibly overridden) values for all editable CSS variables. */
  colorValues: Record<ThemeVariable, string>;
  /**
   * Worst failing contrast pair keyed by EITHER endpoint (the both-endpoints
   * `pairsTouchingToken` view, the same map the knobs read). Keying by both
   * endpoints means editing a row whose token is a pair's BACKGROUND
   * self-reports on that row, not only on the far foreground row (C3).
   */
  contrastFailures: Map<string, TokenContrastFailure>;
  /** Called when the user changes a color via the picker or text input. */
  onOverride: (variable: ThemeVariable, value: string) => void;
  /**
   * Whether the drawer is expanded. The tree stays MOUNTED while collapsed
   * (toggled via the HTML `hidden` attribute) so `aria-controls` always
   * resolves and the search query / open-set / focus survive a collapse.
   */
  visible: boolean;
}

/**
 * Filters `VAR_GROUPS` against a lowercased query, matching on bundle label,
 * slot label, or variable name. Substring match – users typically type a few
 * letters of the hyphenated name without the leading dashes, so a substring
 * check covers both `--mount-highlight-fg` and `mount-highlight-fg`. Whole
 * bundles are kept when the bundle label itself matches (e.g. query "mount"
 * keeps every slot under the Mount section).
 */
function filterGroups(
  query: string,
  groups: ReadonlyArray<BundleGroup>,
): BundleGroup[] {
  if (query === '') return groups.slice();
  return groups
    .map((group) => {
      const groupLabelHit = group.label.toLowerCase().includes(query);
      if (groupLabelHit) return { ...group };
      const items = group.items.filter(
        (item) =>
          item.label.toLowerCase().includes(query) ||
          item.variable.toLowerCase().includes(query),
      );
      return { ...group, items };
    })
    .filter((group) => group.items.length > 0);
}

/**
 * The "show all colors" drawer: a searchable, per-bundle disclosure tree over
 * every editable token. Demoted below the five human knobs but always mounted
 * (the parent toggles `hidden`), so collapsing it never strands focus or drops
 * the search/open-set state.
 *
 * Each bundle is a collapsible disclosure; the `base` bundle defaults to open.
 * While a search query is active, every bundle with at least one match
 * auto-expands; the prior open/closed state is restored when the query clears.
 */
export default function TokenTree({
  colorValues,
  contrastFailures,
  onOverride,
  visible,
}: TokenTreeProps) {
  const [openBundles, setOpenBundles] = useState<Set<Bundle>>(
    () => new Set(['base']),
  );
  const [query, setQuery] = useState('');
  const preSearchOpenBundles = useRef<Set<Bundle> | null>(null);
  const searchInputReference = useRef<HTMLInputElement>(null);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredGroups = useMemo(
    () => filterGroups(normalizedQuery, VAR_GROUPS),
    [normalizedQuery],
  );
  const matchCount = filteredGroups.reduce(
    (total, group) => total + group.items.length,
    0,
  );

  // Effective open set: every matching bundle is open while a query is active;
  // manual openBundles state otherwise. Manual toggles still mutate
  // openBundles even mid-search so the user can collapse a matching section.
  const effectiveOpenBundles = useMemo(() => {
    if (normalizedQuery === '') return openBundles;
    return new Set(filteredGroups.map((group) => group.bundle));
  }, [normalizedQuery, openBundles, filteredGroups]);

  function toggleBundle(bundle: Bundle) {
    setOpenBundles((previous) => {
      const next = new Set(previous);
      if (next.has(bundle)) {
        next.delete(bundle);
      } else {
        next.add(bundle);
      }
      return next;
    });
  }

  function expandAll() {
    setOpenBundles(new Set(VAR_GROUPS.map((group) => group.bundle)));
  }

  function collapseAll() {
    setOpenBundles(new Set());
  }

  function handleQueryChange(event: React.ChangeEvent<HTMLInputElement>) {
    const nextQuery = event.target.value;
    if (query === '' && nextQuery !== '') {
      // Entering search mode – snapshot current open state.
      preSearchOpenBundles.current = new Set(openBundles);
    }
    if (nextQuery === '' && preSearchOpenBundles.current !== null) {
      // Exiting search mode – restore prior snapshot.
      setOpenBundles(preSearchOpenBundles.current);
      preSearchOpenBundles.current = null;
    }
    setQuery(nextQuery);
  }

  function clearSearch() {
    if (preSearchOpenBundles.current !== null) {
      setOpenBundles(preSearchOpenBundles.current);
      preSearchOpenBundles.current = null;
    }
    setQuery('');
    searchInputReference.current?.focus();
  }

  function handleSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape' && query !== '') {
      // Stop the Escape from bubbling to the outer "show all colors" disclosure
      // (clearing the search must not also collapse the drawer).
      event.preventDefault();
      event.stopPropagation();
      clearSearch();
    }
  }

  const allOpen = openBundles.size === VAR_GROUPS.length;

  const liveRegionMessage =
    query === ''
      ? ''
      : matchCount === 0
        ? 'No tokens match'
        : matchCount === 1
          ? '1 token matches'
          : `${matchCount} tokens match`;

  return (
    <div id={TOKEN_TREE_ID} hidden={!visible} className="space-y-3">
      <div role="search" aria-label="Search theme tokens" className="relative">
        <label htmlFor={SEARCH_INPUT_ID} className="sr-only">
          Search tokens
        </label>
        <input
          ref={searchInputReference}
          id={SEARCH_INPUT_ID}
          type="search"
          value={query}
          onChange={handleQueryChange}
          onKeyDown={handleSearchKeyDown}
          placeholder="Search tokens…"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-describedby={SEARCH_STATUS_ID}
          className="w-full pl-7 pr-7 py-1.5 bg-[var(--mount-input-bg)] border border-[var(--mount-border)] text-[var(--mount-text)] text-xs focus:outline-none focus:ring-1 focus:ring-[var(--focus-ring)] rounded-md"
        />
        <i
          className="absolute left-2 top-1/2 -translate-y-1/2 fa-solid fa-magnifying-glass text-[var(--mount-alt-text)] text-[0.6rem]"
          aria-hidden="true"
        />
        {query !== '' && (
          <button
            type="button"
            onClick={clearSearch}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 flex items-center justify-center w-4 h-4 -translate-y-1/2 text-[var(--mount-alt-text)] hover:text-[var(--mount-text)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--focus-ring)] rounded cursor-pointer"
          >
            <i className="fa-solid fa-xmark text-[0.6rem]" aria-hidden="true" />
          </button>
        )}
        <p
          id={SEARCH_STATUS_ID}
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
        >
          {liveRegionMessage}
        </p>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-[var(--mount-alt-text)] text-[0.6rem]">
          {VAR_GROUPS.length} bundles ·{' '}
          {VAR_GROUPS.reduce((total, group) => total + group.items.length, 0)}{' '}
          tokens
        </p>
        <button
          type="button"
          onClick={allOpen ? collapseAll : expandAll}
          className="text-[var(--mount-alt-text)] hover:text-[var(--mount-text)] text-[0.65rem] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--focus-ring)] rounded cursor-pointer"
        >
          {allOpen ? 'Collapse all' : 'Expand all'}
        </button>
      </div>

      {filteredGroups.length === 0 ? (
        <p
          role="note"
          className="py-4 text-[var(--mount-alt-text)] text-xs italic text-center"
        >
          No tokens match &ldquo;{query}&rdquo;.
        </p>
      ) : (
        filteredGroups.map((group) => {
          const isOpen = effectiveOpenBundles.has(group.bundle);
          const contentId = `theme-editor-${group.bundle}-content`;
          const headingId = `theme-editor-${group.bundle}-heading`;
          return (
            <section
              key={group.bundle}
              aria-labelledby={headingId}
              className="pb-3 last:pb-0 border-b border-[var(--mount-border)] last:border-0"
            >
              <h3
                id={headingId}
                className="m-0 text-[var(--mount-text)] text-xs font-semibold"
              >
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={contentId}
                  onClick={() => toggleBundle(group.bundle)}
                  className="group w-full flex items-center gap-2 py-1 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--focus-ring)] rounded cursor-pointer"
                >
                  <i
                    className="fa-solid fa-chevron-right text-[var(--mount-alt-text)] text-[0.55rem] group-aria-expanded:rotate-90 transition-transform duration-150"
                    aria-hidden="true"
                  />
                  <span>{group.label}</span>
                  <span className="flex-1 text-[var(--mount-alt-text)] text-[0.65rem] font-normal truncate">
                    {group.description}
                  </span>
                </button>
              </h3>

              {isOpen && (
                <div id={contentId} className="mt-2 space-y-2 pl-4">
                  {group.items.map(({ variable, label }) => (
                    <ColorRow
                      key={variable}
                      label={label}
                      bundleLabel={group.label}
                      variable={variable}
                      currentValue={colorValues[variable]}
                      failure={contrastFailures.get(variable)}
                      onOverride={onOverride}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })
      )}
    </div>
  );
}
