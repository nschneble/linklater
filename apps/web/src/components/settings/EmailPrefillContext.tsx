import { createContext, useContext } from 'react';

/**
 * Shared channel for cross-section email prefill in the Settings page. When
 * an IdP row's "Use … instead" action fires, it pushes a value here; the
 * `EmailSettingsForm` subscribes via `useEmailPrefill()`, populates its input,
 * announces the change via a live region, and shifts focus to the input.
 *
 * The provider lives in `SettingsView` so the IdPs section (sibling of the
 * Email section's wrapper) can write to it without prop-drilling through
 * `AccountSettingsForm`.
 */
export interface EmailPrefill {
  /** The email value to prefill, or `null` when no prefill is pending. */
  email: string | null;
  /** Monotonically increasing token to re-trigger the effect on repeat use. */
  token: number;
}

interface EmailPrefillContextValue {
  prefill: EmailPrefill;
  setPrefillEmail: (email: string) => void;
}

const EmailPrefillContext = createContext<EmailPrefillContextValue | undefined>(
  undefined,
);

export const EmailPrefillProvider = EmailPrefillContext.Provider;

/**
 * Reads the current email prefill request. Returns `null` for `email` when no
 * prefill is active. Used by `EmailSettingsForm` to react to "Use … instead"
 * actions in `IdPsSection`. Throws when called outside the provider so a
 * silent prop-drilling miss surfaces immediately in development.
 */
export function useEmailPrefill(): EmailPrefillContextValue {
  const context = useContext(EmailPrefillContext);
  if (!context) {
    throw new Error(
      'useEmailPrefill must be used within an EmailPrefillProvider',
    );
  }
  return context;
}
