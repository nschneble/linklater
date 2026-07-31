import { useState } from 'react';

/**
 * Tiny single-toast state holder shared by views that own one `<Toast>`.
 *
 * `message` is the current toast text (or `null` for no toast). `show`
 * sets the message; `dismiss` clears it. No queue, no auto-timeout; the
 * `<Toast>` component owns its own auto-dismiss behavior and calls back
 * into `dismiss` via its `onDismiss` prop.
 */
export function useToast(): {
  message: string | null;
  show: (message: string) => void;
  dismiss: () => void;
} {
  const [message, setMessage] = useState<string | null>(null);

  return {
    message,
    show: (next) => setMessage(next),
    dismiss: () => setMessage(null),
  };
}
