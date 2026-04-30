import type { ThemeVariable } from './useThemeOverrides';

interface ContrastCheckerProps {
  colorValues: Record<ThemeVariable, string>;
}

interface ContrastPair {
  label: string;
  foreground: ThemeVariable;
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

function linearizeColorComponent(component: number): number {
  return component <= 0.03928
    ? component / 12.92
    : Math.pow((component + 0.055) / 1.055, 2.4);
}

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

function computeContrastRatio(hexA: string, hexB: string): number | null {
  const luminanceA = hexToRelativeLuminance(hexA);
  const luminanceB = hexToRelativeLuminance(hexB);
  if (luminanceA === null || luminanceB === null) return null;
  const lighter = Math.max(luminanceA, luminanceB);
  const darker = Math.min(luminanceA, luminanceB);
  return (lighter + 0.05) / (darker + 0.05);
}

interface PassBadgeProps {
  label: string;
  threshold: number;
  ratio: number;
}

function PassBadge({ label, threshold, ratio }: PassBadgeProps) {
  const passes = ratio >= threshold;
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[0.6rem] font-semibold ${
        passes
          ? 'bg-emerald-900/40 text-emerald-400'
          : 'bg-rose-900/40 text-rose-400'
      }`}
    >
      {label}
    </span>
  );
}

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
                <span className="text-[var(--text-muted)] text-[0.65rem] font-mono w-8 text-right">
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
