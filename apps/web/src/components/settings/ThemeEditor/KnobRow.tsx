import { FAILURE_NOTE_DEBOUNCE_MS } from './ColorRow';
import {
  isSixDigitHex,
  isValidColorValue,
  normalizeToSixDigitHex,
} from './hexColor';
import { isAlphaValue, type ThemeVariable } from './useThemeOverrides';
import { useEffect, useMemo, useState } from 'react';
import type { TokenContrastFailure } from './contrastResults';

/** Help text shown when a multi-token knob's surfaces have drifted apart. */
const DIVERGENCE_HELP =
  'Set separately in some areas — changing this resets them to match.';

/** Human surface name per bundle, used to name a knob's worst failing pair. */
const SURFACE_NAMES: Record<string, string> = {
  base: 'the page',
  mount: 'cards',
  orbit: 'menus',
  alert: 'alerts',
  warn: 'warnings',
  info: 'info',
  success: 'success',
};

interface KnobRowProps {
  /** Stable id fragment (e.g. `'accent'`) for deriving element ids. */
  id: string;
  /** Visible word that leads every accessible name (e.g. "Accent"). */
  word: string;
  /**
   * The CSS variables this knob sets. The first is the REPRESENTATIVE value
   * shown in the picker/hex; editing flattens every token to the new value.
   */
  tokens: ThemeVariable[];
  /**
   * Static help naming the surfaces a multi-token knob spans (SC 3.3.2). Empty
   * for single-token knobs, which need no surface disclosure.
   */
  helpText: string;
  /** Current resolved values for all editable variables. */
  colorValues: Record<ThemeVariable, string>;
  /**
   * Worst failing pair keyed by EITHER endpoint token (`pairsTouchingToken`),
   * so a too-light knob background flags on the knob, not buried in the drawer.
   */
  knobFailures: Map<string, TokenContrastFailure>;
  /** Flattens every constituent token to `value` in one write. */
  onKnobOverride: (variables: ThemeVariable[], value: string) => void;
}

function bundleOf(token: ThemeVariable): string {
  return token.split('-')[2] ?? '';
}

/**
 * One of the five human knobs: a swatch + native color picker + hex input + a
 * leading visible word, grouped under a `role="group"` named by that word.
 *
 * Multi-token knobs (Accent, Text) FLATTEN — editing snaps every constituent
 * token to the new value, destroying any per-surface value set in the drawer.
 * Divergence (constituents differ) is disclosed by swapping the static help to
 * a reset warning and surfacing it as a visible hint; the picker shows the
 * representative (`tokens[0]`) value, never a fake "mixed" swatch.
 *
 * Unlike the drawer rows, an invalid hex on blur is NOT silently reverted: the
 * typed text is kept, `aria-invalid` is set, and a distinct format-error note
 * appears (separate from the contrast note).
 */
export default function KnobRow({
  id,
  word,
  tokens,
  helpText,
  colorValues,
  knobFailures,
  onKnobOverride,
}: KnobRowProps) {
  const representative = colorValues[tokens[0]] ?? '';
  const isMultiToken = tokens.length > 1;

  const diverged =
    isMultiToken && new Set(tokens.map((token) => colorValues[token])).size > 1;

  const [inputValue, setInputValue] = useState(representative);
  const [formatError, setFormatError] = useState(false);

  // Keep the hex text in sync with the representative value (live picker → hex).
  // A user's invalid text never reaches `colorValues` (we don't commit it), so
  // this effect can't clobber a typed-but-unblurred bad value.
  useEffect(() => {
    setInputValue(representative);
  }, [representative]);

  // Worst failing pair across every constituent token (both endpoints).
  const worstFailure = useMemo(() => {
    let best:
      | { token: ThemeVariable; failure: TokenContrastFailure; deficit: number }
      | undefined;
    for (const token of tokens) {
      const failure = knobFailures.get(token);
      if (!failure) continue;
      const deficit = failure.threshold - failure.ratio;
      if (!best || deficit > best.deficit) best = { token, failure, deficit };
    }
    return best;
  }, [tokens, knobFailures]);

  // Debounce the contrast note like the drawer rows so a mid-drag value does
  // not thrash it; `aria-invalid` tracks the live state undebounced.
  const [debouncedFailure, setDebouncedFailure] = useState(worstFailure);
  useEffect(() => {
    const timer = setTimeout(
      () => setDebouncedFailure(worstFailure),
      FAILURE_NOTE_DEBOUNCE_MS,
    );
    return () => clearTimeout(timer);
  }, [worstFailure]);

  function commit(value: string) {
    setFormatError(false);
    onKnobOverride(tokens, value);
  }

  function handlePickerChange(event: React.ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    setInputValue(value);
    commit(value);
  }

  function handleTextChange(event: React.ChangeEvent<HTMLInputElement>) {
    setInputValue(event.target.value);
    // Clear a stale format error as the user retypes; re-validated on blur.
    if (formatError) setFormatError(false);
  }

  function handleTextBlur() {
    const normalized = normalizeToSixDigitHex(inputValue);
    if (isValidColorValue(normalized)) {
      setInputValue(normalized);
      commit(normalized);
    } else {
      // No silent revert: keep the typed text, flag it, show a format error.
      setFormatError(true);
    }
  }

  const isAlpha = isAlphaValue(representative);
  const pickerDisabled = isAlpha;
  const pickerValue = isSixDigitHex(inputValue) ? inputValue : '#000000';
  const swatchBackground = isAlpha ? representative : pickerValue;

  const wordId = `theme-editor-knob-${id}-word`;
  const helpId = `theme-editor-knob-${id}-help`;
  const formatErrorId = `theme-editor-knob-${id}-format`;
  const failureId = `theme-editor-knob-${id}-failure`;

  const hasHelp = isMultiToken;
  const helpMessage = diverged ? DIVERGENCE_HELP : helpText;

  const ariaInvalid = formatError || worstFailure !== undefined;

  const describedbyIds: string[] = [];
  if (hasHelp) describedbyIds.push(helpId);
  if (formatError) {
    describedbyIds.push(formatErrorId);
  } else if (debouncedFailure) {
    describedbyIds.push(failureId);
  }
  const describedby = describedbyIds.length
    ? describedbyIds.join(' ')
    : undefined;

  const failureSurface = debouncedFailure
    ? (SURFACE_NAMES[bundleOf(debouncedFailure.token)] ??
      bundleOf(debouncedFailure.token))
    : '';
  const failureNote = debouncedFailure
    ? isMultiToken
      ? `${word} on ${failureSurface} fails contrast — ${debouncedFailure.failure.ratio.toFixed(1)}:1, needs ${debouncedFailure.failure.threshold}:1`
      : `${word} fails contrast — ${debouncedFailure.failure.ratio.toFixed(1)}:1, needs ${debouncedFailure.failure.threshold}:1`
    : '';

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <div
        role="group"
        aria-labelledby={wordId}
        className="flex flex-1 min-w-0 items-center gap-2"
      >
        <label
          className="relative shrink-0 focus-within:ring-2 focus-within:ring-[var(--focus-ring)] focus-within:ring-offset-1 focus-within:ring-offset-[var(--mount-bg)] rounded-md cursor-pointer aria-disabled:cursor-not-allowed"
          aria-disabled={pickerDisabled}
        >
          <span
            className="block w-8 h-8 border border-[var(--mount-border)] rounded-md shadow-sm aria-disabled:opacity-60"
            style={{ backgroundColor: swatchBackground }}
            aria-disabled={pickerDisabled}
          />
          <input
            type="color"
            value={pickerValue}
            onChange={handlePickerChange}
            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer disabled:cursor-not-allowed"
            aria-label={`${word} color`}
            disabled={pickerDisabled}
            aria-disabled={pickerDisabled}
          />
        </label>

        <div className="flex-1 min-w-0">
          <span
            id={wordId}
            className="block text-[var(--mount-text)] text-xs font-semibold"
          >
            {word}
          </span>
        </div>

        <input
          type="text"
          value={inputValue}
          onChange={handleTextChange}
          onBlur={handleTextBlur}
          aria-label={`${word} color hex value`}
          aria-invalid={ariaInvalid ? 'true' : undefined}
          aria-describedby={describedby}
          className="w-28 px-2 py-1 bg-[var(--mount-input-bg)] border border-[var(--mount-border)] aria-invalid:border-[var(--alert-border)] text-[var(--mount-text)] text-[0.65rem] font-mono focus:outline-none focus:ring-1 focus:ring-[var(--focus-ring)] focus:border-transparent rounded-md"
          placeholder="#000000"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />
      </div>

      {hasHelp && (
        <span
          id={helpId}
          className={
            diverged
              ? 'basis-full text-[var(--mount-alt-text)] text-[0.6rem]'
              : 'sr-only'
          }
        >
          {helpMessage}
        </span>
      )}

      {formatError ? (
        <p
          id={formatErrorId}
          className="flex basis-full items-center gap-1 text-[var(--alert-highlight)] text-[0.6rem]"
        >
          <i
            className="fa-solid fa-triangle-exclamation text-[0.55rem]"
            aria-hidden="true"
          />
          Not a valid hex color — use #RRGGBB
        </p>
      ) : (
        debouncedFailure && (
          <p
            id={failureId}
            className="flex basis-full items-center gap-1 text-[var(--alert-highlight)] text-[0.6rem]"
          >
            <i
              className="fa-solid fa-triangle-exclamation text-[0.55rem]"
              aria-hidden="true"
            />
            {failureNote}
          </p>
        )
      )}
    </div>
  );
}
