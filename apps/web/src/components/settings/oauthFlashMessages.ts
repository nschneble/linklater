/**
 * Copy maps for the OAuth-link flash messages surfaced by `SettingsView`.
 *
 * `LINKED_MESSAGES` powers the success Toast (`?linked=…`); the unknown-code
 * fallback at the consumer is intentionally provider-agnostic ("Account
 * connected.") rather than echoing the raw provider code – the value
 * arrives from the redirect URL and could be anything.
 *
 * `LINK_ERROR_MESSAGES` powers the inline `<Alert>` inside `IdPsSection`
 * (`?link_error=…`).
 */

export const LINKED_MESSAGES: Record<string, string> = {
  google: 'Google account connected.',
};

export const LINK_ERROR_MESSAGES: Record<string, string> = {
  already_linked:
    'That account is already linked to another user. Try a different one.',
  unknown:
    'Something went wrong connecting that account. Please try again in a moment.',
};
