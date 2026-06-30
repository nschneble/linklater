import { useRef } from 'react';
import ColorRow from './ColorRow';
import {
  VAR_GROUPS,
  type Bundle,
  type BundleGroup,
  type ThemeVariable,
} from './useThemeOverrides';
import type { TokenContrastFailure } from './contrastResults';

interface BundleTabsProps {
  /** Current (possibly overridden) values for all editable CSS variables. */
  colorValues: Record<ThemeVariable, string>;
  /**
   * Worst failing contrast pair keyed by EITHER endpoint (the both-endpoints
   * `pairsTouchingToken` view). Keying by both endpoints means editing a slot
   * whose token is a pair's BACKGROUND self-reports on that row, not only on
   * the far foreground row (C3).
   */
  contrastFailures: Map<string, TokenContrastFailure>;
  /** The bundle whose raw slots are shown + edited. */
  activeBundle: Bundle;
  /** Selects which bundle's slots are shown + edited. */
  onBundleChange: (bundle: Bundle) => void;
  /** Called when the user changes a slot via the picker or text input. */
  onOverride: (variable: ThemeVariable, value: string) => void;
  /**
   * Id of the region's "Color Bundles" h2 (owned by `ColorEditor`). The tablist
   * is `aria-labelledby` this heading rather than carrying its own label, so the
   * card title names the bundle selector too (SC 2.4.6).
   */
  tablistLabelledBy: string;
}

function tabId(bundle: Bundle): string {
  return `bundle-tab-${bundle}`;
}

// One physical panel whose contents swap, so it carries ONE fixed id. Every
// tab's `aria-controls` points here (the panel never changes identity); only
// the panel's `aria-labelledby` tracks the active tab (AUD-W2).
const PANEL_ID = 'bundle-panel';

/**
 * Bundle selector + slot panel for the Theme Editor's Colors region. The
 * selector is a WAI-ARIA tablist with AUTOMATIC activation + roving tabindex:
 * choosing a bundle (click or arrow key) immediately shows ONLY that bundle's
 * raw slots (7-10, sourced from `VAR_GROUPS`) in the active mode — no "show all
 * colors" drawer, no human knobs.
 *
 * One physical tabpanel whose contents swap (not 7 mounted); it carries a FIXED
 * `id` that every tab's `aria-controls` points at, while its `aria-labelledby`
 * tracks the ACTIVE bundle so AT always lands on the right panel. The panel is
 * NOT a tab stop — it always contains focusable slot rows, so making it
 * focusable would add a redundant inert stop (APG). The active tab reads as a
 * FILLED pill (inverted `--mount-text` bg / `--mount-bg` label) and is
 * distinguished by MORE than color (SC 1.4.1): a `fa-circle-dot` second channel
 * + `font-semibold`, all driven off the `aria-selected` attribute (no JS ternary
 * class toggles).
 *
 * Arrow keys move selection with NO wrap (matching the APG tablist no-wrap
 * pattern); Home/End jump to the first/last bundle. Focus STAYS on the
 * activated tab — Tab descends
 * into the slot rows from there.
 */
export default function BundleTabs({
  colorValues,
  contrastFailures,
  activeBundle,
  onBundleChange,
  onOverride,
  tablistLabelledBy,
}: BundleTabsProps) {
  const tabReferences = useRef<Partial<Record<Bundle, HTMLButtonElement>>>({});

  const activeGroup = VAR_GROUPS.find(
    (group) => group.bundle === activeBundle,
  ) as BundleGroup;

  function focusBundle(bundle: Bundle) {
    onBundleChange(bundle);
    tabReferences.current[bundle]?.focus();
  }

  function handleTabKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    const currentIndex = VAR_GROUPS.findIndex(
      (group) => group.bundle === activeBundle,
    );
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      if (currentIndex < VAR_GROUPS.length - 1) {
        event.preventDefault();
        focusBundle(VAR_GROUPS[currentIndex + 1].bundle);
      }
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      if (currentIndex > 0) {
        event.preventDefault();
        focusBundle(VAR_GROUPS[currentIndex - 1].bundle);
      }
    } else if (event.key === 'Home') {
      event.preventDefault();
      focusBundle(VAR_GROUPS[0].bundle);
    } else if (event.key === 'End') {
      event.preventDefault();
      focusBundle(VAR_GROUPS[VAR_GROUPS.length - 1].bundle);
    }
  }

  return (
    <div className="space-y-3">
      <div
        role="tablist"
        aria-labelledby={tablistLabelledBy}
        aria-orientation="horizontal"
        className="flex flex-wrap gap-1.5"
      >
        {VAR_GROUPS.map((group) => (
          <button
            key={group.bundle}
            ref={(element) => {
              if (element) {
                tabReferences.current[group.bundle] = element;
              } else {
                delete tabReferences.current[group.bundle];
              }
            }}
            type="button"
            role="tab"
            id={tabId(group.bundle)}
            aria-selected={group.bundle === activeBundle}
            aria-controls={PANEL_ID}
            tabIndex={group.bundle === activeBundle ? 0 : -1}
            onClick={() => onBundleChange(group.bundle)}
            onKeyDown={handleTabKeyDown}
            className="group flex items-center gap-1.5 px-2.5 py-1.5 bg-[var(--mount-bg)] aria-selected:bg-[var(--mount-text)] border border-[var(--mount-border)] aria-selected:border-[var(--mount-text)] text-[var(--mount-alt-text)] aria-selected:text-[var(--mount-bg)] text-xs aria-selected:font-semibold focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--focus-ring)] rounded-full transition-colors cursor-pointer"
          >
            <i
              className="hidden group-aria-selected:inline fa-solid fa-circle-dot text-[0.4rem]"
              aria-hidden="true"
            />
            {group.label}
          </button>
        ))}
      </div>

      <h3 className="text-[var(--mount-alt-text)] text-[0.65rem] uppercase tracking-wide font-semibold">
        Colors
      </h3>

      <div
        role="tabpanel"
        id={PANEL_ID}
        aria-labelledby={tabId(activeBundle)}
        className="space-y-2"
      >
        {activeGroup.items.map(({ variable, label }) => (
          <ColorRow
            key={variable}
            label={label}
            variable={variable}
            currentValue={colorValues[variable]}
            failure={contrastFailures.get(variable)}
            onOverride={onOverride}
          />
        ))}
      </div>
    </div>
  );
}
