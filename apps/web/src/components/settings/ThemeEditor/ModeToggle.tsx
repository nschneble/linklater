import { EDITOR_FOCUS_RING, ESCAPE_HATCH_PILL } from './escapeHatchStyles';
import type { Mode } from '../../../theme/constants';

const MODE_OPTIONS: Mode[] = ['light', 'dark'];

interface ModeToggleProps {
  /** The active color mode. */
  mode: Mode;
  /** Commits a mode choice. */
  onModeChange: (mode: Mode) => void;
}

/**
 * Light/dark toggle for the Theme Editor chrome. HYBRID of the read/unread
 * sliding-pill look (ComponentShowcase): the container, border, and inactive
 * label track the active theme's `--mount-*` bundle tokens so it matches the
 * read/unread switcher, BUT the active pill fill + active label stay PINNED to
 * fixed escape-hatch colors (and the focus ring stays fixed blue), because this
 * is the one control you operate INSIDE the possibly-hostile palette you're
 * fixing — its active state must never collapse. Modeled as `role="group"` +
 * `aria-pressed` toggle buttons (not a tablist: it swaps no panel) with a
 * `fa-circle-dot` second channel for the active state under forced colors.
 */
export default function ModeToggle({ mode, onModeChange }: ModeToggleProps) {
  return (
    <div
      role="group"
      aria-label="Color mode"
      className="relative grid grid-cols-2 p-1 bg-[var(--mount-bg)] border border-[var(--mount-border)] rounded-full"
    >
      <div
        aria-hidden="true"
        className="absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-full motion-safe:[transition:transform_200ms_cubic-bezier(0.34,1.56,0.64,1)]"
        style={{
          backgroundColor: ESCAPE_HATCH_PILL[mode].fill,
          transform: mode === 'dark' ? 'translateX(100%)' : 'translateX(0)',
        }}
      />
      {MODE_OPTIONS.map((modeOption) => (
        <button
          key={modeOption}
          type="button"
          onClick={() => onModeChange(modeOption)}
          aria-pressed={mode === modeOption}
          style={
            mode === modeOption
              ? { color: ESCAPE_HATCH_PILL[modeOption].label }
              : undefined
          }
          className={`group relative z-10 min-h-[24px] px-3 py-1.5 text-[var(--mount-alt-text)] text-xs capitalize aria-pressed:font-semibold ${EDITOR_FOCUS_RING} rounded-full transition-colors`}
        >
          <span className="grid justify-center">
            <span
              aria-hidden="true"
              className="col-start-1 row-start-1 flex invisible items-center justify-center gap-1 font-semibold"
            >
              <i
                className="fa-solid fa-circle-dot text-[0.4rem]"
                aria-hidden="true"
              />
              {modeOption}
            </span>
            <span className="col-start-1 row-start-1 flex items-center justify-center gap-1">
              <i
                className="hidden group-aria-pressed:inline fa-solid fa-circle-dot text-[0.4rem]"
                aria-hidden="true"
              />
              {modeOption}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}
