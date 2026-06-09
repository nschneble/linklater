import { useMemo, useState } from 'react';
import {
  BUNDLES,
  CARD_BUNDLES,
  VAR_GROUPS,
  type Bundle,
  type ThemeVariable,
} from './useThemeOverrides';

interface ContrastCheckerProps {
  /** The current (possibly overridden) values for all editable CSS variables. */
  colorValues: Record<ThemeVariable, string>;
}

/** A foreground/background color pair to test for WCAG contrast compliance. */
interface ContrastPair {
  /** Human-readable description shown in the UI. */
  label: string;
  /** The CSS variable name of the foreground color. */
  foreground: ThemeVariable;
  /** The CSS variable name of the background color. */
  background: ThemeVariable;
  /** WCAG success criterion this pair satisfies. */
  criterion: '1.4.3' | '1.4.11';
  /** Minimum contrast ratio to pass the criterion. */
  threshold: number;
}

const SC_LABELS: Record<ContrastPair['criterion'], string> = {
  '1.4.3': 'SC 1.4.3 Contrast (Minimum)',
  '1.4.11': 'SC 1.4.11 Non-text Contrast',
};

/**
 * Builds the 6 or 7 WCAG contrast pairs the bundle distinguishability
 * contract enforces per bundle. Card bundles (everything except base) add
 * a border/base-bg adjacency check because their border touches the page
 * surface.
 */
function pairsForBundle(bundle: Bundle): ContrastPair[] {
  const pairs: ContrastPair[] = [
    {
      label: 'text / bg',
      foreground: `--${bundle}-text`,
      background: `--${bundle}-bg`,
      criterion: '1.4.3',
      threshold: 4.5,
    },
    {
      label: 'alt-text / bg',
      foreground: `--${bundle}-alt-text`,
      background: `--${bundle}-bg`,
      criterion: '1.4.3',
      threshold: 4.5,
    },
    {
      label: 'border / bg',
      foreground: `--${bundle}-border`,
      background: `--${bundle}-bg`,
      criterion: '1.4.11',
      threshold: 3,
    },
    {
      label: 'highlight / bg',
      foreground: `--${bundle}-highlight`,
      background: `--${bundle}-bg`,
      criterion: '1.4.11',
      threshold: 3,
    },
    {
      label: 'hl-fg / hl',
      foreground: `--${bundle}-highlight-fg`,
      background: `--${bundle}-highlight`,
      criterion: '1.4.3',
      threshold: 4.5,
    },
    {
      label: 'hl-fg / hl-hover',
      foreground: `--${bundle}-highlight-fg`,
      background: `--${bundle}-highlight-hover`,
      criterion: '1.4.3',
      threshold: 4.5,
    },
  ];
  if (CARD_BUNDLES.includes(bundle)) {
    pairs.push({
      label: 'border / base-bg',
      foreground: `--${bundle}-border`,
      background: '--base-bg',
      criterion: '1.4.11',
      threshold: 3,
    });
  }
  return pairs;
}

/**
 * Converts a single 8-bit sRGB channel value (0–1) to its linear light
 * equivalent, as specified by the WCAG 2.1 relative luminance formula.
 */
function linearizeColorComponent(component: number): number {
  return component <= 0.03928
    ? component / 12.92
    : Math.pow((component + 0.055) / 1.055, 2.4);
}

/**
 * Computes the WCAG 2.1 relative luminance of a hex color string.
 * Supports 3-digit and 6-digit hex (with or without `#`).
 * Returns `null` if the input is not a parseable hex color.
 */
function hexToRelativeLuminance(hex: string): number | null {
  const clean = hex.replace('#', '');
  const expanded =
    clean.length === 3
      ? clean
          .split('')
          .map((character) => character + character)
          .join('')
      : clean;

  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) return null;

  const redComponent = parseInt(expanded.substring(0, 2), 16) / 255;
  const greenComponent = parseInt(expanded.substring(2, 4), 16) / 255;
  const blueComponent = parseInt(expanded.substring(4, 6), 16) / 255;

  return (
    0.2126 * linearizeColorComponent(redComponent) +
    0.7152 * linearizeColorComponent(greenComponent) +
    0.0722 * linearizeColorComponent(blueComponent)
  );
}

/**
 * Computes the WCAG 2.1 contrast ratio between two hex colors. Returns
 * `null` if either color is invalid or uses alpha (alpha tokens require
 * composite math the v1 editor does not perform — the compiled bundle
 * tests in `bundles.contrast.test.ts` cover this rigorously).
 */
function computeContrastRatio(hexA: string, hexB: string): number | null {
  const luminanceA = hexToRelativeLuminance(hexA);
  const luminanceB = hexToRelativeLuminance(hexB);
  if (luminanceA === null || luminanceB === null) return null;
  const lighter = Math.max(luminanceA, luminanceB);
  const darker = Math.min(luminanceA, luminanceB);
  return (lighter + 0.05) / (darker + 0.05);
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
    <div className="flex items-center gap-2 py-1 border-b border-[var(--border)] last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-[var(--text)] text-[0.65rem] truncate">
          {pair.label}
        </p>
      </div>
      {ratio === null ? (
        <span
          className="text-[var(--text-subtle)] text-[0.6rem]"
          title="Alpha or invalid value — see compiled tests"
        >
          —
        </span>
      ) : (
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className="w-9 text-[var(--text-muted)] text-[0.6rem] text-right font-mono">
            {ratio.toFixed(2)}
          </span>
          <PassBadge pair={pair} ratio={ratio} />
        </div>
      )}
    </div>
  );
}

interface BundleResult {
  bundle: Bundle;
  label: string;
  pairs: Array<{ pair: ContrastPair; ratio: number | null }>;
  failureCount: number;
  totalCount: number;
}

/**
 * Computes WCAG contrast results for every bundle's contract pairs.
 * Memoized on colorValues so live edits trigger a single recompute.
 */
function useBundleResults(
  colorValues: Record<ThemeVariable, string>,
): BundleResult[] {
  return useMemo(
    () =>
      BUNDLES.map((bundle) => {
        const pairs = pairsForBundle(bundle).map((pair) => ({
          pair,
          ratio: computeContrastRatio(
            colorValues[pair.foreground],
            colorValues[pair.background],
          ),
        }));
        const failureCount = pairs.filter(
          ({ pair, ratio }) => ratio !== null && ratio < pair.threshold,
        ).length;
        const totalCount = pairs.filter(({ ratio }) => ratio !== null).length;
        return {
          bundle,
          label:
            VAR_GROUPS.find((group) => group.bundle === bundle)?.label ??
            bundle,
          pairs,
          failureCount,
          totalCount,
        };
      }),
    [colorValues],
  );
}

/**
 * Displays WCAG 2.1 contrast ratios for every bundle's contract pairs,
 * grouped by bundle in collapsible disclosures. Default view shows only
 * failing pairs so the editor stays scannable at 48 pairs.
 *
 * A live-updating summary at the top announces regressions to screen-reader
 * users (`aria-live="polite"`).
 *
 * Alpha tokens (e.g. dark-mode state bundle bgs `rgb(R G B / α)`) show "—"
 * because the v1 editor does not perform composite math. The compiled
 * bundle tests in `bundles.contrast.test.ts` cover those rigorously.
 */
export default function ContrastChecker({ colorValues }: ContrastCheckerProps) {
  const bundleResults = useBundleResults(colorValues);
  const [failuresOnly, setFailuresOnly] = useState(true);
  const [openBundles, setOpenBundles] = useState<Set<Bundle>>(
    () => new Set(BUNDLES),
  );

  const totalFailures = bundleResults.reduce(
    (sum, result) => sum + result.failureCount,
    0,
  );
  const totalPairs = bundleResults.reduce(
    (sum, result) => sum + result.totalCount,
    0,
  );

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

  return (
    <div className="space-y-2">
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="flex items-center justify-between gap-2"
      >
        <p className="text-[var(--text-muted)] text-[0.65rem]">
          {totalFailures === 0
            ? `All ${totalPairs} pairs passing`
            : `${totalFailures} of ${totalPairs} pairs failing`}
        </p>
        <button
          type="button"
          onClick={() => setFailuresOnly((previous) => !previous)}
          aria-pressed={failuresOnly}
          className="text-[var(--text-muted)] hover:text-[var(--text)] aria-pressed:text-[var(--text)] aria-pressed:font-semibold text-[0.6rem] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)] rounded cursor-pointer"
        >
          {failuresOnly ? 'Show all' : 'Failures only'}
        </button>
      </div>

      {bundleResults.map((result) => {
        const visiblePairs = failuresOnly
          ? result.pairs.filter(
              ({ pair, ratio }) => ratio !== null && ratio < pair.threshold,
            )
          : result.pairs;
        if (visiblePairs.length === 0) return null;
        const isOpen = openBundles.has(result.bundle);
        const contentId = `contrast-${result.bundle}-content`;
        const headingId = `contrast-${result.bundle}-heading`;
        return (
          <section
            key={result.bundle}
            aria-labelledby={headingId}
            className="border-b border-[var(--border)] last:border-0 pb-1.5 last:pb-0"
          >
            <h3 id={headingId} className="m-0">
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={contentId}
                onClick={() => toggleBundle(result.bundle)}
                className="group w-full flex items-center gap-2 py-1 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)] rounded cursor-pointer"
              >
                <i
                  className="fa-solid fa-chevron-right text-[0.5rem] text-[var(--text-subtle)] group-aria-expanded:rotate-90 transition-transform duration-150"
                  aria-hidden="true"
                />
                <span className="text-[var(--text)] text-[0.65rem] font-semibold">
                  {result.label}
                </span>
                <span className="flex-1 text-[var(--text-subtle)] text-[0.6rem] text-right">
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
                    key={`${result.bundle}-${pair.label}`}
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
        <p className="text-[var(--text-subtle)] text-[0.65rem] italic">
          No failing pairs. Toggle &ldquo;Show all&rdquo; to see all{' '}
          {totalPairs} pairs.
        </p>
      )}
    </div>
  );
}
