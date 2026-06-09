import { useCallback, useEffect, useState } from 'react';

/**
 * Fixed-position notification that appears at the bottom of the screen and
 * auto-dismisses after 3 seconds.
 *
 * - `'success'` uses `role="status"` and `aria-live="polite"` so screen
 *   readers announce the message without interrupting the current read flow.
 * - `'error'` uses `role="alert"` and `aria-live="assertive"` for immediate
 *   announcement — reserved for genuine errors that require user attention.
 *
 * A brief exit animation (`animate-fade-out-down`) plays before `onDismiss` is
 * called, giving the CSS transition 150ms to complete. The parent is responsible
 * for removing the `<Toast>` from the tree once `onDismiss` fires.
 *
 * Toast is `position: fixed` at the viewport bottom and intentionally takes no
 * `surface` prop — the variant alone drives the paint via state-bundle
 * highlight slots. CVD distinguishability rests on the icon-glyph redundancy
 * (`fa-circle-check` vs `fa-circle-exclamation`), the same pattern Alert.tsx
 * uses; the alert/success waiver pairs in `bundles.distinguishability.test.ts`
 * cite both components.
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
   * `'error'`: `fa-circle-exclamation` icon, `aria-live="assertive"`,
   *   alert-highlight fill.
   */
  variant?: 'success' | 'error';
}

const variantIcons: Record<NonNullable<ToastProps['variant']>, string> = {
  success: 'fa-circle-check',
  error: 'fa-circle-exclamation',
};

const variantContainerClasses: Record<
  NonNullable<ToastProps['variant']>,
  string
> = {
  success: 'bg-[var(--success-highlight)] text-[var(--success-highlight-fg)]',
  error: 'bg-[var(--alert-highlight)] text-[var(--alert-highlight-fg)]',
};

const variantDismissRingClasses: Record<
  NonNullable<ToastProps['variant']>,
  string
> = {
  success: 'focus-visible:ring-[var(--success-highlight-fg)]',
  error: 'focus-visible:ring-[var(--alert-highlight-fg)]',
};

export default function Toast({
  message,
  onDismiss,
  variant = 'success',
}: ToastProps) {
  const [exiting, setExiting] = useState(false);

  const dismiss = useCallback(() => {
    setExiting(true);
    setTimeout(onDismiss, 150);
  }, [onDismiss]);

  useEffect(() => {
    const timer = setTimeout(dismiss, 3000);
    return () => clearTimeout(timer);
  }, [dismiss]);

  const ariaLive = variant === 'error' ? 'assertive' : 'polite';
  const role = variant === 'error' ? 'alert' : 'status';

  // Focus indicator on the dismiss button is `--{state}-highlight-fg` (the
  // bundle's own highlight-fg) rather than the universal `--focus-ring`.
  // Recovery Option A per a11y-lead brief: `--focus-ring` aliases the
  // theme `--accent`, which is near-identical luminance to the
  // state-highlights on every theme (verified 20/20 fail 3:1 against
  // success-highlight + alert-highlight). The highlight-fg color already
  // clears 4.5:1 against highlight by the existing bundle contract, so the
  // ring inherits a comfortable SC 1.4.11 margin by construction.
  return (
    <div
      role={role}
      aria-live={ariaLive}
      className={`fixed bottom-6 inset-x-0 mx-auto w-fit z-50 flex items-center gap-2 px-4 py-2.5 ${variantContainerClasses[variant]} border-shadow text-sm font-medium rounded-full ${
        exiting ? 'animate-fade-out-down' : 'animate-fade-in-up'
      }`}
    >
      <i
        className={`fa-solid ${variantIcons[variant]} text-xs`}
        aria-hidden="true"
      />
      {message}
      <button
        type="button"
        aria-label="Dismiss"
        onClick={dismiss}
        className={`p-1.5 -m-1.5 ml-0.5 opacity-60 hover:opacity-100 transition-opacity active:scale-[0.96] cursor-pointer focus-visible:outline-none focus-visible:ring-2 ${variantDismissRingClasses[variant]} rounded-full`}
      >
        <i className="fa-solid fa-xmark text-xs" aria-hidden="true" />
      </button>
    </div>
  );
}
