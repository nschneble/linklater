import { useEffect, useState } from 'react';
import {
  VAR_GROUPS,
  isAlphaValue,
  type Bundle,
  type ThemeVariable,
} from './useThemeOverrides';

interface ColorEditorProps {
  /** The current (possibly overridden) values for all editable CSS variables. */
  colorValues: Record<ThemeVariable, string>;
  /** Called when the user changes a color via the picker or text input. */
  onOverride: (variable: ThemeVariable, value: string) => void;
  /** Called when the user clicks a per-bundle Reset button. */
  onResetBundle: (bundle: Bundle) => void;
}

interface ColorRowProps {
  /** Human-readable label for this color row (e.g. "Background", "Border"). */
  label: string;
  /** Human-readable bundle name for aria-label disambiguation. */
  bundleLabel: string;
  /** The CSS variable name this row controls (e.g. `'--alert-border'`). */
  variable: ThemeVariable;
  /** The current resolved value of this variable. */
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
 * Alpha rows (whose value is `rgb(...)` or `#RRGGBBAA`) disable the native
 * picker (it cannot represent alpha) and keep the text input editable.
 *
 * The local `inputValue` state keeps the text input controlled independently
 * of `currentValue` so the user can type partial values without them being
 * overwritten by the theme change effect.
 */
function ColorRow({
  label,
  bundleLabel,
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
    if (
      /^#[0-9a-fA-F]{6}$/.test(normalized) ||
      /^#[0-9a-fA-F]{8}$/.test(normalized) ||
      /^rgba?\(/i.test(normalized)
    ) {
      setInputValue(normalized);
      onOverride(variable, normalized);
    } else {
      setInputValue(currentValue);
    }
  }

  const isAlpha = isAlphaValue(currentValue);
  const pickerValue = /^#[0-9a-fA-F]{6}$/.test(inputValue)
    ? inputValue
    : '#000000';
  const swatchBackground = isAlpha ? currentValue : pickerValue;
  const pickerAriaLabel = `Color picker for ${bundleLabel} ${label.toLowerCase()}`;
  const textAriaLabel = `Value for ${bundleLabel} ${label.toLowerCase()}`;

  return (
    <div className="flex items-center gap-2">
      <label
        className="relative flex-shrink-0 cursor-pointer rounded-md aria-disabled:cursor-not-allowed focus-within:ring-2 focus-within:ring-[var(--accent)] focus-within:ring-offset-1 focus-within:ring-offset-[var(--bg-surface)]"
        aria-disabled={isAlpha}
      >
        <span
          className="block w-7 h-7 border border-[var(--border)] rounded-md shadow-sm aria-disabled:opacity-60"
          style={{ backgroundColor: swatchBackground }}
          aria-disabled={isAlpha}
        />
        <input
          type="color"
          value={pickerValue}
          onChange={handleColorPickerChange}
          className="absolute inset-0 opacity-0 w-full h-full cursor-pointer disabled:cursor-not-allowed"
          aria-label={pickerAriaLabel}
          disabled={isAlpha}
          aria-disabled={isAlpha}
        />
      </label>

      <div className="flex-1 min-w-0">
        <p className="text-[var(--text)] text-xs font-medium">{label}</p>
        <p className="text-[var(--text-subtle)] text-[0.65rem] font-mono truncate">
          {variable}
        </p>
      </div>

      <input
        type="text"
        value={inputValue}
        onChange={handleTextChange}
        onBlur={handleTextBlur}
        aria-label={textAriaLabel}
        className="w-28 px-2 py-1 bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text)] text-[0.65rem] font-mono focus:outline-none focus:ring-1 focus:ring-[var(--accent)] focus:border-transparent rounded-md"
        placeholder="#000000"
        spellCheck={false}
      />
    </div>
  );
}

/**
 * Renders the full list of editable color variables, grouped by bundle.
 * Each bundle is a collapsible disclosure with its own Reset button.
 * The `base` bundle defaults to open; others collapsed.
 */
export default function ColorEditor({
  colorValues,
  onOverride,
  onResetBundle,
}: ColorEditorProps) {
  const [openBundles, setOpenBundles] = useState<Set<Bundle>>(
    () => new Set(['base']),
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

  function expandAll() {
    setOpenBundles(new Set(VAR_GROUPS.map((group) => group.bundle)));
  }

  function collapseAll() {
    setOpenBundles(new Set());
  }

  const allOpen = openBundles.size === VAR_GROUPS.length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[var(--text-subtle)] text-[0.6rem]">
          {VAR_GROUPS.length} bundles · {VAR_GROUPS.length * 7} tokens
        </p>
        <button
          type="button"
          onClick={allOpen ? collapseAll : expandAll}
          className="text-[var(--text-muted)] hover:text-[var(--text)] text-[0.65rem] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)] rounded cursor-pointer"
        >
          {allOpen ? 'Collapse all' : 'Expand all'}
        </button>
      </div>

      {VAR_GROUPS.map((group) => {
        const isOpen = openBundles.has(group.bundle);
        const contentId = `theme-editor-${group.bundle}-content`;
        const headingId = `theme-editor-${group.bundle}-heading`;
        return (
          <section
            key={group.bundle}
            aria-labelledby={headingId}
            className="border-b border-[var(--border)] last:border-0 pb-3 last:pb-0"
          >
            <div className="flex items-center gap-1">
              <h3
                id={headingId}
                className="flex-1 m-0 text-[var(--text)] text-xs font-semibold"
              >
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={contentId}
                  onClick={() => toggleBundle(group.bundle)}
                  className="group w-full flex items-center gap-2 py-1 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)] rounded cursor-pointer"
                >
                  <i
                    className="fa-solid fa-chevron-right text-[0.55rem] text-[var(--text-subtle)] group-aria-expanded:rotate-90 transition-transform duration-150"
                    aria-hidden="true"
                  />
                  <span>{group.label}</span>
                  <span className="flex-1 text-[var(--text-subtle)] text-[0.65rem] font-normal truncate">
                    {group.description}
                  </span>
                </button>
              </h3>
              <button
                type="button"
                onClick={() => onResetBundle(group.bundle)}
                aria-label={`Reset ${group.label} bundle`}
                className="px-1.5 py-1 text-[var(--text-subtle)] hover:text-[var(--text)] text-[0.65rem] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)] rounded cursor-pointer"
              >
                <i
                  className="fa-solid fa-arrow-rotate-left"
                  aria-hidden="true"
                />
              </button>
            </div>

            {isOpen && (
              <div id={contentId} className="mt-2 space-y-2 pl-4">
                {group.items.map(({ variable, label }) => (
                  <ColorRow
                    key={variable}
                    label={label}
                    bundleLabel={group.label}
                    variable={variable}
                    currentValue={colorValues[variable]}
                    onOverride={onOverride}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
