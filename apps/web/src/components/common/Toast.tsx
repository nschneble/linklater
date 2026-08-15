import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Fixed-position notification that appears at the bottom of the screen and
 * auto-dismisses after 5 seconds (6 seconds for the warning and error
 * variants – their default copy is longer and the SR announcement needs
 * the extra read window).
 *
 * - `'success'` and `'warning'` both use `role="status"` and
 *   `aria-live="polite"` so screen readers announce the message without
 *   interrupting the current read flow. Warning shares the polite channel
 *   with success because the underlying user action was intentional; the
 *   warn-highlight paint + `fa-triangle-exclamation` glyph carry the
 *   "heads-up, side-effect happened" signal redundantly.
 * - `'error'` uses `role="alert"` and `aria-live="assertive"` for immediate
 *   announcement – reserved for genuine errors that require user attention.
 *
 * A brief exit animation (`animate-fade-out-down`) plays before `onDismiss` is
 * called, giving the CSS transition 150ms to complete. The parent is responsible
 * for removing the `<Toast>` from the tree once `onDismiss` fires.
 *
 * Toast is `position: fixed` at the viewport bottom and intentionally takes no
 * `surface` prop. The `variant` drives THREE coupled axes – icon glyph, ARIA
 * live politeness, and bundle paint (`success-highlight` vs `warn-highlight`
 * vs `alert-highlight`). Coupling matters for a11y: the highlight color is
 * not decorative, it pairs with the icon glyph as the second channel of
 * meaning. A future contributor must not split these – e.g. allowing
 * `variant="error"` with `aria-live="polite"`, or a neutral background
 * paint, would break the icon+color redundancy that lets CVD users
 * distinguish error from success from warning at a glance.
 *
 * CVD distinguishability rests on the icon-glyph redundancy
 * (`fa-circle-check` vs `fa-triangle-exclamation` vs `fa-circle-exclamation`),
 * the same pattern Alert.tsx uses; the alert/warn/success waiver pairs in
 * `bundles.distinguishability.test.ts` cite both components.
 */
interface ToastProps {
  message: string;
  /**
   * Called 150ms after the exit animation begins (either from the auto-dismiss
   * timer or from the user clicking the dismiss button). The parent should
   * unmount the toast at this point.
   */
  onDismiss: () => void;
  /**
   * Controls icon, ARIA live region behavior, AND bundle paint.
   * `'success'` (default): `fa-circle-check` icon, `aria-live="polite"`,
   *   success-highlight fill.
   * `'warning'`: `fa-triangle-exclamation` icon, `aria-live="polite"`,
   *   warn-highlight fill, 6s auto-dismiss (vs 5s for success).
   * `'error'`: `fa-circle-exclamation` icon, `aria-live="assertive"`,
   *   alert-highlight fill, 6s auto-dismiss (vs 5s for success).
   */
  variant?: 'success' | 'warning' | 'error';
  /**
   * When `true` (default) the toast owns its own live region (`role` +
   * `aria-live` per `variant`) and announces itself. Set `false` to render a
   * purely visual card with no ARIA live semantics – used when the parent
   * announces the same message through a separate, always-mounted live region
   * so a conditionally-mounted toast doesn't miss the first announcement.
   */
  announce?: boolean;
}

const variantIcons: Record<NonNullable<ToastProps['variant']>, string> = {
  success: 'fa-circle-check',
  warning: 'fa-triangle-exclamation',
  error: 'fa-circle-exclamation',
};

const variantContainerClasses: Record<
  NonNullable<ToastProps['variant']>,
  string
> = {
  success: 'bg-[var(--success-highlight)] text-[var(--success-highlight-fg)]',
  warning: 'bg-[var(--warn-highlight)] text-[var(--warn-highlight-fg)]',
  error: 'bg-[var(--alert-highlight)] text-[var(--alert-highlight-fg)]',
};

const variantDismissOutlineClasses: Record<
  NonNullable<ToastProps['variant']>,
  string
> = {
  success: 'focus-visible:outline-[var(--success-highlight-fg)]',
  warning: 'focus-visible:outline-[var(--warn-highlight-fg)]',
  error: 'focus-visible:outline-[var(--alert-highlight-fg)]',
};

const variantDismissDelayMs: Record<
  NonNullable<ToastProps['variant']>,
  number
> = {
  success: 5000,
  warning: 6000,
  error: 6000,
};

const variantAriaLive: Record<
  NonNullable<ToastProps['variant']>,
  'assertive' | 'polite'
> = {
  success: 'polite',
  warning: 'polite',
  error: 'assertive',
};

const variantRole: Record<
  NonNullable<ToastProps['variant']>,
  'alert' | 'status'
> = {
  success: 'status',
  warning: 'status',
  error: 'alert',
};

export default function Toast({
  message,
  onDismiss,
  variant = 'success',
  announce = true,
}: ToastProps) {
  const [exiting, setExiting] = useState(false);

  // hold onDismiss in a ref so parent re-renders don't restart the timer
  const onDismissReference = useRef(onDismiss);
  onDismissReference.current = onDismiss;

  const handleDismiss = useCallback(() => {
    setExiting(true);
    setTimeout(() => onDismissReference.current(), 150);
  }, []);

  useEffect(() => {
    const timer = setTimeout(handleDismiss, variantDismissDelayMs[variant]);
    return () => clearTimeout(timer);
  }, [handleDismiss, variant]);

  // announce=false: parent owns the live region; else variant picks role + live
  let ariaLive: 'assertive' | 'polite' | undefined;
  let role: 'alert' | 'status' | undefined;
  if (announce) {
    ariaLive = variantAriaLive[variant];
    role = variantRole[variant];
  }

  // dismiss ring uses --{state}-highlight-fg; --focus-ring failed 3:1 on the highlight bg
  return (
    <div
      role={role}
      aria-live={ariaLive}
      className={`fixed bottom-6 inset-x-0 mx-auto w-fit z-50 flex items-center gap-2 px-4 py-2.5 ${variantContainerClasses[variant]} border-shadow forced-colors:border forced-colors:border-[CanvasText] forced-colors:text-[CanvasText] text-sm font-medium rounded-full ${
        exiting ? 'animate-fade-out-down' : 'animate-fade-in-up'
      }`}
    >
      <i
        className={`fa-solid ${variantIcons[variant]} text-sm`}
        aria-hidden="true"
      />
      {message}
      <button
        type="button"
        aria-label="Dismiss"
        onClick={handleDismiss}
        className={`p-1.5 -m-1.5 ml-0.5 opacity-60 hover:opacity-100 transition-opacity active:scale-[0.96] cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 ${variantDismissOutlineClasses[variant]} forced-colors:focus-visible:outline-[Highlight] rounded-full`}
      >
        <i className="fa-solid fa-xmark text-xs" aria-hidden="true" />
      </button>
    </div>
  );
}
