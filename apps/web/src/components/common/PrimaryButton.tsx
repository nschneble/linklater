import { DISABLED, FOCUS_RING } from '../../lib/styles';
import type { ButtonHTMLAttributes, Ref } from 'react';

/**
 * Primary call-to-action button. Defaults to `type="submit"` so it can be
 * dropped inside a `<form>` without extra wiring; pass `type="button"` when
 * using outside a form.
 *
 * When `hidden` is `true` the button fades out and becomes non-interactive
 * while still occupying layout space - same pattern as `IconButton`.
 *
 * The `surface` prop names the bundle of the parent surface - i.e. which
 * bundle hosts this button. The fill/hover/text resolve from that bundle's
 * highlight slots (`--{surface}-highlight` / `-highlight-fg` /
 * `-highlight-hover`). Defaults to `'mount'` - most consumers live inside a
 * `SettingsGroup`, `AuthCard`, or modal panel.
 *
 * Same `surface` semantics as `IconButton` / `LinkButton` / `FormInput` /
 * `SlidingTabBar` / `TabButton`.
 */
interface PrimaryButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * When `true`, the button is invisible and non-interactive but still occupies
   * layout space. Keeps toolbar layouts stable when controls are conditionally shown.
   */
  hidden?: boolean;
  /**
   * Which bundle surface hosts this button (i.e. the bundle of the parent
   * surface). Defaults to `'mount'`.
   */
  surface?: 'base' | 'mount' | 'orbit';
  ref?: Ref<HTMLButtonElement>;
}

type Surface = NonNullable<PrimaryButtonProps['surface']>;

const fillByHost: Record<Surface, string> = {
  base: 'bg-[var(--base-highlight)] disabled:bg-[var(--base-highlight)] hover:bg-[var(--base-highlight-hover)] text-[var(--base-highlight-fg)]',
  mount:
    'bg-[var(--mount-highlight)] disabled:bg-[var(--mount-highlight)] hover:bg-[var(--mount-highlight-hover)] text-[var(--mount-highlight-fg)]',
  orbit:
    'bg-[var(--orbit-highlight)] disabled:bg-[var(--orbit-highlight)] hover:bg-[var(--orbit-highlight-hover)] text-[var(--orbit-highlight-fg)]',
};

/**
 * The paint alone, for the one affordance a `<button>` cannot carry: a
 * navigation. An anchor keeps middle-click, ctrl-click, open-in-new-tab and
 * the context menu, and announces as a link rather than a button, so a
 * caller whose action is a document load renders an `<a>` and borrows this
 * rather than restating a class list that would then drift.
 *
 * `stateClasses` is the disabled tier, which only the button has and which
 * belongs between the radius and the transition per the ordering rules.
 */
export function primaryActionClasses(
  surface: Surface = 'mount',
  stateClasses = '',
): string {
  return `inline-flex items-center justify-center gap-1.5 pl-3.5 pr-4 py-2 ${fillByHost[surface]} border-shadow hover:border-shadow text-xs font-semibold ${FOCUS_RING} rounded-full ${stateClasses} transition duration-200 active:scale-[0.96] disabled:active:scale-100 cursor-pointer`;
}

export default function PrimaryButton({
  children,
  className = '',
  disabled,
  hidden = false,
  surface = 'mount',
  type = 'submit',
  ...props
}: PrimaryButtonProps) {
  const visibilityClasses = hidden
    ? 'opacity-0 scale-95 pointer-events-none'
    : 'opacity-100 scale-100';

  // skip disabled when hidden (disabled:opacity-60 outranks opacity-0)
  const disabledClasses = hidden ? '' : DISABLED;

  return (
    <button
      className={`${primaryActionClasses(surface, disabledClasses)} ${visibilityClasses} ${className}`}
      type={type}
      data-surface={surface}
      // disabled + aria-hidden hide from AT; disabled already blocks focus
      disabled={hidden || disabled}
      aria-hidden={hidden || undefined}
      tabIndex={hidden ? -1 : undefined}
      {...props}
    >
      {children}
    </button>
  );
}
