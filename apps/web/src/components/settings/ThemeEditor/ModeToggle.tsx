import SlidingTabBar from '../../common/SlidingTabBar';
import type { Mode } from '../../../theme/constants';

const MODE_OPTIONS: Mode[] = ['light', 'dark'];

/** Stable tab id for a mode option: the controlled panel points back at it. */
export function modeTabId(mode: Mode): string {
  return `mode-tab-${mode}`;
}

interface ModeToggleProps {
  /** The active color mode. */
  mode: Mode;
  /** Commits a mode choice. */
  onModeChange: (mode: Mode) => void;
  /**
   * Accessible name for the tablist. Describes the consequence of a flip
   * (e.g. "Palette to edit") so the selected-state announcement self-documents.
   */
  ariaLabel: string;
  /**
   * Visible per-mode label. This text IS the tab's accessible name (no
   * overriding `aria-label`), so it stays voice-controllable (SC 2.5.3).
   */
  labels: Record<Mode, string>;
  /** id of the editing region (`role="tabpanel"`) these tabs control. */
  panelId: string;
}

/**
 * Light/dark palette selector in the Theme Editor's header toolbar. It IS the
 * shared `SlidingTabBar` (the same component as the Unread/Read switcher on the
 * "Your links" page), so it looks and behaves identically: an animated sliding
 * pill, both options painted from the same `--mount-*` bundle tokens (no
 * per-mode color inversion), roving tabindex, and arrow/Home/End navigation via
 * `useTabNavigation`. It picks which mode's palette the editor shows + edits
 * (swapping the content of one surface, the established tablist pattern here),
 * and never touches the global site mode. `surface="base"` because the toolbar
 * renders at page level, matching the links toolbar tabs.
 */
export default function ModeToggle({
  mode,
  onModeChange,
  ariaLabel,
  labels,
  panelId,
}: ModeToggleProps) {
  return (
    <SlidingTabBar
      ariaLabel={ariaLabel}
      activeIndex={MODE_OPTIONS.indexOf(mode)}
      surface="base"
      className="shrink-0 border-shadow hover:border-shadow text-xs"
      tabClassName="px-3 py-1.5"
      tabs={MODE_OPTIONS.map((modeOption) => ({
        id: modeTabId(modeOption),
        ariaControls: panelId,
        label: labels[modeOption],
        onClick: () => onModeChange(modeOption),
      }))}
    />
  );
}
