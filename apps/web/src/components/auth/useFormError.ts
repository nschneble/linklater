import { useCallback, useState } from 'react';

type ErrorSource = 'arrival' | 'submit';

/**
 * The form error together with the channel that set it. The channel is
 * recorded rather than inferred because nothing holds the two vocabularies
 * apart: comparing the painted string against the arrival copy answers
 * wrong, and silently, as soon as an API message matches the catalog.
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
