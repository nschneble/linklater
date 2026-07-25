import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';

/**
 * One-shot deferred read of "flash" query params (e.g. `?linked=…`,
 * `?link_error=…`) – the post-redirect breadcrumbs that drive a Toast or
 * inline Alert and then need to disappear from the URL.
 *
 * Returns `null` on first render; runs `read(parameters)` once inside a
 * mount-effect, stores the parsed result, and strips `parameterKeys` from
 * the URL via `setSearchParameters({}, { replace: true })`. The stored
 * result remains stable across re-renders; consumers spread it into
 * their own state in an effect (so dismissal is a local concern).
 *
 * # Why the read is deferred to a mount-effect
 *
 * NVDA and JAWS only announce an `aria-live` region when its content
 * transitions empty → populated. Content present on first paint is treated
 * as part of page load and skipped. Reading the params synchronously in a
 * `useState` initializer would put the message in the DOM on the first
 * commit and silently break the announcement. Deferring guarantees the
 * empty → populated edge required for SR a11y.
 *
 * # Why the effect is mount-only (no deps)
 *
 * Browser-back to `?linked=…` updates location in place without
 * remounting the consuming view; we deliberately do NOT want the flash to
 * re-fire in that case. Adding `searchParameters` to the deps would
 * re-fire the effect on every URL change and re-pop the toast.
 *
 * # Why this is idempotent under StrictMode
 *
 * The URL is itself the consumed sentinel. StrictMode double-invokes
 * mount-effects; on the second invocation `read(parameters)` runs against the
 * already-stripped URL and returns whatever the consumer's reader returns
 * for "no flash present" (typically `null` or all-null fields). The
 * second `setSearchParameters({}, ...)` is short-circuited by
 * react-router against an already-empty query. Same idiom as
 * `usePendingNotice`'s sessionStorage clear.
 */
export function useFlashQueryParameters<T>(
  read: (parameters: URLSearchParams) => T | null,
  parameterKeys: readonly string[],
): T | null {
  const [searchParameters, setSearchParameters] = useSearchParams();
  const [flash, setFlash] = useState<T | null>(null);

  useEffect(() => {
    const result = read(searchParameters);
    if (result !== null) {
      setFlash(result);
    }
    const hasAnyKey = parameterKeys.some((key) => searchParameters.get(key));
    if (hasAnyKey) {
      setSearchParameters({}, { replace: true });
    }
    // Mount-only by design – see WHY block above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return flash;
}
