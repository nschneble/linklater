import { FOCUS_RING } from '../../lib/styles';
import { createPortal } from 'react-dom';
import { useEffect, useImperativeHandle, useRef } from 'react';
import { useFocusReturn } from '../../lib/hooks/useFocusReturn';
import { useFocusTrap } from '../../lib/hooks/useFocusTrap';
import type { ReactNode, RefObject } from 'react';

/**
 * Imperative handle exposed to consumers via `controlRef`.
 */
export interface ModalControl {
  /**
   * Suppress focus restoration for the upcoming unmount. Use before
   * navigating away or intentionally moving focus elsewhere, where
   * restoring focus to the trigger would either fail (trigger
   * unmounted) or be disorienting.
   */
  skipRestore: () => void;
}

interface ModalProps {
  /**
   * ID of the heading element that labels the dialog. Required.
   * The consumer renders the heading inside `children` and assigns
   * this id to it. Wired to `aria-labelledby` on the dialog panel.
   */
  labelledBy: string;
  /**
   * ID of an element that describes the dialog. Optional — omit when
   * the dialog has no descriptive paragraph (e.g. reference lists).
   * Wired to `aria-describedby` on the dialog panel when present.
   */
  describedBy?: string;
  /**
   * Called when the user dismisses the dialog via the close button,
   * Escape key, or backdrop click.
   */
  onClose: () => void;
  /**
   * Accessible label for the close (X) button in the top-right corner.
   * Required — must be specific (e.g. "Close welcome") so AT users
   * know which dialog they're dismissing.
   */
  closeLabel: string;
  /**
   * Accessible label for the backdrop dismiss button. Required —
   * distinct from `closeLabel` is recommended to avoid duplicate
   * accessible names within the same view.
   */
  backdropLabel: string;
  /**
   * Tailwind classes appended to the panel's positioning + chrome
   * defaults. Override `max-w-*` / padding / rounded here. Defaults
   * to `'max-w-md p-7 rounded-2xl'` (matches WelcomeModal sizing).
   */
  panelClassName?: string;
  /**
   * Imperative handle exposing `skipRestore`. Consumers that navigate
   * away on action call `controlRef.current?.skipRestore()` before
   * `onClose()` so focus is not restored to a stale/unmounted trigger.
   */
  controlRef?: RefObject<ModalControl | null>;
  /**
   * Dialog body. The consumer renders the heading with `id={labelledBy}`
   * + `tabIndex={-1}` + `data-modal-initial-focus`, the description (if
   * any) with `id={describedBy}`, and any action buttons. The primitive
   * owns the close (X) button and the backdrop.
   */
  children: ReactNode;
}

const PANEL_BASE_CLASSES =
  'fixed z-30 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full bg-[var(--orbit-bg)] border-shadow select-none animate-fade-in-up';
const DEFAULT_PANEL_SIZING = 'max-w-md p-7 rounded-2xl';

/**
 * Modal dialog primitive. Owns:
 *  - portal to `document.body`
 *  - backdrop button (clickable + keyboard-reachable; closed on click)
 *  - close (X) button at top-right of the panel
 *  - focus trap within the panel
 *  - focus return to the previously focused element on unmount
 *    (suppressed via `controlRef.current?.skipRestore()`)
 *  - initial focus on the consumer-marked `[data-modal-initial-focus]`
 *    element (typically the heading)
 *  - body scroll lock while mounted
 *  - Escape key → `onClose`
 *
 * The consumer owns the heading, description, and body content. See
 * `WelcomeModal` and `KeyboardShortcutsModal` for reference shapes.
 */
export default function Modal({
  labelledBy,
  describedBy,
  onClose,
  closeLabel,
  backdropLabel,
  panelClassName,
  controlRef,
  children,
}: ModalProps) {
  const panelReference = useRef<HTMLDivElement>(null);

  const { skipRestore } = useFocusReturn(true);
  useImperativeHandle(controlRef, () => ({ skipRestore }), [skipRestore]);

  useFocusTrap(panelReference, { onEscape: onClose });

  useEffect(() => {
    const target = panelReference.current?.querySelector<HTMLElement>(
      '[data-modal-initial-focus]',
    );
    target?.focus();
  }, []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return createPortal(
    <>
      <button
        type="button"
        aria-label={backdropLabel}
        data-testid="modal-backdrop"
        className="fixed inset-0 z-20 w-full h-full scrim backdrop-blur-sm cursor-default"
        onClick={onClose}
      />
      <div
        ref={panelReference}
        className={`${PANEL_BASE_CLASSES} ${panelClassName ?? DEFAULT_PANEL_SIZING}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={closeLabel}
          className={`absolute top-4 right-4 flex items-center justify-center w-8 h-8 text-[var(--orbit-alt-text)] hover:text-[var(--orbit-text)] active:scale-[0.96] transition-colors cursor-pointer rounded-full ${FOCUS_RING}`}
        >
          <i className="fa-solid fa-xmark text-sm" aria-hidden="true" />
        </button>
        {children}
      </div>
    </>,
    document.body,
  );
}
