import md5 from 'blueimp-md5';

/**
 * Returns a Gravatar image URL for the given email address. Falls back to
 * an identicon (`d=identicon`) when no Gravatar is registered, so every
 * user always has a unique avatar without requiring them to set one up.
 *
 * The email is normalized (trimmed, lowercased) before hashing as required
 * by the Gravatar specification.
 *
 * @param email - The user's email address.
 * @param size - The desired image dimension in pixels. Defaults to 80.
 * @returns A fully qualified Gravatar URL.
 */
export function gravatarUrl(email: string, size = 80): string {
  const normalized = email.trim().toLowerCase();
  const hash = md5(normalized);

  return `https://www.gravatar.com/avatar/${hash}?s=${size}&d=identicon`;
}
