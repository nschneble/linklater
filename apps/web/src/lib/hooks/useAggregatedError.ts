import { useEffect, useRef, useState } from 'react';

/** The five independent error fields surfaced by the links data layer. */
interface LinksErrors {
  deleteError: string | null;
  fetchError: string | null;
  randomError: string | null;
  readError: string | null;
  saveError: string | null;
}

/**
 * Aggregates the five sub-error fields into a single last-write-wins `error`
 * so the view can render one `Alert` (one `role="alert"`) instead of mounting
 * up to five assertive regions concurrently. Detects both `null → string` and
 * `string → string'` transitions so the same field re-failing with a new
 * message also re-announces. Clears once every field is `null` again.
 *
 * @param errors - The current value of each sub-error field.
 * @returns The most-recently-set error, or `null` when all are cleared.
 */
export function useAggregatedError(errors: LinksErrors): string | null {
  const { deleteError, fetchError, randomError, readError, saveError } = errors;

  const previousErrors = useRef<LinksErrors>({
    deleteError: null,
    fetchError: null,
    randomError: null,
    readError: null,
    saveError: null,
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const current: LinksErrors = {
      deleteError,
      fetchError,
      randomError,
      readError,
      saveError,
    };
    let nextError: string | null = null;
    for (const kind of Object.keys(current) as Array<keyof LinksErrors>) {
      const currentValue = current[kind];
      const previousValue = previousErrors.current[kind];
      if (currentValue !== null && currentValue !== previousValue) {
        nextError = currentValue;
      }
    }
    const allCleared = Object.values(current).every((value) => value === null);
    previousErrors.current = current;
    if (allCleared) {
      setError(null);
    } else if (nextError !== null) {
      setError(nextError);
    }
  }, [deleteError, fetchError, randomError, readError, saveError]);

  return error;
}
