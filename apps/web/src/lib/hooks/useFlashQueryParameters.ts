import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';

/**
 * One-shot deferred read of post-redirect flash query parameters, which
 * drive a toast or alert and then leave the URL.
 *
 * The read waits for a mount effect because screen readers only announce
 * a live region that goes from empty to populated, and skip content that
 * is present on first paint. The effect is mount-only on purpose, so
 * browser-back onto a flash URL does not re-pop it. Double invocation is
 * harmless: the URL is the sentinel, so the second pass reads an
 * already-stripped one.
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
    // mount-only by design; see above
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return flash;
}
