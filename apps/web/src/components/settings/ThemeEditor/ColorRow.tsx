import {
  isSixDigitHex,
  isValidColorValue,
  normalizeToSixDigitHex,
} from './hexColor';
import { isAlphaValue, type ThemeVariable } from './useThemeOverrides';
import { useEffect, useState } from 'react';
import type { TokenContrastFailure } from './contrastResults';

/**
 * How long the describedby failure text waits after the latest keystroke
 * before updating. Stops a half-typed value (e.g. `#3`) from thrashing the
 * note text while the user is mid-edit (BL1).
 */
export const FAILURE_NOTE_DEBOUNCE_MS = 400;

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
 * Layers the color on top of the checkerboard so alpha shows through — a
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
 * A single color variable row — a native color picker, a hex text input, and
 * the slot label — rendered under the selected bundle's tabpanel.
 *
 * The accessible names are slot-only ("Color picker for Background") rather than
 * bundle-qualified: the enclosing tabpanel already establishes which bundle the
 * row belongs to, so a bundle prefix would be redundant (SC 2.4.6).
 *
 * The color picker fires `onOverride` on every change (live preview). The text
 * input only fires on blur, after normalizing and validating the hex value.
 * Invalid hex strings are silently reset to `currentValue` on blur — no kept
 * text, no error flag, nothing committed.
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

  useEffect(() => {
    setInputValue(currentValue);
  }, [currentValue]);

  // Debounce the visible/announced failure note so a mid-edit value (e.g.
  // `#3`) doesn't thrash it. `aria-invalid` is NOT debounced – it tracks the
  // live state so the input styling reflects the current value immediately.
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
  }

  function handleTextBlur() {
    const normalized = normalizeToSixDigitHex(inputValue);
    if (isValidColorValue(normalized)) {
      setInputValue(normalized);
      onOverride(variable, normalized);
    } else {
      setInputValue(currentValue);
    }
  }

  const isAlpha = isAlphaValue(currentValue);
  // The native color picker cannot represent alpha (it only does 6-digit hex),
  // so alpha rows disable it and keep editing through the text input.
  const pickerDisabled = isAlpha;
  const pickerValue = isSixDigitHex(inputValue) ? inputValue : '#000000';
  const swatchBackground = isAlpha ? currentValue : pickerValue;
  const swatchStyle = buildSwatchStyle(swatchBackground);
  const pickerAriaLabel = `Color picker for ${label}`;
  const textAriaLabel = `Value for ${label}`;
  const failureNoteId = `theme-editor-failure-${variable.replace(/^--/, '')}`;
  // Names only the failing pair's OTHER endpoint (this row IS the near one, so
  // its slot is implied by the row label + the input's accessible name). The
  // ratio uses a word relation ("below the … minimum") rather than "<" because
  // screen readers drop punctuation by default, which would collapse "1.8:1 <
  // 4.5:1" to two bare numbers with no relation.
  const failureNote = debouncedFailure
    ? `${debouncedFailure.partnerLabel} contrast is too low (${debouncedFailure.ratio.toFixed(1)}:1, below the ${debouncedFailure.threshold}:1 minimum).`
    : '';

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      {/*
        The slot label reads first but sits LAST in source order so the picker
        and hex input stay DOM-adjacent siblings: focus moves picker → input
        with nothing in between (Wave 4 A — the two editors of one value read as
        a single paired control). `order-first` restores the visual lead.
      */}
      <div className="order-first flex-1 min-w-0">
        <p className="text-[var(--mount-text)] text-xs font-medium">{label}</p>
      </div>

      <label
        className="relative shrink-0 focus-within:ring-2 focus-within:ring-[var(--focus-ring)] focus-within:ring-offset-1 focus-within:ring-offset-[var(--mount-bg)] rounded-md cursor-pointer aria-disabled:cursor-not-allowed"
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
        aria-invalid={failure ? 'true' : undefined}
        aria-describedby={debouncedFailure ? failureNoteId : undefined}
        className="w-28 px-2 py-1 bg-[var(--mount-input-bg)] border border-[var(--mount-border)] aria-invalid:border-[var(--alert-border)] text-[var(--mount-text)] text-[0.65rem] font-mono focus:outline-none focus:ring-1 focus:ring-[var(--focus-ring)] focus:border-transparent rounded-md"
        placeholder="#000000"
        autoComplete="off"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
      />

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
