import { consumePendingNotice } from '../pendingNotice';
import { useEffect, useState } from 'react';

/**
 * One-shot read of the cross-route pending notice (see `pendingNotice.ts`).
 *
 * The read is deferred to a mount-effect (not synchronous render) because
 * NVDA and sometimes JAWS only announce an `aria-live` region when its
 * content changes after mount — content present on first paint is treated
 * as part of page load and skipped. Deferring guarantees the region
 * transitions empty → populated, which all major SRs announce reliably.
 *
 * Returns `{ notice, variant, dismiss }` (flat shape so consumers can spread
 * straight into `<PendingNoticeAnnouncer>` props):
 * - `notice` — the human-readable message, or `null`.
 * - `variant` — `'success'` (default when no notice is queued) or `'error'`.
 *   When `notice` is `null` the variant is inert — the announcer renders no
 *   visible toast and the sr-only mirror text is empty, so the ARIA shape
 *   doesn't matter until a notice arrives.
 * - `dismiss` — clears the local notice. Use when the surfacing UI
 *   (e.g. a Toast) is dismissed by the user or auto-times-out.
 *
 * The sessionStorage entry is cleared inside this hook the moment the
 * deferred read fires, so any sibling consumer mounting later in the
 * same session will receive `null` — first mount wins.
 */
export function usePendingNotice(): {
  notice: string | null;
  variant: 'success' | 'error';
  dismiss: () => void;
} {
  const [notice, setNotice] = useState<string | null>(null);
  const [variant, setVariant] = useState<'success' | 'error'>('success');

  useEffect(() => {
    const pending = consumePendingNotice();
    if (pending !== null) {
      setNotice(pending.message);
      setVariant(pending.variant);
    }
  }, []);

  return {
    notice,
    variant,
    dismiss: () => setNotice(null),
  };
}
