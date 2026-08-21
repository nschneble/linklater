import { BUSY } from '../../lib/styles';
import type { ReactNode } from 'react';

interface SettingSwitchProps {
  /** Base id; derives `${id}-label`, `${id}-toggle`, `${id}-description`. */
  id: string;
  /** Visible label text (also the switch's accessible name). */
  label: string;
  /**
   * Supporting copy below the label. An accessible description is flattened
   * to a string, so anything interactive belongs in `followUpAction`.
   */
  description: ReactNode;
  /** Control rendered below the description, and outside it. */
  followUpAction?: ReactNode;
  /** Extra classes merged onto the label, e.g. a font-preview override. */
  labelClassName?: string;
  /** Current on/off state, mapped to `aria-checked`. */
  checked: boolean;
  /** Refuses activation while an async persist is in flight. */
  busy?: boolean;
  /** Fires when the user activates the switch. */
  onToggle: () => void;
}

/**
 * Presentational `role="switch"` toggle - an immediate-effect control,
 * not a checkbox inside a form - shared by the three Accessibility
 * settings switches; callers own state and persistence. A busy caller
 * refuses through `aria-disabled`, which unlike the native attribute
 * keeps focus.
 */
export default function SettingSwitch({
  id,
  label,
  description,
  followUpAction,
  checked,
  busy,
  onToggle,
  labelClassName,
}: SettingSwitchProps) {
  // aria-disabled leaves the switch clickable, so the guard lives here
  function handleClick() {
    if (busy === true) return;
    onToggle();
  }

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
          className="text-[var(--mount-alt-text)] text-xs text-pretty"
        >
          {description}
        </p>
        {followUpAction}
      </div>

      <button
        type="button"
        id={`${id}-toggle`}
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        aria-describedby={`${id}-description`}
        aria-disabled={busy || undefined}
        aria-busy={busy || undefined}
        data-busy={busy || undefined}
        onClick={handleClick}
        className={`group relative inline-flex shrink-0 items-center w-11 h-6 mt-0.5 bg-[var(--orbit-bg)] aria-checked:bg-[var(--orbit-highlight)] border border-[var(--orbit-border)] aria-checked:border-transparent forced-colors:border-[ButtonText] forced-colors:aria-checked:border-[Highlight] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] rounded-full transition-colors duration-200 cursor-pointer ${BUSY}`}
      >
        <span className="inline-block w-4 h-4 translate-x-1 group-aria-checked:translate-x-6 bg-white rounded-full shadow-sm transition-transform duration-200" />
      </button>
    </div>
  );
}
