import { useCallback, useEffect, useState } from 'react';
import { FOCUS_RING } from '../../lib/styles';

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
   * Controls icon and ARIA live region behavior.
   * `'success'` (default): `fa-circle-check` icon, `aria-live="polite"`.
   * `'error'`: `fa-circle-exclamation` icon, `aria-live="assertive"`.
   */
  variant?: 'success' | 'error';
}

const variantIcons: Record<NonNullable<ToastProps['variant']>, string> = {
  success: 'fa-circle-check',
  error: 'fa-circle-exclamation',
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

  return (
    <div
      role={role}
      aria-live={ariaLive}
      className={`fixed bottom-6 inset-x-0 mx-auto w-fit z-50 flex items-center gap-2 px-4 py-2.5 bg-[var(--text)] border-shadow text-[var(--bg)] text-sm font-medium rounded-full ${
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
        className={`p-1.5 -m-1.5 ml-0.5 opacity-60 hover:opacity-100 transition-opacity active:scale-[0.96] cursor-pointer ${FOCUS_RING} rounded-full`}
      >
        <i className="fa-solid fa-xmark text-xs" aria-hidden="true" />
      </button>
    </div>
  );
}
