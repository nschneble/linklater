import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { EDITOR_FOCUS_RING } from './escapeHatchStyles';
import { menuRevealStyle } from '../../../lib/styles';
import { useReducedMotion } from '../../../lib/hooks/useReducedMotion';

/** A single selectable row in the themed picker. */
export interface ThemeSelectOption {
  /** Stable value committed via `onSelect`. */
  id: string;
  /** Visible row label (also the option's accessible name). */
  label: string;
  /** Font Awesome class overlaid on the color dot (decorative). */
  swatchIcon?: string;
  /** Dot fill color. Falls back to the orbit alt-text color when omitted. */
  accent?: string;
  /** Renders the universal-access glyph + "Accessible theme" for AT. */
  isAccessible?: boolean;
  /** When true, the row is announced + painted disabled and cannot commit. */
  disabled?: boolean;
  /** Extra screen-reader-only suffix appended to the name (e.g. ", not set up"). */
  suffixSrText?: string;
}

interface ThemeSelectMenuProps {
  /** All rows to render. Order is preserved. */
  options: ThemeSelectOption[];
  /** The currently selected option id, or `''` for none (shows `placeholder`). */
  value: string;
  /** Trigger text shown when `value` is `''`. */
  placeholder?: string;
  /** Commits a selection (skipped for disabled options). */
  onSelect: (id: string) => void;
  /** Accessible name for the trigger + listbox (use this OR `ariaLabelledBy`). */
  ariaLabel?: string;
  /** Id of a visible label element (preferred for destructive pickers). */
  ariaLabelledBy?: string;
  /** Extra classes for the trigger button (e.g. width). */
  className?: string;
}

const TYPEAHEAD_RESET_MS = 500;

/**
 * A themed single-select picker that replaces a native `<select>` in the Theme
 * Editor's chrome. Implements the WAI-ARIA APG select-only combobox: a
 * `role="combobox"` button paired with a `role="listbox"` popup whose options
 * carry `aria-selected`. DOM focus stays on the trigger throughout; the active
 * option is tracked via `aria-activedescendant`, so there is no roving tabindex.
 *
 * Why combobox and not the menu/menuitemradio pattern `ThemeSubmenu` uses: this
 * control replaces a form `<select>` whose chosen value must persist as the
 * trigger's text. `ThemeSubmenu` only gets to use menu semantics because it
 * lives inside an actual application menu (`UserMenu`) that owns roving focus;
 * this picker is standalone and owns its own keyboard model.
 *
 * The trigger paints from the active theme's `--base-*` tokens and the popup
 * from `--orbit-*`, matching the surfaces they render on (page vs floating
 * menu). The focus ring is a FIXED blue (see `EDITOR_FOCUS_RING`) so a hostile
 * custom palette can never make keyboard focus invisible — the editor's escape
 * hatch, "Reset all", reverts such a palette.
 *
 * Selection commits on click, Enter/Space, and Tab (native-select parity).
 * Escape and outside clicks close WITHOUT committing — chosen deliberately so
 * the destructive copy-from picker never stages a value the user only glanced
 * at while dismissing (SC 3.2.2).
 */
export default function ThemeSelectMenu({
  options,
  value,
  placeholder = 'Select…',
  onSelect,
  ariaLabel,
  ariaLabelledBy,
  className = '',
}: ThemeSelectMenuProps) {
  const baseId = useId();
  const listboxId = `${baseId}-listbox`;
  const optionId = useCallback(
    (id: string) => `${baseId}-option-${id}`,
    [baseId],
  );

  const reducedMotion = useReducedMotion();

  const [isOpen, setIsOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const triggerReference = useRef<HTMLButtonElement>(null);
  const listboxReference = useRef<HTMLDivElement>(null);
  const typeaheadReference = useRef({ buffer: '', at: 0 });

  const enabledOptions = options.filter((option) => !option.disabled);

  const selectedOption = options.find((option) => option.id === value) ?? null;
  const triggerLabel = selectedOption ? selectedOption.label : placeholder;

  // Resolve the option the keyboard should land on when the popup opens: the
  // current selection if it is enabled, otherwise the first enabled row.
  function initialActiveId(): string | null {
    if (selectedOption && !selectedOption.disabled) return selectedOption.id;
    return enabledOptions[0]?.id ?? null;
  }

  const close = useCallback(() => {
    setIsOpen(false);
    setActiveId(null);
  }, []);

  const open = useCallback(() => {
    setIsOpen(true);
    setActiveId(initialActiveId());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOption, options]);

  const commit = useCallback(
    (id: string | null) => {
      if (id === null) {
        close();
        return;
      }
      const option = options.find((entry) => entry.id === id);
      if (!option || option.disabled) return;
      onSelect(id);
      close();
    },
    [close, onSelect, options],
  );

  // Move the active row by a step among ENABLED options only (no wrap), so
  // disabled rows (CVD-locked themes) are skipped during arrow navigation.
  const moveActive = useCallback(
    (direction: 1 | -1) => {
      if (enabledOptions.length === 0) return;
      const currentIndex = enabledOptions.findIndex(
        (option) => option.id === activeId,
      );
      let nextIndex = currentIndex + direction;
      if (nextIndex < 0) nextIndex = 0;
      if (nextIndex > enabledOptions.length - 1) {
        nextIndex = enabledOptions.length - 1;
      }
      setActiveId(enabledOptions[nextIndex].id);
    },
    [activeId, enabledOptions],
  );

  const moveActiveToEdge = useCallback(
    (edge: 'first' | 'last') => {
      if (enabledOptions.length === 0) return;
      const option =
        edge === 'first'
          ? enabledOptions[0]
          : enabledOptions[enabledOptions.length - 1];
      setActiveId(option.id);
    },
    [enabledOptions],
  );

  // Native <select> typeahead: jump to the next enabled option whose label
  // starts with the accumulated keystrokes (reset after a short pause).
  const handleTypeahead = useCallback(
    (character: string) => {
      const now = Date.now();
      const state = typeaheadReference.current;
      if (now - state.at > TYPEAHEAD_RESET_MS) state.buffer = '';
      state.buffer += character.toLowerCase();
      state.at = now;
      const match = enabledOptions.find((option) =>
        option.label.toLowerCase().startsWith(state.buffer),
      );
      if (match) setActiveId(match.id);
    },
    [enabledOptions],
  );

  function handleTriggerKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (!isOpen) {
      if (
        event.key === 'ArrowDown' ||
        event.key === 'ArrowUp' ||
        event.key === 'Enter' ||
        event.key === ' '
      ) {
        event.preventDefault();
        open();
        return;
      }
      if (event.key.length === 1 && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        open();
        handleTypeahead(event.key);
      }
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        moveActive(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        moveActive(-1);
        break;
      case 'Home':
        event.preventDefault();
        moveActiveToEdge('first');
        break;
      case 'End':
        event.preventDefault();
        moveActiveToEdge('last');
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        commit(activeId);
        break;
      case 'Escape':
        event.preventDefault();
        close();
        break;
      case 'Tab':
        // Commit the active row, then let focus advance (native-select parity).
        commit(activeId);
        break;
      default:
        if (event.key.length === 1 && !event.metaKey && !event.ctrlKey) {
          event.preventDefault();
          handleTypeahead(event.key);
        }
    }
  }

  // Close + cancel when focus or a pointer leaves the control entirely.
  useEffect(() => {
    if (!isOpen) return;
    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (
        triggerReference.current?.contains(target) ||
        listboxReference.current?.contains(target)
      ) {
        return;
      }
      close();
    }
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isOpen, close]);

  // Keep the active row scrolled into view as the keyboard moves it (SC 2.4.11).
  useEffect(() => {
    if (!isOpen || activeId === null) return;
    const element = document.getElementById(optionId(activeId));
    // Optional-call: jsdom does not implement scrollIntoView.
    element?.scrollIntoView?.({ block: 'nearest' });
  }, [isOpen, activeId, optionId]);

  // Opacity always fades (allowed under reduced motion); the scale transform is
  // dropped when the user asks for reduced motion (inline styles bypass the
  // `motion-safe:` variant, so this is gated in JS).
  const reveal = menuRevealStyle(isOpen);
  const revealStyle = reducedMotion
    ? {
        opacity: reveal.opacity,
        transition: `opacity ${isOpen ? '150ms ease-out' : '100ms ease-in'}`,
      }
    : reveal;

  // Emit exactly one naming attribute: a visible label (aria-labelledby) wins
  // when given, so the two never shadow each other.
  const labelledBy = ariaLabelledBy;
  const label = ariaLabelledBy ? undefined : ariaLabel;

  return (
    <div className="relative">
      <button
        ref={triggerReference}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        // aria-owns links the sibling listbox so aria-activedescendant resolves
        // (aria-controls alone does not establish the ownership the active
        // option reference needs).
        aria-owns={listboxId}
        aria-label={label}
        aria-labelledby={labelledBy}
        aria-activedescendant={
          isOpen && activeId ? optionId(activeId) : undefined
        }
        onClick={() => (isOpen ? close() : open())}
        onKeyDown={handleTriggerKeyDown}
        className={`group flex items-center justify-between gap-2 px-2.5 py-1.5 bg-[var(--base-bg)] border border-[var(--base-border)] text-[var(--base-text)] text-xs ${EDITOR_FOCUS_RING} rounded-lg cursor-pointer ${className}`}
      >
        <span className="flex items-center gap-2 min-w-0">
          {selectedOption && (
            <Swatch
              icon={selectedOption.swatchIcon}
              accent={selectedOption.accent}
            />
          )}
          <span className="truncate">{triggerLabel}</span>
        </span>
        <i
          className="fa-solid fa-chevron-down shrink-0 text-[var(--base-subtle-text)] text-[0.6rem] motion-safe:transition-transform group-aria-expanded:-rotate-180"
          aria-hidden="true"
        />
      </button>

      <div
        ref={listboxReference}
        id={listboxId}
        role="listbox"
        aria-label={label}
        aria-labelledby={labelledBy}
        inert={!isOpen ? true : undefined}
        style={revealStyle}
        className={`absolute left-0 top-[calc(100%+0.25rem)] z-50 w-max min-w-full max-h-72 overflow-auto py-1 bg-[var(--orbit-bg)] border border-[var(--orbit-border)] rounded-lg shadow-lg origin-top ${isOpen ? '' : 'pointer-events-none'}`}
      >
        {options.map((option) => {
          const isSelected = option.id === value;
          const isActive = isOpen && option.id === activeId;
          return (
            <button
              key={option.id}
              type="button"
              role="option"
              id={optionId(option.id)}
              aria-selected={isSelected}
              aria-disabled={option.disabled ? 'true' : undefined}
              data-active={isActive ? 'true' : undefined}
              tabIndex={-1}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => {
                if (!option.disabled) setActiveId(option.id);
              }}
              onClick={() => commit(option.id)}
              className="group flex items-center gap-2 w-full px-3 py-2 text-[var(--orbit-text)] text-left text-xs aria-selected:font-semibold data-[active=true]:bg-[var(--orbit-highlight)] data-[active=true]:text-[var(--orbit-highlight-fg)] data-[active=true]:ring-2 data-[active=true]:ring-inset data-[active=true]:ring-blue-500 forced-colors:data-[active=true]:outline forced-colors:data-[active=true]:outline-2 aria-disabled:opacity-50 aria-disabled:cursor-not-allowed cursor-pointer"
            >
              <Swatch icon={option.swatchIcon} accent={option.accent} />
              <span className="flex-1 truncate">
                {option.label}
                {option.suffixSrText && (
                  <span className="sr-only">{option.suffixSrText}</span>
                )}
              </span>
              {isSelected && (
                <i
                  className="fa-solid fa-check shrink-0 text-[var(--orbit-highlight)] group-data-[active=true]:text-[var(--orbit-highlight-fg)]"
                  aria-hidden="true"
                />
              )}
              {option.isAccessible && (
                <>
                  <i
                    className="fa-solid fa-universal-access shrink-0"
                    aria-hidden="true"
                  />
                  <span className="sr-only">Accessible theme</span>
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface SwatchProps {
  icon?: string;
  accent?: string;
}

/**
 * Color dot with an overlaid film glyph, mirroring the user-menu picker. When
 * an `accent` is given the dot uses it with a white glyph (theme identity);
 * otherwise it falls back to the orbit alt-text fill with an orbit-bg glyph so
 * it tracks the popup surface.
 */
function Swatch({ icon, accent }: SwatchProps) {
  return (
    <span
      className="relative shrink-0 inline-flex items-center justify-center w-3.5 h-3.5 bg-[var(--orbit-alt-text)] rounded-full"
      style={accent ? { backgroundColor: accent } : undefined}
    >
      {icon && (
        <i
          className={`fa-solid ${icon} text-[var(--orbit-bg)] text-[0.5rem]`}
          style={accent ? { color: '#ffffff' } : undefined}
          aria-hidden="true"
        />
      )}
    </span>
  );
}
