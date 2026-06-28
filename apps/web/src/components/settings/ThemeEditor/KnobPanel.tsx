import KnobRow from './KnobRow';
import type { ThemeVariable } from './useThemeOverrides';
import type { TokenContrastFailure } from './contrastResults';

interface KnobDefinition {
  /** Stable id fragment for deriving element ids. */
  id: string;
  /** Visible word that leads every accessible name. */
  word: string;
  /** CSS variables this knob sets; the first is the representative value. */
  tokens: ThemeVariable[];
  /** Static surface-naming help for multi-token knobs (empty otherwise). */
  helpText: string;
}

/**
 * The five human knobs, mapped to the tokens each sets. Multi-token knobs set
 * every constituent together (a flatten) and disclose the spanned surfaces.
 */
export const KNOBS: ReadonlyArray<KnobDefinition> = [
  { id: 'page', word: 'Page', tokens: ['--base-bg'], helpText: '' },
  { id: 'cards', word: 'Cards', tokens: ['--mount-bg'], helpText: '' },
  {
    id: 'accent',
    word: 'Accent',
    tokens: ['--base-highlight', '--mount-highlight', '--orbit-highlight'],
    helpText: 'Sets the accent on the page, cards, and menus.',
  },
  {
    id: 'text',
    word: 'Text',
    tokens: ['--base-text', '--mount-text', '--orbit-text'],
    helpText: 'Sets the text color on the page, cards, and menus.',
  },
  { id: 'alerts', word: 'Alerts', tokens: ['--alert-bg'], helpText: '' },
];

interface KnobPanelProps {
  /** Current resolved values for all editable variables. */
  colorValues: Record<ThemeVariable, string>;
  /**
   * Worst failing pair keyed by EITHER endpoint (`pairsTouchingToken`), so a
   * too-light Page/Cards/Alerts background flags on its knob.
   */
  knobFailures: Map<string, TokenContrastFailure>;
  /** Flattens every constituent token of a knob to the new value. */
  onKnobOverride: (variables: ThemeVariable[], value: string) => void;
}

/**
 * The five human knobs (Page, Cards, Accent, Text, Alerts) rendered at the top
 * of the Colors card, above the "show all colors" drawer. Wrapped in a named
 * `role="group"` (not a heading) so the document outline stays h2 "Colors" →
 * knob group → "show all colors" → h3 bundles.
 */
export default function KnobPanel({
  colorValues,
  knobFailures,
  onKnobOverride,
}: KnobPanelProps) {
  return (
    <div role="group" aria-label="Main colors" className="space-y-2">
      {KNOBS.map((knob) => (
        <KnobRow
          key={knob.id}
          id={knob.id}
          word={knob.word}
          tokens={knob.tokens}
          helpText={knob.helpText}
          colorValues={colorValues}
          knobFailures={knobFailures}
          onKnobOverride={onKnobOverride}
        />
      ))}
    </div>
  );
}
