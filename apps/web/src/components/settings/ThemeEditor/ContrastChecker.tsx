import type { ThemeVariable } from './useThemeOverrides';

interface ContrastCheckerProps {
  /** The current (possibly overridden) hex values for all editable CSS variables. */
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
}

const CONTRAST_PAIRS: ContrastPair[] = [
  { label: 'Text / Background', foreground: '--text', background: '--bg' },
  { label: 'Text / Surface', foreground: '--text', background: '--bg-surface' },
  {
    label: 'Text / Elevated',
    foreground: '--text',
    background: '--bg-elevated',
  },
  {
    label: 'Muted / Background',
    foreground: '--text-muted',
    background: '--bg',
  },
  {
    label: 'Subtle / Background',
    foreground: '--text-subtle',
    background: '--bg',
  },
  { label: 'Text / Input', foreground: '--text', background: '--bg-input' },
  {
    label: 'Accent fg / Accent',
    foreground: '--accent-fg',
    background: '--accent',
  },
];

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
 * Returns `null` if the input is not a valid hex color.
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
 * Computes the WCAG 2.1 contrast ratio between two hex colors.
 * Returns `null` if either color is invalid.
 * A ratio of 4.5:1 meets WCAG AA for normal text; 7:1 meets AAA.
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
  /** The WCAG level label, e.g. `'AA'` or `'AAA'`. */
  label: string;
  /** The minimum contrast ratio required to pass this level. */
  threshold: number;
  /** The actual computed contrast ratio to test against the threshold. */
  ratio: number;
}

/**
 * A small badge showing whether a contrast ratio meets a given WCAG threshold.
 * Green when passing, red when failing.
 */
function PassBadge({ label, threshold, ratio }: PassBadgeProps) {
  const passes = ratio >= threshold;
  return (
    <span
      aria-label={passes ? `${label}: pass` : `${label}: fail`}
      className={`inline-flex items-center px-1.5 py-0.5 text-[0.6rem] font-semibold rounded ${
        passes
          ? "bg-[var(--success-bg)] text-[var(--success-text)] [[data-theme='nouvelle-vague']_&]:bg-[var(--bg-elevated)] [[data-theme='nouvelle-vague']_&]:text-[var(--text-muted)]"
          : "bg-[var(--alert-bg)] text-[var(--alert-text)] [[data-theme='nouvelle-vague']_&]:bg-[var(--bg-elevated)] [[data-theme='nouvelle-vague']_&]:text-[var(--text)]"
      }`}
    >
      {label}
    </span>
  );
}

/**
 * Displays WCAG 2.1 AA and AAA contrast ratios for the key color pairs used
 * in the Linklater UI. Re-evaluates automatically whenever `colorValues` changes
 * (i.e. on every live edit in the theme editor).
 */
export default function ContrastChecker({ colorValues }: ContrastCheckerProps) {
  return (
    <div className="space-y-1">
      {CONTRAST_PAIRS.map((pair) => {
        const ratio = computeContrastRatio(
          colorValues[pair.foreground],
          colorValues[pair.background],
        );

        return (
          <div
            key={pair.label}
            className="flex items-center gap-2 py-1.5 border-b border-[var(--border)] last:border-0"
          >
            <div className="flex-1 min-w-0">
              <p className="text-[var(--text)] text-xs truncate">
                {pair.label}
              </p>
            </div>

            {ratio === null ? (
              <span className="text-[var(--text-subtle)] text-[0.65rem]">
                —
              </span>
            ) : (
              <div className="flex items-center gap-1 flex-shrink-0">
                <span className="w-8 text-[var(--text-muted)] text-[0.65rem] text-right font-mono">
                  {ratio.toFixed(1)}
                </span>
                <PassBadge label="AA" threshold={4.5} ratio={ratio} />
                <PassBadge label="AAA" threshold={7} ratio={ratio} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
