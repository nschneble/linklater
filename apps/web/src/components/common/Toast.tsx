import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Fixed-position notification that appears at the bottom of the screen and
 * auto-dismisses after 5 seconds (6 seconds for the warning and error
 * variants, whose default copy is longer and needs the extra read window).
 *
 * Announcement shape (matches CopyButton's sibling-live-region pattern): the
 * visible toast renders its message synchronously at first paint, so there is
 * no width-jump mid-animation, and it carries NO live-region role. A separate
 * `sr-only` sibling does the announcing: it mounts empty and gains the message
 * a couple of frames later so screen readers speak a genuine change (SC 4.1.3).
 * The `variant` picks the politeness:
 * - `'success'` and `'warning'` use `role="status"` / `aria-live="polite"` so
 *   the message is announced without interrupting the current read flow.
 *   Warning shares the polite channel with success because the underlying user
 *   action was intentional; the warn-highlight paint + `fa-triangle-exclamation`
 *   glyph carry the "heads-up, side-effect happened" signal redundantly.
 * - `'error'` uses `role="alert"` / `aria-live="assertive"` for immediate
 *   announcement, reserved for genuine errors that need user attention.
 *
 * The dismiss button stays in the visible part, outside the sr-only region, so
 * the announcement is the message text alone (no "Dismiss" spoken).
 *
 * A brief exit animation (`animate-fade-out-down`) plays before `onDismiss` is
 * called, giving the CSS transition 150ms to complete. The parent is responsible
 * for removing the `<Toast>` from the tree once `onDismiss` fires.
 *
 * Toast is `position: fixed` at the viewport bottom and intentionally takes no
 * `surface` prop. The `variant` drives THREE coupled axes: icon glyph, ARIA
 * live politeness, and bundle paint (`success-highlight` vs `warn-highlight`
 * vs `alert-highlight`). Coupling matters for a11y: the highlight color is
 * not decorative, it pairs with the icon glyph as the second channel of
 * meaning. A future contributor must not split these, e.g. `variant="error"`
 * with `aria-live="polite"`, or a neutral background paint, would break the
 * icon+color redundancy that lets CVD users distinguish error from success
 * from warning at a glance.
 *
 * CVD distinguishability rests on the icon-glyph redundancy
 * (`fa-circle-check` vs `fa-triangle-exclamation` vs `fa-circle-exclamation`),
 * the same pattern Alert.tsx uses; the alert/warn/success waiver pairs in
 * `bundles.distinguishability.test.ts` cite both components.
 */
export type ToastVariant = 'success' | 'warning' | 'error';

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
  variant?: ToastVariant;
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

const variantDismissRingClasses: Record<
  NonNullable<ToastProps['variant']>,
  string
> = {
  success: 'focus-visible:ring-[var(--success-highlight-fg)]',
  warning: 'focus-visible:ring-[var(--warn-highlight-fg)]',
  error: 'focus-visible:ring-[var(--alert-highlight-fg)]',
};

const variantDismissDelayMs: Record<
  NonNullable<ToastProps['variant']>,
  number
> = {
  success: 5000,
  warning: 6000,
  error: 6000,
};

export default function Toast({
  message,
  onDismiss,
  variant = 'success',
}: ToastProps) {
  const [exiting, setExiting] = useState(false);

  // SC 4.1.3: the sr-only announcement region must mount empty and gain its
  // text on a LATER frame. VoiceOver (Nick's whole stack is WebKit/VoiceOver)
  // frequently ignores a region whose text is already present at insertion,
  // because there is no change event to announce. Filling it a couple of
  // frames after mount makes it a genuine change the screen reader speaks.
  // Two frames because a single one can still land in the same paint as the
  // mount under React's batching. Only the sr-only region reads this value;
  // the visible toast paints `message` synchronously so it never reflows.
  const [announcedMessage, setAnnouncedMessage] = useState('');
  useEffect(() => {
    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => setAnnouncedMessage(message));
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
    };
  }, [message]);

  // Mirror onDismiss into a ref so the auto-dismiss timer doesn't restart
  // every time a parent re-renders with a fresh inline arrow. Consumers
  // (AuthForm, LinksView, BookmarkletSection, SettingsView) pass
  // `onDismiss={() => ...}` – without this ref the timer would extend
  // each time the parent's local state flips mid-window (e.g.
  // forgot-password sentinel-hold 5000ms after success → 5+5 = ~10s
  // visible toast).
  const onDismissReference = useRef(onDismiss);
  onDismissReference.current = onDismiss;

  const dismiss = useCallback(() => {
    setExiting(true);
    setTimeout(() => onDismissReference.current(), 150);
  }, []);

  useEffect(() => {
    const timer = setTimeout(dismiss, variantDismissDelayMs[variant]);
    return () => clearTimeout(timer);
  }, [dismiss, variant]);

  const ariaLive = variant === 'error' ? 'assertive' : 'polite';
  const role = variant === 'error' ? 'alert' : 'status';

  // Focus indicator on the dismiss button is `--{state}-highlight-fg` (the
  // bundle's own highlight-fg) rather than the universal `--focus-ring`.
  // Recovery Option A per a11y-lead brief: the dismiss button paints on the
  // toast's `--{state}-highlight` background; the per-theme `--focus-ring`
  // hex (historically aliased to `--accent`, now retired) failed 3:1
  // against `--{state}-highlight` on most themes per looper culori
  // verification. The highlight-fg color already clears 4.5:1 against
  // highlight by the existing bundle contract, so the ring inherits a
  // comfortable SC 1.4.11 margin by construction – an unconditional
  // uplift regardless of per-theme variance.
  return (
    <>
      <div
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
          onClick={dismiss}
          className={`p-1.5 -m-1.5 ml-0.5 opacity-60 hover:opacity-100 transition-opacity active:scale-[0.96] cursor-pointer focus-visible:outline-none focus-visible:ring-2 ${variantDismissRingClasses[variant]} forced-colors:focus-visible:outline-2 forced-colors:focus-visible:outline-[ButtonText] rounded-full`}
        >
          <i className="fa-solid fa-xmark text-xs" aria-hidden="true" />
        </button>
      </div>
      {/*
        Announcement region, separate from the visible toast above. It mounts
        empty and gains the message a couple of frames later (see the
        announcedMessage effect) so the screen reader treats it as a genuine
        change and speaks it. Holds ONLY the message text: the Dismiss button
        lives in the visible part so "Dismiss" is never spoken as part of the
        announcement.
      */}
      <span
        role={role}
        aria-live={ariaLive}
        aria-atomic="true"
        className="sr-only"
      >
        {announcedMessage}
      </span>
    </>
  );
}
