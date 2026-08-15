import { FOCUS_RING } from '../../../lib/styles';
import { isAlphaValue, type ThemeVariable } from './useThemeOverrides';
import {
  isSixDigitHex,
  isValidColorValue,
  normalizeToSixDigitHex,
} from './hexColor';
import { useEffect, useState } from 'react';
import type { TokenContrastFailure } from './contrastResults.notes';

/**
 * How long the describedby failure text waits after the latest keystroke
 * before updating. Stops a half-typed value (e.g. `#3`) from thrashing the
 * note text while the user is mid-edit (BL1).
 */
export const FAILURE_NOTE_DEBOUNCE_MS = 400;

/**
 * What a row says when it refuses what was typed. It names a shape that
 * works rather than only reporting the refusal: the editor accepts a
 * narrower set of values than CSS does, so a user whose perfectly good
 * CSS color was turned away has no other way to learn what would be
 * taken (SC 3.3.1, SC 3.3.3).
 */
export const REFUSED_VALUE_MESSAGE =
  'Not a color the editor can read. Use a hex value like #aabbcc.';

/*
 * A transparency checkerboard, painted from two translucent cell colors so it
 * self-normalizes over any theme surface (light or dark) instead of glaring
 * white in dark themes. Composited over `--mount-input-bg` as the base.
 */
const SWATCH_CHECKERBOARD =
  'conic-gradient(' +
  'rgb(255 255 255 / 0.22) 25%,' +
  'rgb(0 0 0 / 0.22) 0 50%,' +
  'rgb(255 255 255 / 0.22) 0 75%,' +
  'rgb(0 0 0 / 0.22) 0)';

/*
 * Layers the color on top of the checkerboard so alpha shows through: a
 * semi-transparent value reveals the pattern, while an opaque value (alpha FF)
 * fully occludes it, leaving those rows visually unchanged. The color layer
 * MUST stay first in `background-image` for that occlusion to hold.
 */
export function buildSwatchStyle(background: string): React.CSSProperties {
  return {
    backgroundColor: 'var(--mount-input-bg)',
    backgroundImage: `linear-gradient(${background}, ${background}), ${SWATCH_CHECKERBOARD}`,
    backgroundSize: '100% 100%, 8px 8px',
  };
}

interface ColorRowProps {
  /** Human-readable label for this color row (e.g. "Background", "Border"). */
  label: string;
  /** The CSS variable name this row controls (e.g. `'--alert-border'`). */
  variable: ThemeVariable;
  /** The current resolved value of this variable. */
  currentValue: string;
  /** This token's worst failing contrast pair, or `undefined` when it passes. */
  failure: TokenContrastFailure | undefined;
  /** Called when the user commits a new color value. */
  onOverride: (variable: ThemeVariable, value: string) => void;
}

/**
 * A single color variable row, rendered under the selected bundle's
 * tabpanel: a native color picker, a hex text input, and the slot label.
 *
 * The accessible names are slot-only ("Color picker for Background") rather than
 * bundle-qualified: the enclosing tabpanel already establishes which bundle the
 * row belongs to, so a bundle prefix would be redundant (SC 2.4.6).
 *
 * The color picker fires `onOverride` on every change (live preview). The text
 * input only fires on blur, after normalizing and validating the value.
 * A value the editor cannot read is put back to the current one and
 * nothing is committed, but the row says so in an alert naming a shape
 * that works. A revert with no reason leaves the typed text gone and
 * nothing to explain it, which is the one thing a refusal must not do.
 *
 * Alpha rows (whose value is `rgb(...)` or `#RRGGBBAA`) disable the native
 * picker (it cannot represent alpha) and keep the text input editable.
 *
 * The local `inputValue` state keeps the text input controlled independently
 * of `currentValue` so the user can type partial values without them being
 * overwritten by the theme change effect.
 */
export default function ColorRow({
  label,
  variable,
  currentValue,
  failure,
  onOverride,
}: ColorRowProps) {
  const [inputValue, setInputValue] = useState(currentValue);

  // set when a blur turns the value away; the next keystroke clears it
  const [valueRefused, setValueRefused] = useState(false);

  useEffect(() => {
    setInputValue(currentValue);
    setValueRefused(false);
  }, [currentValue]);

  // flag and note flip together; silence beats an unexplained flag
  const [debouncedFailure, setDebouncedFailure] = useState(failure);
  useEffect(() => {
    const timer = setTimeout(
      () => setDebouncedFailure(failure),
      FAILURE_NOTE_DEBOUNCE_MS,
    );
    return () => clearTimeout(timer);
  }, [failure]);

  function handleColorPickerChange(event: React.ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    setInputValue(value);
    onOverride(variable, value);
  }

  function handleTextChange(event: React.ChangeEvent<HTMLInputElement>) {
    setInputValue(event.target.value);
    setValueRefused(false);
  }

  function handleTextBlur() {
    const normalized = normalizeToSixDigitHex(inputValue);
    if (isValidColorValue(normalized)) {
      setValueRefused(false);
      setInputValue(normalized);
      onOverride(variable, normalized);
    } else {
      setValueRefused(true);
      setInputValue(currentValue);
    }
  }

  const isAlpha = isAlphaValue(currentValue);
  // native picker can't do alpha, so alpha rows edit via the text input
  const pickerDisabled = isAlpha;
  const pickerValue = isSixDigitHex(inputValue) ? inputValue : '#000000';
  const swatchBackground = isAlpha ? currentValue : pickerValue;
  const swatchStyle = buildSwatchStyle(swatchBackground);
  const pickerAriaLabel = `Color picker for ${label}`;
  const textAriaLabel = `Value for ${label}`;
  const rowId = variable.replace(/^--/, '');
  const failureNoteId = `theme-editor-failure-${rowId}`;
  const refusedNoteId = `theme-editor-refused-${rowId}`;
  const failureNote = debouncedFailure
    ? `${debouncedFailure.noteSubject} is too low (${debouncedFailure.ratio.toFixed(1)}:1)`
    : '';

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      {/*
        The slot label reads first but sits LAST in source order so the picker
        and hex input stay DOM-adjacent: focus moves picker → input with
        nothing between. `order-first` restores the visual lead.
      */}
      <div className="order-first flex-1 min-w-0">
        <p className="text-[var(--mount-text)] text-xs font-medium">{label}</p>
      </div>

      <label
        className="relative shrink-0 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--focus-ring)] forced-colors:focus-within:outline-[Highlight] rounded-md cursor-pointer aria-disabled:cursor-not-allowed"
        aria-disabled={pickerDisabled}
      >
        <span
          className="block w-7 h-7 border border-[var(--mount-border)] forced-colors:border-[CanvasText] rounded-md shadow-sm aria-disabled:opacity-60"
          style={swatchStyle}
          aria-disabled={pickerDisabled}
        />
        <input
          type="color"
          value={pickerValue}
          onChange={handleColorPickerChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
          aria-label={pickerAriaLabel}
          disabled={pickerDisabled}
          aria-disabled={pickerDisabled}
        />
      </label>

      <input
        type="text"
        value={inputValue}
        onChange={handleTextChange}
        onBlur={handleTextBlur}
        aria-label={textAriaLabel}
        aria-invalid={debouncedFailure || valueRefused ? 'true' : undefined}
        aria-errormessage={valueRefused ? refusedNoteId : undefined}
        aria-describedby={debouncedFailure ? failureNoteId : undefined}
        className={`w-28 px-2 py-1 bg-[var(--mount-input-bg)] border border-[var(--mount-border)] aria-invalid:border-[var(--alert-border)] text-[var(--mount-text)] text-[0.65rem] font-mono ${FOCUS_RING} rounded-md`}
        placeholder="#000000"
        autoComplete="off"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
      />

      {/* The refusal is an alert, not a description: it reports what
          just happened to the input rather than standing commentary on
          the value, and the blur that fires it has already moved focus
          off the field, so a description would go unread. */}
      {valueRefused && (
        <p
          id={refusedNoteId}
          role="alert"
          className="flex basis-full items-center gap-1 text-[var(--mount-alt-text)] text-[0.6rem]"
        >
          <i
            className="fa-solid fa-circle-exclamation text-[0.55rem]"
            aria-hidden="true"
          />
          {REFUSED_VALUE_MESSAGE}
        </p>
      )}

      {debouncedFailure && (
        <p
          id={failureNoteId}
          className="flex basis-full items-center gap-1 text-[var(--mount-alt-text)] text-[0.6rem]"
        >
          <i
            className="fa-solid fa-triangle-exclamation text-[0.55rem]"
            aria-hidden="true"
          />
          {failureNote}
        </p>
      )}
    </div>
  );
}
