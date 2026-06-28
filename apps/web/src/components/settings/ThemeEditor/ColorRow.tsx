import { isValidColorValue, normalizeToSixDigitHex } from './hexColor';
import { isAlphaValue, type ThemeVariable } from './useThemeOverrides';
import { useEffect, useState } from 'react';
import type { TokenContrastFailure } from './contrastResults';

/**
 * How long the describedby failure text waits after the latest keystroke
 * before updating. Stops a half-typed value (e.g. `#3`) from thrashing the
 * note text while the user is mid-edit (BL1).
 */
export const FAILURE_NOTE_DEBOUNCE_MS = 400;

interface ColorRowProps {
  /** Human-readable label for this color row (e.g. "Background", "Border"). */
  label: string;
  /** Human-readable bundle name for aria-label disambiguation. */
  bundleLabel: string;
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
 * A single color variable row in the demoted token tree, with a native color
 * picker, a hex text input, and the slot label.
 *
 * The color picker fires `onOverride` on every change (live preview). The text
 * input only fires on blur, after normalizing and validating the hex value.
 * Invalid hex strings are silently reset to `currentValue` on blur (this is the
 * deep-drawer tree; the human knobs use a louder no-revert format error).
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
  bundleLabel,
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
  const pickerValue = /^#[0-9a-fA-F]{6}$/.test(inputValue)
    ? inputValue
    : '#000000';
  const swatchBackground = isAlpha ? currentValue : pickerValue;
  const pickerAriaLabel = `Color picker for ${bundleLabel} ${label.toLowerCase()}`;
  const textAriaLabel = `Value for ${bundleLabel} ${label.toLowerCase()}`;
  const failureNoteId = `theme-editor-failure-${variable.replace(/^--/, '')}`;
  const failureNote = debouncedFailure
    ? `Fails contrast with ${debouncedFailure.pairLabel} — ${debouncedFailure.ratio.toFixed(1)}:1, needs ${debouncedFailure.threshold}:1`
    : '';

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <label
        className="relative shrink-0 focus-within:ring-2 focus-within:ring-[var(--focus-ring)] focus-within:ring-offset-1 focus-within:ring-offset-[var(--mount-bg)] rounded-md cursor-pointer aria-disabled:cursor-not-allowed"
        aria-disabled={pickerDisabled}
      >
        <span
          className="block w-7 h-7 border border-[var(--mount-border)] rounded-md shadow-sm aria-disabled:opacity-60"
          style={{ backgroundColor: swatchBackground }}
          aria-disabled={pickerDisabled}
        />
        <input
          type="color"
          value={pickerValue}
          onChange={handleColorPickerChange}
          className="absolute inset-0 opacity-0 w-full h-full cursor-pointer disabled:cursor-not-allowed"
          aria-label={pickerAriaLabel}
          disabled={pickerDisabled}
          aria-disabled={pickerDisabled}
        />
      </label>

      <div className="flex-1 min-w-0">
        <p className="text-[var(--mount-text)] text-xs font-medium">{label}</p>
      </div>

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
          className="flex basis-full items-center gap-1 text-[var(--alert-highlight)] text-[0.6rem]"
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
