/**
 * Returns `true` only when `value` is a string starting with `http://`
 * or `https://`. Use this before issuing a redirect or building a URL
 * from user-supplied input to prevent open-redirect attacks.
 */
export function isSafeRedirectUrl(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    (value.startsWith('http://') || value.startsWith('https://'))
  );
}
