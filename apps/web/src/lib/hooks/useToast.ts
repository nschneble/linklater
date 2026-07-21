import { useCallback, useState } from 'react';
import type { ToastVariant } from '../../components/common/Toast';

interface ToastState {
  message: string;
  variant: ToastVariant;
}

/**
 * Tiny single-toast state holder shared by views that own one `<Toast>`.
 *
 * `message` is the current toast text (or `null` for no toast) and `variant`
 * is its paint/announcement channel (defaults to `'success'`). `show` sets
 * both; `dismiss` clears them. No queue, no auto-timeout – the `<Toast>`
 * component owns its own auto-dismiss behavior and calls back into `dismiss`
 * via its `onDismiss` prop.
 */
export function useToast(): {
  message: string | null;
  variant: ToastVariant | undefined;
  show: (message: string, variant?: ToastVariant) => void;
  dismiss: () => void;
} {
  const [toast, setToast] = useState<ToastState | null>(null);

  const show = useCallback(
    (message: string, variant: ToastVariant = 'success') => {
      setToast({ message, variant });
    },
    [],
  );

  const dismiss = useCallback(() => setToast(null), []);

  return {
    message: toast?.message ?? null,
    variant: toast?.variant,
    show,
    dismiss,
  };
}
