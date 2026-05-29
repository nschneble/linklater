/** Props for the add-password form (SSO-only accounts without a password). */
export interface AddPasswordFormProps {
  refreshUser: () => Promise<void>;
}
