import { useState } from 'react';
import {
  SC_LABELS,
  type ContrastPair,
  type ContrastResults,
  type GroupResult,
} from './contrastResults';
import { BUNDLES } from './useThemeOverrides';

interface ContrastCheckerProps {
  /**
   * Precomputed contrast results from `useContrastResults`. Computed once by
   * the parent so the Save action's failing-count warning and this visible
   * breakdown read a single source of truth (a11y brief B5).
   */
  results: ContrastResults;
}

interface PassBadgeProps {
  pair: ContrastPair;
  ratio: number;
}

/**
 * A small badge showing whether a contrast ratio meets its WCAG criterion.
 * Pass/fail visual is reinforced by an icon (color-independent meaning).
 * Uses fixed inline styles so the badge stays readable when the user edits
 * the alert/success bundles to invalid values mid-session.
 */
function PassBadge({ pair, ratio }: PassBadgeProps) {
  const passes = ratio >= pair.threshold;
  const ariaLabel = passes
    ? `${SC_LABELS[pair.criterion]}: pass (${ratio.toFixed(2)} of ${pair.threshold} required)`
    : `${SC_LABELS[pair.criterion]}: fail (${ratio.toFixed(2)} of ${pair.threshold} required)`;
  return (
    <span
      aria-label={ariaLabel}
      style={
        passes
          ? { backgroundColor: '#166534', color: '#ffffff' }
          : { backgroundColor: '#991b1b', color: '#ffffff' }
      }
      className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[0.55rem] font-semibold rounded"
    >
      <i
        className={`fa-solid ${passes ? 'fa-check' : 'fa-xmark'} text-[0.5rem]`}
        aria-hidden="true"
      />
      {pair.criterion}
    </span>
  );
}

interface BundleRowProps {
  pair: ContrastPair;
  ratio: number | null;
}

function BundleRow({ pair, ratio }: BundleRowProps) {
  return (
    <div className="flex items-center gap-2 py-1 border-b border-[var(--mount-border)] last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-[var(--mount-text)] text-[0.65rem] truncate">
          {pair.label}
        </p>
      </div>
      {ratio === null ? (
        <span
          className="text-[var(--mount-alt-text)] text-[0.6rem]"
          title="Alpha or undefined value – unverified; see compiled tests"
        >
          unverified
        </span>
      ) : (
        <div className="flex shrink-0 items-center gap-1">
          <span className="w-9 text-[var(--mount-alt-text)] text-[0.6rem] text-right font-mono">
            {ratio.toFixed(2)}
          </span>
          <PassBadge pair={pair} ratio={ratio} />
        </div>
      )}
    </div>
  );
}

/**
 * Displays WCAG 2.1 contrast ratios for every bundle's contract pairs plus
 * the universal focus-ring pairs, grouped in collapsible disclosures. Default
 * view shows only failing pairs so the editor stays scannable at ~50 pairs.
 *
 * A live-updating summary at the top announces regressions to screen-reader
 * users (`aria-live="polite"`). This is the polite aggregate; per-token
 * failures are surfaced inline by `ColorEditor` to avoid a barrage.
 *
 * For the custom theme this is the SOLE contrast guardrail – the static
 * `bundles.contrast.test.ts` never sees user-authored tokens (a11y brief B3).
 *
 * Alpha tokens (e.g. dark-mode state bundle bgs `rgb(R G B / α)`) and the
 * undefined custom focus-ring show "unverified" because the runtime editor
 * does not perform composite math. The compiled bundle tests cover alpha
 * pairs rigorously for the built-in themes.
 */
export default function ContrastChecker({ results }: ContrastCheckerProps) {
  const [failuresOnly, setFailuresOnly] = useState(true);
  const [openGroups, setOpenGroups] = useState<Set<GroupResult['group']>>(
    () => new Set<GroupResult['group']>([...BUNDLES, 'focus']),
  );

  const { totalFailures, totalPairs } = results;

  function toggleGroup(group: GroupResult['group']) {
    setOpenGroups((previous) => {
      const next = new Set(previous);
      if (next.has(group)) {
        next.delete(group);
      } else {
        next.add(group);
      }
      return next;
    });
  }

  return (
    <div className="space-y-2">
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="flex items-center justify-between gap-2"
      >
        <p className="text-[var(--mount-alt-text)] text-[0.65rem]">
          {totalFailures === 0
            ? `All ${totalPairs} pairs passing`
            : `${totalFailures} of ${totalPairs} pairs failing`}
        </p>
        <button
          type="button"
          onClick={() => setFailuresOnly((previous) => !previous)}
          aria-pressed={failuresOnly}
          className="text-[var(--mount-alt-text)] hover:text-[var(--mount-text)] aria-pressed:text-[var(--mount-text)] aria-pressed:font-semibold text-[0.6rem] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--focus-ring)] rounded cursor-pointer"
        >
          {failuresOnly ? 'Show all' : 'Failures only'}
        </button>
      </div>

      {results.groups.map((result) => {
        const visiblePairs = failuresOnly
          ? result.pairs.filter(
              ({ pair, ratio }) => ratio !== null && ratio < pair.threshold,
            )
          : result.pairs;
        if (visiblePairs.length === 0) return null;
        const isOpen = openGroups.has(result.group);
        const contentId = `contrast-${result.group}-content`;
        const headingId = `contrast-${result.group}-heading`;
        return (
          <section
            key={result.group}
            aria-labelledby={headingId}
            className="border-b border-[var(--mount-border)] last:border-0 pb-1.5 last:pb-0"
          >
            <h3 id={headingId} className="m-0">
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={contentId}
                onClick={() => toggleGroup(result.group)}
                className="group w-full flex items-center gap-2 py-1 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--focus-ring)] rounded cursor-pointer"
              >
                <i
                  className="fa-solid fa-chevron-right text-[0.5rem] text-[var(--mount-alt-text)] group-aria-expanded:rotate-90 transition-transform duration-150"
                  aria-hidden="true"
                />
                <span className="text-[var(--mount-text)] text-[0.65rem] font-semibold">
                  {result.label}
                </span>
                <span className="flex-1 text-[var(--mount-alt-text)] text-[0.6rem] text-right">
                  {result.failureCount === 0
                    ? `${result.totalCount} / ${result.totalCount}`
                    : `${result.totalCount - result.failureCount} / ${result.totalCount}`}
                </span>
              </button>
            </h3>
            {isOpen && (
              <div id={contentId} className="pl-4">
                {visiblePairs.map(({ pair, ratio }) => (
                  <BundleRow
                    key={`${result.group}-${pair.label}`}
                    pair={pair}
                    ratio={ratio}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}

      {failuresOnly && totalFailures === 0 && (
        <p className="text-[var(--mount-alt-text)] text-[0.65rem] italic">
          No failing pairs. Toggle &ldquo;Show all&rdquo; to see all{' '}
          {totalPairs} pairs.
        </p>
      )}
    </div>
  );
}
