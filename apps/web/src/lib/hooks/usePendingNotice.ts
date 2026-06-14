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
 * Returns `{ notice, dismiss }`:
 * - `notice` — the human-readable message, or `null`.
 * - `dismiss` — clears the local notice. Use when the surfacing UI
 *   (e.g. a Toast) is dismissed by the user or auto-times-out.
 *
 * The sessionStorage entry is cleared inside this hook the moment the
 * deferred read fires, so any sibling consumer mounting later in the
 * same session will receive `null` — first mount wins.
 */
export function usePendingNotice(): {
  notice: string | null;
  dismiss: () => void;
} {
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const pending = consumePendingNotice();
    if (pending !== null) setNotice(pending);
  }, []);

  return {
    notice,
    dismiss: () => setNotice(null),
  };
}
