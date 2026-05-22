import { useEffect, useState } from 'react';
import { VAR_GROUPS, type ThemeVariable } from './useThemeOverrides';

interface ColorEditorProps {
  /** The current (possibly overridden) hex values for all editable CSS variables. */
  colorValues: Record<ThemeVariable, string>;
  /** Called when the user changes a color via the picker or text input. */
  onOverride: (variable: ThemeVariable, value: string) => void;
}

interface ColorRowProps {
  /** Human-readable label for this color row (e.g. "Base", "Surface"). */
  label: string;
  /** The CSS variable name this row controls (e.g. `'--bg'`). */
  variable: ThemeVariable;
  /** The current resolved hex value of this variable. */
  currentValue: string;
  /** Called when the user commits a new color value. */
  onOverride: (variable: ThemeVariable, value: string) => void;
}

/**
 * Expands a 3-digit hex shorthand (e.g. `#abc`) to 6-digit form (`#aabbcc`).
 * Returns the input unchanged if it is already 6-digit or not a valid 3-digit hex.
 */
function normalizeToSixDigitHex(value: string): string {
  const trimmed = value.trim();
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    const digits = trimmed.slice(1);
    return `#${digits[0]}${digits[0]}${digits[1]}${digits[1]}${digits[2]}${digits[2]}`;
  }
  return trimmed;
}

/**
 * A single color variable row with a native color picker, a hex text input,
 * and the variable name in monospace.
 *
 * The color picker fires `onOverride` on every change (live preview). The text
 * input only fires on blur, after normalizing and validating the hex value.
 * Invalid hex strings are silently reset to `currentValue` on blur.
 *
 * The local `inputValue` state keeps the text input controlled independently
 * of `currentValue` so the user can type partial values without them being
 * overwritten by the theme change effect.
 */
function ColorRow({
  label,
  variable,
  currentValue,
  onOverride,
}: ColorRowProps) {
  const [inputValue, setInputValue] = useState(currentValue);

  useEffect(() => {
    setInputValue(currentValue);
  }, [currentValue]);

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
    if (/^#[0-9a-fA-F]{6}$/.test(normalized)) {
      setInputValue(normalized);
      onOverride(variable, normalized);
    } else {
      setInputValue(currentValue);
    }
  }

  const pickerValue = /^#[0-9a-fA-F]{6}$/.test(inputValue)
    ? inputValue
    : '#000000';

  return (
    <div className="flex items-center gap-2">
      <label className="relative flex-shrink-0 cursor-pointer">
        <span
          className="block w-7 h-7 border border-[var(--border)] rounded-md shadow-sm"
          style={{ backgroundColor: currentValue }}
        />
        <input
          type="color"
          value={pickerValue}
          onChange={handleColorPickerChange}
          className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
          aria-label={`Color picker for ${label}`}
        />
      </label>

      <div className="flex-1 min-w-0">
        <p className="text-[var(--text)] text-xs font-medium">{label}</p>
        <p className="text-[var(--text-subtle)] text-[0.65rem] font-mono">
          {variable}
        </p>
      </div>

      <input
        type="text"
        value={inputValue}
        onChange={handleTextChange}
        onBlur={handleTextBlur}
        aria-label={`Hex value for ${label}`}
        className="w-20 px-2 py-1 bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text)] text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[var(--accent)] focus:border-transparent rounded-md"
        placeholder="#000000"
        maxLength={7}
        spellCheck={false}
      />
    </div>
  );
}

/**
 * Renders the full list of editable color variables, grouped by `VAR_GROUPS`.
 * Each group has a label and a stack of `ColorRow` components.
 */
export default function ColorEditor({
  colorValues,
  onOverride,
}: ColorEditorProps) {
  return (
    <div className="space-y-5">
      {VAR_GROUPS.map((group) => (
        <div key={group.label}>
          <p className="mb-2 text-[var(--text-subtle)] text-[0.65rem] uppercase tracking-wide font-semibold">
            {group.label}
          </p>
          <div className="space-y-2.5">
            {group.items.map(({ variable, label }) => (
              <ColorRow
                key={variable}
                label={label}
                variable={variable}
                currentValue={colorValues[variable]}
                onOverride={onOverride}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
