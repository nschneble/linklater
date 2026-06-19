/** Props for the add-password form (passwordless accounts – SSO or magic link – without a password). */
export interface AddPasswordFormProps {
  refreshUser: () => Promise<void>;
}
