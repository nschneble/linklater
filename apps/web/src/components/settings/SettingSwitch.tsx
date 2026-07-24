import type { ReactNode } from 'react';

interface SettingSwitchProps {
  /** Base id; derives `${id}-label`, `${id}-toggle`, `${id}-description`. */
  id: string;
  /** Visible label text (also the switch's accessible name). */
  label: string;
  /** Supporting copy below the label; plain text or inline markup. */
  description: ReactNode;
  /** Extra classes merged onto the label, e.g. a font-preview override. */
  labelClassName?: string;
  /** Current on/off state, mapped to `aria-checked`. */
  checked: boolean;
  /** Blocks interaction while an async persist is in flight. */
  disabled?: boolean;
  /** Fires when the user activates the switch. */
  onToggle: () => void;
}

/**
 * Presentational `role="switch"` toggle shared by the Accessibility settings
 * switches (CVD mode, dyslexic font, keyboard shortcuts). It owns only the
 * markup and ARIA wiring; each caller keeps its own state, persistence, and
 * error handling and renders this for the control.
 *
 * Uses `role="switch"` as required by ARIA for a binary toggle that has an
 * immediate effect (not a checkbox inside a form).
 */
export default function SettingSwitch({
  id,
  label,
  description,
  checked,
  disabled,
  onToggle,
  labelClassName,
}: SettingSwitchProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1 space-y-1">
        <label
          id={`${id}-label`}
          htmlFor={`${id}-toggle`}
          className={`block text-[var(--mount-text)] text-sm font-medium cursor-pointer ${labelClassName ?? ''}`}
        >
          {label}
        </label>
        <p
          id={`${id}-description`}
          className="bg-red-800 text-[var(--mount-alt-text)] text-xs text-pretty"
        >
          {description}
        </p>
      </div>

      <button
        type="button"
        id={`${id}-toggle`}
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        aria-describedby={`${id}-description`}
        disabled={disabled}
        onClick={onToggle}
        className="group relative inline-flex shrink-0 items-center w-11 h-6 mt-0.5 bg-[var(--orbit-bg)] aria-checked:bg-[var(--orbit-highlight)] border border-[var(--orbit-border)] aria-checked:border-transparent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] rounded-full transition-colors duration-200 cursor-pointer"
      >
        <span className="inline-block w-4 h-4 translate-x-1 group-aria-checked:translate-x-6 bg-white rounded-full shadow-sm transition-transform duration-200" />
        <span className="sr-only">{checked ? 'On' : 'Off'}</span>
      </button>
    </div>
  );
}
