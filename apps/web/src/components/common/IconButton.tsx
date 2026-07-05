import type { ButtonHTMLAttributes, Ref } from 'react';
import {
  DISABLED,
  FOCUS_RING,
  FOCUS_RING_DANGER,
  FOCUS_RING_DANGER_FILLED,
} from '../../lib/styles';

/**
 * Small pill-shaped button used for secondary actions throughout the app.
 *
 * When `hidden` is `true` the button fades out and becomes non-interactive
 * (`pointer-events-none`, `tabIndex={-1}`). This is used to animate controls
 * in/out without removing them from the DOM (which would cause layout shift).
 *
 * The `surface` prop names the bundle of the parent surface – i.e. which
 * bundle hosts this button. Host-driven variants (`default`, `ghost`,
 * `elevated`) paint themselves from the host bundle's slots so the button
 * stays coherent with its background. Intrinsic variants (`danger`,
 * `danger-filled`) ignore `surface` and paint from the alert bundle
 * regardless of host. Defaults to `'mount'` – most consumers live inside a
 * `SettingsGroup`, `AuthCard`, or modal panel.
 *
 * Same `surface` semantics as `FormInput`/`SlidingTabBar`/`TabButton`: the
 * prop names the host bundle, the component derives its own paint.
 */
interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * When `true`, the button is invisible and non-interactive but still occupies
   * layout space. Useful for conditionally showing controls without reflow.
   */
  hidden?: boolean;
  /**
   * Visual style. `default`/`ghost`/`elevated` paint from the host bundle
   * (driven by `surface`); `danger`/`danger-filled` paint from the alert
   * bundle regardless of host. `elevated` lifts one tier up from the host
   * for its fill (used by the floating action buttons in
   * `LinksControls`/`LinksMobileControls`/`StumblePage`).
   */
  variant?: 'default' | 'danger' | 'danger-filled' | 'ghost' | 'elevated';
  /**
   * Which bundle surface hosts this button (i.e. the bundle of the parent
   * surface). Defaults to `'mount'`. Host-driven variants
   * (`default`/`ghost`/`elevated`) paint per host; intrinsic variants
   * (`danger`/`danger-filled`) ignore this prop.
   *
   * `orbit` host is supported for the `default`/`ghost` non-hover paint and
   * the `danger`/`danger-filled` intrinsic paints. The `elevated` variant on
   * `orbit` would require an over-orbit slot that does not exist; no
   * consumer exercises it today (ApiTokenRow is the only orbit-host
   * consumer and uses only `danger`/`ghost`). If a future orbit-host
   * consumer needs `elevated` or `default`/`ghost` hover-bg, STOP and add
   * the slot per the bundle-slot-add-reverify protocol; do not silently
   * fall back to mount paint.
   */
  surface?: 'base' | 'mount' | 'orbit';
  ref?: Ref<HTMLButtonElement>;
}

const SMALL_PADDING = 'px-3 py-1.5';

type Variant = NonNullable<IconButtonProps['variant']>;
type Surface = NonNullable<IconButtonProps['surface']>;

/*
 * Host-driven variants resolve their paint from the active surface. Intrinsic
 * variants (`danger`, `danger-filled`) read straight from the alert bundle
 * regardless of host and are shared across surfaces.
 *
 * `default` and `elevated` lift one tier UP from the host on hover (or as
 * their fill, for `elevated`). `ghost` carries no hover-bg in any host.
 */
const variantClassesByHost: Record<Surface, Record<Variant, string>> = {
  base: {
    default: `${SMALL_PADDING} hover:bg-[var(--mount-bg)] disabled:bg-inherit aria-disabled:bg-inherit ring-1 ring-[var(--base-border)] text-[var(--base-text)] ${FOCUS_RING} disabled:active:scale-100 aria-disabled:active:scale-100`,
    danger: `${SMALL_PADDING} hover:bg-[var(--alert-bg)] ring-1 ring-[var(--alert-border)] text-[var(--alert-text)] ${FOCUS_RING_DANGER}`,
    // danger-filled paints --alert-highlight as its fill, so the focus
    // ring switches to --alert-highlight-fg – a same-color ring would
    // paint 1:1 invisible. Recovery A, Toast precedent.
    'danger-filled': `${SMALL_PADDING} bg-[var(--alert-highlight)] hover:bg-[var(--alert-highlight-hover)] ring-1 ring-[var(--alert-highlight)] hover:ring-[var(--alert-highlight-hover)] text-[var(--alert-highlight-fg)] ${FOCUS_RING_DANGER_FILLED}`,
    ghost: `${SMALL_PADDING} ring-1 ring-[var(--base-border)] text-[var(--base-alt-text)] ${FOCUS_RING}`,
    elevated: `pl-3.5 pr-4 py-2 bg-[var(--mount-bg)] disabled:bg-[var(--mount-bg)] aria-disabled:bg-[var(--mount-bg)] hover:bg-[var(--orbit-bg)] border-shadow hover:border-shadow text-[var(--mount-text)] font-semibold disabled:active:scale-100 aria-disabled:active:scale-100`,
  },
  mount: {
    default: `${SMALL_PADDING} hover:bg-[var(--orbit-bg)] disabled:bg-inherit aria-disabled:bg-inherit ring-1 ring-[var(--mount-border)] text-[var(--mount-text)] ${FOCUS_RING} disabled:active:scale-100 aria-disabled:active:scale-100`,
    danger: `${SMALL_PADDING} hover:bg-[var(--alert-bg)] ring-1 ring-[var(--alert-border)] text-[var(--alert-text)] ${FOCUS_RING_DANGER}`,
    'danger-filled': `${SMALL_PADDING} bg-[var(--alert-highlight)] hover:bg-[var(--alert-highlight-hover)] ring-1 ring-[var(--alert-highlight)] hover:ring-[var(--alert-highlight-hover)] text-[var(--alert-highlight-fg)] ${FOCUS_RING_DANGER_FILLED}`,
    ghost: `${SMALL_PADDING} ring-1 ring-[var(--mount-border)] text-[var(--mount-alt-text)] ${FOCUS_RING}`,
    elevated: `pl-3.5 pr-4 py-2 bg-[var(--orbit-bg)] disabled:bg-[var(--orbit-bg)] aria-disabled:bg-[var(--orbit-bg)] hover:bg-[var(--mount-bg)] border-shadow hover:border-shadow text-[var(--orbit-text)] font-semibold disabled:active:scale-100 aria-disabled:active:scale-100`,
  },
  orbit: {
    // Default/ghost on orbit host: no hover-bg slot exists (no `over-orbit`
    // tier in the bundle system). No consumer exercises default/ghost hover
    // on orbit today – ApiTokenRow uses only `danger` + `ghost`, and ghost
    // carries no hover-bg in any host. If a future consumer needs default
    // hover or elevated on orbit, STOP and add the slot per
    // [[feedback-bundle-slot-add-reverify]] – do not silently fall back.
    default: `${SMALL_PADDING} disabled:bg-inherit aria-disabled:bg-inherit ring-1 ring-[var(--orbit-border)] text-[var(--orbit-text)] ${FOCUS_RING} disabled:active:scale-100 aria-disabled:active:scale-100`,
    danger: `${SMALL_PADDING} hover:bg-[var(--alert-bg)] ring-1 ring-[var(--alert-border)] text-[var(--alert-text)] ${FOCUS_RING_DANGER}`,
    'danger-filled': `${SMALL_PADDING} bg-[var(--alert-highlight)] hover:bg-[var(--alert-highlight-hover)] ring-1 ring-[var(--alert-highlight)] hover:ring-[var(--alert-highlight-hover)] text-[var(--alert-highlight-fg)] ${FOCUS_RING_DANGER_FILLED}`,
    ghost: `${SMALL_PADDING} ring-1 ring-[var(--orbit-border)] text-[var(--orbit-alt-text)] ${FOCUS_RING}`,
    // `elevated` on orbit host has no over-orbit slot. Marked unsupported;
    // no consumer reaches this combination.
    elevated: `pl-3.5 pr-4 py-2 bg-[var(--orbit-bg)] disabled:bg-[var(--orbit-bg)] aria-disabled:bg-[var(--orbit-bg)] border-shadow text-[var(--orbit-text)] font-semibold disabled:active:scale-100 aria-disabled:active:scale-100`,
  },
};

export default function IconButton({
  className = '',
  children,
  disabled,
  hidden = false,
  variant = 'default',
  surface = 'mount',
  ...props
}: IconButtonProps) {
  const visibilityClasses = hidden
    ? 'opacity-0 scale-95 pointer-events-none'
    : 'opacity-100 scale-100';

  // Skip DISABLED when hidden: `disabled:opacity-60` has higher CSS specificity
  // than `opacity-0` and would render hidden buttons at 60% opacity instead of invisible.
  const disabledClasses = hidden ? '' : DISABLED;

  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 text-xs rounded-full cursor-pointer ${disabledClasses} active:scale-[0.96] transition duration-200 ${variantClassesByHost[surface][variant]} ${visibilityClasses} ${className}`}
      type="button"
      data-surface={surface}
      // GOTCHA: `disabled` + `aria-hidden` together give complete AT isolation:
      // `disabled` removes the button from the tab order and interactive AT tree;
      // `aria-hidden` seals browse-mode traversal (e.g. NVDA arrow keys) so screen
      // readers don't announce the invisible button's text. `aria-hidden` is safe
      // here because `disabled` already makes the element non-focusable.
      disabled={hidden || disabled}
      aria-hidden={hidden || undefined}
      tabIndex={hidden ? -1 : undefined}
      {...props}
    >
      {children}
    </button>
  );
}
