import { useEffect, useMemo, useRef, useState } from 'react';
import ModeToggle from './ModeToggle';
import type { Mode } from '../../../theme/constants';
import type { TokenContrastFailure } from './contrastResults';
import {
  VAR_GROUPS,
  isAlphaValue,
  type Bundle,
  type BundleGroup,
  type ThemeVariable,
} from './useThemeOverrides';

const EDITOR_MODE_LABELS: Record<Mode, string> = {
  light: 'Light colors',
  dark: 'Dark colors',
};

interface ColorEditorProps {
  /** The current (possibly overridden) values for all editable CSS variables. */
  colorValues: Record<ThemeVariable, string>;
  /**
   * Per-token worst failing contrast pair, keyed by the token's variable name.
   * A present entry means this token's hex input fails a WCAG pair and should
   * surface inline failure feedback (BL1).
   */
  contrastFailures: Map<string, TokenContrastFailure>;
  /** Called when the user changes a color via the picker or text input. */
  onOverride: (variable: ThemeVariable, value: string) => void;
  /** Called when the user clicks a per-bundle Reset button. */
  onResetBundle: (bundle: Bundle) => void;
  /**
   * The editor's LOCAL color mode (which mode's palette is shown + edited). The
   * Light/Dark tabs at the top of the card drive this; it is decoupled from the
   * global site mode.
   */
  editorMode: Mode;
  /** Switches which mode's palette the editor shows + edits. */
  onEditorModeChange: (mode: Mode) => void;
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
  /** This token's worst failing contrast pair, or `undefined` when it passes. */
  failure: TokenContrastFailure | undefined;
  /** Called when the user commits a new color value. */
  onOverride: (variable: ThemeVariable, value: string) => void;
}

const SEARCH_INPUT_ID = 'theme-editor-token-search';
const SEARCH_STATUS_ID = 'theme-editor-token-search-status';

/**
 * How long the describedby failure text waits after the latest keystroke
 * before updating. Stops a half-typed value (e.g. `#3`) from thrashing the
 * note text while the user is mid-edit (BL1).
 */
const FAILURE_NOTE_DEBOUNCE_MS = 400;

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
 * Filters `VAR_GROUPS` against a lowercased query, matching on bundle label,
 * slot label, or variable name. Substring match – users typically type a few
 * letters of the hyphenated name without the leading dashes, so a substring
 * check covers both `--mount-highlight-fg` and `mount-highlight-fg`. Whole
 * bundles are kept when the bundle label itself matches (e.g. query "mount"
 * keeps every slot under the Mount section).
 */
function filterGroups(
  query: string,
  groups: ReadonlyArray<BundleGroup>,
): BundleGroup[] {
  if (query === '') return groups.slice();
  return groups
    .map((group) => {
      const groupLabelHit = group.label.toLowerCase().includes(query);
      if (groupLabelHit) return { ...group };
      const items = group.items.filter(
        (item) =>
          item.label.toLowerCase().includes(query) ||
          item.variable.toLowerCase().includes(query),
      );
      return { ...group, items };
    })
    .filter((group) => group.items.length > 0);
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

/**
 * Renders the full list of editable color variables, grouped by bundle, with
 * a search box that filters across bundle labels, slot labels, and variable
 * names. Each bundle is a collapsible disclosure with its own Reset button;
 * the `base` bundle defaults to open. While a search query is active, every
 * bundle with at least one match auto-expands; the prior open/closed state is
 * restored when the query clears.
 */
export default function ColorEditor({
  colorValues,
  contrastFailures,
  onOverride,
  onResetBundle,
  editorMode,
  onEditorModeChange,
}: ColorEditorProps) {
  const [openBundles, setOpenBundles] = useState<Set<Bundle>>(
    () => new Set(['base']),
  );
  const [query, setQuery] = useState('');
  const preSearchOpenBundles = useRef<Set<Bundle> | null>(null);
  const searchInputReference = useRef<HTMLInputElement>(null);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredGroups = useMemo(
    () => filterGroups(normalizedQuery, VAR_GROUPS),
    [normalizedQuery],
  );
  const matchCount = filteredGroups.reduce(
    (total, group) => total + group.items.length,
    0,
  );

  // Effective open set: every matching bundle is open while a query is active;
  // manual openBundles state otherwise. Manual toggles still mutate
  // openBundles even mid-search so the user can collapse a matching section.
  const effectiveOpenBundles = useMemo(() => {
    if (normalizedQuery === '') return openBundles;
    return new Set(filteredGroups.map((group) => group.bundle));
  }, [normalizedQuery, openBundles, filteredGroups]);

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

  function handleQueryChange(event: React.ChangeEvent<HTMLInputElement>) {
    const nextQuery = event.target.value;
    if (query === '' && nextQuery !== '') {
      // Entering search mode – snapshot current open state.
      preSearchOpenBundles.current = new Set(openBundles);
    }
    if (nextQuery === '' && preSearchOpenBundles.current !== null) {
      // Exiting search mode – restore prior snapshot.
      setOpenBundles(preSearchOpenBundles.current);
      preSearchOpenBundles.current = null;
    }
    setQuery(nextQuery);
  }

  function clearSearch() {
    if (preSearchOpenBundles.current !== null) {
      setOpenBundles(preSearchOpenBundles.current);
      preSearchOpenBundles.current = null;
    }
    setQuery('');
    searchInputReference.current?.focus();
  }

  function handleSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape' && query !== '') {
      event.preventDefault();
      clearSearch();
    }
  }

  const allOpen = openBundles.size === VAR_GROUPS.length;

  const liveRegionMessage =
    query === ''
      ? ''
      : matchCount === 0
        ? 'No tokens match'
        : matchCount === 1
          ? '1 token matches'
          : `${matchCount} tokens match`;

  return (
    <div className="space-y-3">
      {/* Light/Dark palette selector — the FIRST control in the card so DOM
          order matches the read flow ("choose a mode, then edit"). It re-points
          this card + the Contrast and Components cards to that mode's palette
          WITHOUT touching the global site mode (a binary toggle, not a tablist:
          there is no single panel to own). The group label names the
          consequence so the pressed state self-documents — no live region. */}
      <ModeToggle
        mode={editorMode}
        onModeChange={onEditorModeChange}
        groupLabel="Palette to edit"
        labels={EDITOR_MODE_LABELS}
      />

      <h2 className="text-[var(--mount-alt-text)] text-[0.65rem] uppercase tracking-wide font-semibold">
        Colors
      </h2>

      <div role="search" className="relative">
        <label htmlFor={SEARCH_INPUT_ID} className="sr-only">
          Search tokens
        </label>
        <input
          ref={searchInputReference}
          id={SEARCH_INPUT_ID}
          type="search"
          value={query}
          onChange={handleQueryChange}
          onKeyDown={handleSearchKeyDown}
          placeholder="Search tokens…"
          autoComplete="off"
          spellCheck={false}
          aria-describedby={SEARCH_STATUS_ID}
          className="w-full pl-7 pr-7 py-1.5 bg-[var(--mount-input-bg)] border border-[var(--mount-border)] text-[var(--mount-text)] text-xs focus:outline-none focus:ring-1 focus:ring-[var(--focus-ring)] rounded-md"
        />
        <i
          className="absolute left-2 top-1/2 -translate-y-1/2 fa-solid fa-magnifying-glass text-[0.6rem] text-[var(--mount-alt-text)]"
          aria-hidden="true"
        />
        {query !== '' && (
          <button
            type="button"
            onClick={clearSearch}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 flex items-center justify-center w-4 h-4 -translate-y-1/2 text-[var(--mount-alt-text)] hover:text-[var(--mount-text)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--focus-ring)] rounded cursor-pointer"
          >
            <i className="fa-solid fa-xmark text-[0.6rem]" aria-hidden="true" />
          </button>
        )}
        <p
          id={SEARCH_STATUS_ID}
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
        >
          {liveRegionMessage}
        </p>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-[var(--mount-alt-text)] text-[0.6rem]">
          {VAR_GROUPS.length} bundles ·{' '}
          {VAR_GROUPS.reduce((total, group) => total + group.items.length, 0)}{' '}
          tokens
        </p>
        <button
          type="button"
          onClick={allOpen ? collapseAll : expandAll}
          className="text-[var(--mount-alt-text)] hover:text-[var(--mount-text)] text-[0.65rem] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--focus-ring)] rounded cursor-pointer"
        >
          {allOpen ? 'Collapse all' : 'Expand all'}
        </button>
      </div>

      {filteredGroups.length === 0 ? (
        <p
          role="note"
          className="text-[var(--mount-alt-text)] text-xs italic py-4 text-center"
        >
          No tokens match &ldquo;{query}&rdquo;.
        </p>
      ) : (
        filteredGroups.map((group) => {
          const isOpen = effectiveOpenBundles.has(group.bundle);
          const contentId = `theme-editor-${group.bundle}-content`;
          const headingId = `theme-editor-${group.bundle}-heading`;
          return (
            <section
              key={group.bundle}
              aria-labelledby={headingId}
              className="border-b border-[var(--mount-border)] last:border-0 pb-3 last:pb-0"
            >
              <div className="flex items-center gap-1">
                <h3
                  id={headingId}
                  className="flex-1 m-0 text-[var(--mount-text)] text-xs font-semibold"
                >
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={contentId}
                    onClick={() => toggleBundle(group.bundle)}
                    className="group w-full flex items-center gap-2 py-1 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--focus-ring)] rounded cursor-pointer"
                  >
                    <i
                      className="fa-solid fa-chevron-right text-[0.55rem] text-[var(--mount-alt-text)] group-aria-expanded:rotate-90 transition-transform duration-150"
                      aria-hidden="true"
                    />
                    <span>{group.label}</span>
                    <span className="flex-1 text-[var(--mount-alt-text)] text-[0.65rem] font-normal truncate">
                      {group.description}
                    </span>
                  </button>
                </h3>
                <button
                  type="button"
                  onClick={() => onResetBundle(group.bundle)}
                  aria-label={`Reset ${group.label} bundle`}
                  className="px-1.5 py-1 text-[var(--mount-alt-text)] hover:text-[var(--mount-text)] text-[0.65rem] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--focus-ring)] rounded cursor-pointer"
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
                      failure={contrastFailures.get(variable)}
                      onOverride={onOverride}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })
      )}
    </div>
  );
}
