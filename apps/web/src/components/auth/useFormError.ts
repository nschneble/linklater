import { useCallback, useState } from 'react';

type ErrorSource = 'arrival' | 'submit';

/**
 * The form error together with the channel that set it.
 *
 * Two behaviours hinge on that channel: the Alert holding an error that
 * arrived on the URL keeps its live region off, because
 * `useOAuthArrivalError` announces that one, and the focus effect leaves
 * the arrival alone. Telling the channels apart by comparing the painted
 * string against the arrival copy answers wrong as soon as an API message
 * matches the catalog, and it fails silently: no live region, no focus,
 * and a mirror the submit already dismissed. Nothing holds the two
 * vocabularies apart, so the channel is recorded rather than inferred.
 */
export function useFormError() {
  const [error, setErrorMessage] = useState<string | null>(null);
  const [errorSource, setErrorSource] = useState<ErrorSource | null>(null);

  // one call writes both, so the source cannot drift from the message
  const setError = useCallback(
    (message: string | null, source: ErrorSource = 'submit') => {
      setErrorMessage(message);
      setErrorSource(message === null ? null : source);
    },
    [],
  );

  return { error, errorFromArrival: errorSource === 'arrival', setError };
}
