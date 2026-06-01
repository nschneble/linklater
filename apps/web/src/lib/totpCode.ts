/**
 * Strips a raw input string down to at most 6 ASCII digits. Used as the
 * `onChange` normalizer for TOTP code inputs so the stored state is always
 * a plain digit string (e.g. `"123456"`) regardless of whether the user
 * typed, pasted with a space, hyphens, or surrounding whitespace.
 */
export function normalizeTotpInput(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 6);
}

/**
 * Formats a digits-only TOTP code for display as `"XXX XXX"` — the same
 * grouping authenticator apps use. Returns whatever is passed in once the
 * length is 3 or fewer so the space only appears after the user types the
 * fourth digit.
 */
export function formatTotpCode(digits: string): string {
  if (digits.length <= 3) return digits;
  return `${digits.slice(0, 3)} ${digits.slice(3)}`;
}
