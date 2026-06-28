import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { EDITOR_FOCUS_RING, ESCAPE_HATCH_LIGHT } from './escapeHatchStyles';
import { menuRevealStyle } from '../../../lib/styles';
import { useReducedMotion } from '../../../lib/hooks/useReducedMotion';
import ThemeRowContent from '../../common/ThemeRowContent';

/** A single selectable row in the copy menu. */
export interface ThemeMenuOption {
  /** Stable value passed to `onActivate`. */
  id: string;
  /** Visible row label (also the item's accessible name). */
  label: string;
  /** Font Awesome class overlaid on the color dot (decorative). */
  swatchIcon?: string;
  /** Dot fill color. Falls back to the orbit alt-text color when omitted. */
  accent?: string;
  /** Renders the universal-access glyph + "Accessible theme" for AT. */
  isAccessible?: boolean;
  /** When true, the row is announced + painted disabled and cannot activate. */
  disabled?: boolean;
}

interface ThemeCopyMenuProps {
  /** All rows to render. Order is preserved. */
  options: ThemeMenuOption[];
  /** Visible trigger text (also the menu's accessible name). */
  label: string;
  /** Invoked when a row is activated (skipped for disabled rows). */
  onActivate: (id: string) => void;
  /**
   * Opt-in preview hook. Fires with the currently ACTIVE option id whenever it
   * changes while the menu is open, and with `null` when the menu closes (any
   * path). Driven off `activeId` so keyboard + pointer preview through one code
   * path (SC 2.1.1).
   */
  onActivePreview?: (id: string | null) => void;
  /**
   * When true, the trigger is `aria-disabled` (kept focusable + announced so it
   * stays discoverable as "turn the toggle on to use this"); activation and
   * opening are blocked.
   */
  disabled?: boolean;
  /** Id of a static hint describing the trigger (e.g. the disabled reason). */
  ariaDescribedBy?: string;
  /** Extra classes for the trigger button. */
  className?: string;
}

const TYPEAHEAD_RESET_MS = 500;

/**
 * A themed MENU that triggers a copy action — it does NOT hold a value.
 * Activating a row applies that theme's palette immediately, so it is modelled
 * as the WAI-ARIA menu-button pattern (`aria-haspopup="menu"` trigger → a
 * `role="menu"` popup of `role="menuitem"` actions), NOT a combobox. A combobox
 * would advertise a persistent selected value with `aria-selected` + a
 * checkmark that AT would announce — but after copy-on-activate there is no
 * retained selection, so that announcement would be a lie. Menuitems model
 * one-shot actions ("Apply Apollo's palette") and carry no selection state.
 *
 * DOM focus stays on the trigger throughout; the active item is tracked via
 * `aria-activedescendant`, so there is no roving tabindex. Activation fires on
 * click, Enter/Space, and Tab (commit-then-advance). Escape + outside clicks
 * close WITHOUT activating.
 *
 * The TRIGGER paints from FIXED escape-hatch colors (`ESCAPE_HATCH_LIGHT`) with
 * the fixed blue focus ring — it is the only remaining recovery affordance from
 * an unreadable custom palette (the "Reset all" hatch is gone), so it must stay
 * legible + openable even when the palette it exists to escape is hostile. The
 * popup paints from `--orbit-*`; keyboard navigation of its rows keeps the
 * fixed-blue active ring so recovery survives a hostile palette on the keyboard.
 */
const ThemeCopyMenu = forwardRef<HTMLButtonElement, ThemeCopyMenuProps>(
  function ThemeCopyMenu(
    {
      options,
      label,
      onActivate,
      onActivePreview,
      disabled = false,
      ariaDescribedBy,
      className = '',
    },
    forwardedRef,
  ) {
    const baseId = useId();
    const menuId = `${baseId}-menu`;
    const optionId = useCallback(
      (id: string) => `${baseId}-option-${id}`,
      [baseId],
    );

    const reducedMotion = useReducedMotion();

    const [isOpen, setIsOpen] = useState(false);
    const [activeId, setActiveId] = useState<string | null>(null);

    const triggerReference = useRef<HTMLButtonElement>(null);
    const menuReference = useRef<HTMLDivElement>(null);
    const typeaheadReference = useRef({ buffer: '', at: 0 });

    // Merge the internal trigger ref with the forwarded one so the parent can
    // return focus to the trigger (e.g. after Undo) while this component keeps
    // its own node reference for focus + outside-click checks.
    const setTriggerRef = useCallback(
      (node: HTMLButtonElement | null) => {
        triggerReference.current = node;
        if (typeof forwardedRef === 'function') forwardedRef(node);
        else if (forwardedRef) forwardedRef.current = node;
      },
      [forwardedRef],
    );

    const enabledOptions = options.filter((option) => !option.disabled);

    function initialActiveId(): string | null {
      return enabledOptions[0]?.id ?? null;
    }

    const close = useCallback(() => {
      setIsOpen(false);
      setActiveId(null);
    }, []);

    // Close and pull focus back to the trigger. Used by every KEYBOARD close
    // (Escape, activate, Tab) so focus never falls to <body>; pointer-driven
    // closes (outside click) deliberately don't force focus.
    const closeAndFocusTrigger = useCallback(() => {
      close();
      triggerReference.current?.focus();
    }, [close]);

    const open = useCallback(() => {
      if (disabled) return;
      setIsOpen(true);
      setActiveId(initialActiveId());
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [disabled, options]);

    const activate = useCallback(
      (id: string | null) => {
        if (id === null) {
          closeAndFocusTrigger();
          return;
        }
        const option = options.find((entry) => entry.id === id);
        if (!option || option.disabled) return;
        onActivate(id);
        closeAndFocusTrigger();
      },
      [closeAndFocusTrigger, onActivate, options],
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

    // Native-menu typeahead: jump to the next enabled option whose label starts
    // with the accumulated keystrokes (reset after a short pause).
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

    // Keys while focus is on the closed trigger: only OPEN the menu (focus then
    // moves into the menu container, which owns navigation).
    function handleTriggerKeyDown(
      event: React.KeyboardEvent<HTMLButtonElement>,
    ) {
      if (disabled || isOpen) return;
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
    }

    // Keys while focus is on the open menu container. The active item is tracked
    // via the menu's `aria-activedescendant` (valid on the `menu` composite
    // role, unlike a `button`), so DOM focus stays on the container.
    function handleMenuKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
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
        case 'Tab':
          event.preventDefault();
          activate(activeId);
          break;
        case 'Escape':
          event.preventDefault();
          closeAndFocusTrigger();
          break;
        default:
          if (event.key.length === 1 && !event.metaKey && !event.ctrlKey) {
            event.preventDefault();
            handleTypeahead(event.key);
          }
      }
    }

    // Close + cancel when a pointer goes down outside the control entirely.
    useEffect(() => {
      if (!isOpen) return;
      function handlePointerDown(event: PointerEvent) {
        const target = event.target as Node;
        if (
          triggerReference.current?.contains(target) ||
          menuReference.current?.contains(target)
        ) {
          return;
        }
        close();
      }
      document.addEventListener('pointerdown', handlePointerDown);
      return () =>
        document.removeEventListener('pointerdown', handlePointerDown);
    }, [isOpen, close]);

    // Move focus into the menu container when it opens so its keydown handler
    // receives navigation keys and `aria-activedescendant` resolves (the
    // container, not the trigger, carries focus while open).
    useEffect(() => {
      if (isOpen) menuReference.current?.focus();
    }, [isOpen]);

    // Keep the active row scrolled into view as the keyboard moves it (SC 2.4.11).
    useEffect(() => {
      if (!isOpen || activeId === null) return;
      const element = document.getElementById(optionId(activeId));
      // Optional-call: jsdom does not implement scrollIntoView.
      element?.scrollIntoView?.({ block: 'nearest' });
    }, [isOpen, activeId, optionId]);

    // Drive the optional preview off the active option. `close()` zeroes isOpen
    // AND activeId together, so every close path (activate, Escape, outside
    // click, Tab-away) flows through here as a single `null`.
    useEffect(() => {
      if (!onActivePreview) return;
      onActivePreview(isOpen ? activeId : null);
    }, [isOpen, activeId, onActivePreview]);

    useEffect(() => {
      if (!onActivePreview) return;
      return () => onActivePreview(null);
    }, [onActivePreview]);

    // Opacity always fades (allowed under reduced motion); the scale transform
    // is dropped under reduced motion (inline styles bypass `motion-safe:`).
    const reveal = menuRevealStyle(isOpen);
    const revealStyle = reducedMotion
      ? {
          opacity: reveal.opacity,
          transition: `opacity ${isOpen ? '150ms ease-out' : '100ms ease-in'}`,
        }
      : reveal;

    return (
      <div className="relative">
        <button
          ref={setTriggerRef}
          type="button"
          aria-haspopup="menu"
          aria-expanded={isOpen}
          aria-controls={menuId}
          aria-disabled={disabled || undefined}
          aria-describedby={ariaDescribedBy}
          onClick={() => {
            if (disabled) return;
            if (isOpen) close();
            else open();
          }}
          onKeyDown={handleTriggerKeyDown}
          style={ESCAPE_HATCH_LIGHT}
          className={`group flex items-center justify-between gap-2 px-2.5 py-1.5 border text-xs ${EDITOR_FOCUS_RING} rounded-lg cursor-pointer aria-disabled:opacity-50 aria-disabled:cursor-not-allowed ${className}`}
        >
          <span className="truncate">{label}</span>
          <i
            className="fa-solid fa-chevron-down shrink-0 text-[0.6rem] opacity-70 motion-safe:transition-transform group-aria-expanded:-rotate-180"
            aria-hidden="true"
          />
        </button>

        <div
          ref={menuReference}
          id={menuId}
          role="menu"
          aria-label={label}
          tabIndex={-1}
          aria-activedescendant={
            isOpen && activeId ? optionId(activeId) : undefined
          }
          onKeyDown={handleMenuKeyDown}
          inert={!isOpen ? true : undefined}
          style={revealStyle}
          className={`absolute left-0 top-[calc(100%+0.25rem)] z-50 w-max min-w-full max-h-72 overflow-auto py-1 bg-[var(--orbit-bg)] border border-[var(--orbit-border)] rounded-lg shadow-lg origin-top ${isOpen ? '' : 'pointer-events-none'}`}
        >
          {options.map((option) => {
            const isActive = isOpen && option.id === activeId;
            return (
              <button
                key={option.id}
                type="button"
                role="menuitem"
                id={optionId(option.id)}
                aria-disabled={option.disabled ? 'true' : undefined}
                data-active={isActive ? 'true' : undefined}
                tabIndex={-1}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => {
                  if (!option.disabled) setActiveId(option.id);
                }}
                onClick={() => activate(option.id)}
                className="group flex items-center gap-2 w-full px-3 py-2 text-[var(--orbit-text)] text-left text-xs data-[active=true]:bg-[var(--orbit-highlight)] data-[active=true]:text-[var(--orbit-highlight-fg)] data-[active=true]:ring-2 data-[active=true]:ring-inset data-[active=true]:ring-blue-500 forced-colors:data-[active=true]:outline forced-colors:data-[active=true]:outline-2 cursor-pointer aria-disabled:opacity-50 aria-disabled:cursor-not-allowed"
              >
                <ThemeRowContent
                  label={option.label}
                  truncateLabel
                  swatchIcon={option.swatchIcon}
                  accent={option.accent}
                  swatchSize="w-3.5 h-3.5"
                  glyphSize="text-[0.5rem]"
                  isAccessible={option.isAccessible}
                />
              </button>
            );
          })}
        </div>
      </div>
    );
  },
);

export default ThemeCopyMenu;
