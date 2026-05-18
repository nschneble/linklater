/**
 * Extracts a human-readable message from an unknown thrown value. Used
 * throughout the app in `catch` blocks to avoid the unsafe pattern of
 * treating `error` as `Error` directly.
 *
 * @param error - The caught value; may be an `Error`, string, or anything else.
 * @param fallback - The message to return when `error` is not an `Error` instance.
 *
 * @returns The `error.message` string if `error` is an `Error`, otherwise `fallback`.
 */
export function getErrorMessage(
  error: unknown,
  fallback = 'Something went wrong',
): string {
  if (!(error instanceof Error)) {
    return fallback;
  }

  return error.message.replace(/^[A-Z][a-zA-Z]*Exception:\s*/, '');
}
