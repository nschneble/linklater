import { consumePendingNotice } from '../pendingNotice';
import { useEffect, useState } from 'react';

/**
 * One-shot read of the cross-route pending notice (see `pendingNotice.ts`).
 *
 * The read is deferred to a mount-effect (not synchronous render) because
 * NVDA and sometimes JAWS only announce an `aria-live` region when its
 * content changes after mount; content present on first paint is treated
 * as part of page load and skipped. Deferring guarantees the region
 * transitions empty → populated, which all major SRs announce reliably.
 *
 * Returns `{ notice, variant, dismiss }` (flat shape so consumers can spread
 * straight into `<PendingNoticeAnnouncer>` props):
 * - `notice`: the human-readable message, or `null`.
 * - `variant`: `'success'` (default when no notice is queued), `'warning'`,
 *   or `'error'`. When `notice` is `null` the variant is inert; the
 *   announcer renders no visible toast and the sr-only mirror text is empty,
 *   so the ARIA shape doesn't matter until a notice arrives.
 * - `standing`: the entry's own flag, `false` when nothing is queued. A
 *   message the arriving page is accounting for itself with cannot ride
 *   a dismiss timer, and a flag dropped on the way here fails quietly,
 *   since a toast that times out looks like a toast that worked.
 * - `dismiss`: clears the local notice. Use when the surfacing UI
 *   (e.g. a Toast) is dismissed by the user or auto-times-out.
 *
 * The sessionStorage entry is cleared inside this hook the moment the
 * deferred read fires, so any sibling consumer mounting later in the
 * same session will receive `null`; first mount wins.
 */
export function usePendingNotice(): {
  notice: string | null;
  variant: 'success' | 'warning' | 'error';
  standing: boolean;
  dismiss: () => void;
} {
  const [notice, setNotice] = useState<string | null>(null);
  const [variant, setVariant] = useState<'success' | 'warning' | 'error'>(
    'success',
  );
  const [standing, setStanding] = useState(false);

  useEffect(() => {
    const pending = consumePendingNotice();
    if (pending !== null) {
      setNotice(pending.message);
      setVariant(pending.variant);
      setStanding(pending.standing ?? false);
    }
  }, []);

  return {
    notice,
    variant,
    standing,
    dismiss: () => setNotice(null),
  };
}
