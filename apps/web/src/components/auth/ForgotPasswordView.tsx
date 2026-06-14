import Alert from '../common/Alert';
import FormInput from '../common/FormInput';
import LinkButton from '../common/LinkButton';
import PrimaryButton from '../common/PrimaryButton';
import AuthCard from './AuthCard';
import type { FormEvent, RefObject } from 'react';

interface ForgotPasswordViewProps {
  email: string;
  emailReference: RefObject<HTMLInputElement | null>;
  error: string | null;
  errorReference: RefObject<HTMLParagraphElement | null>;
  /**
   * True for the 3000ms window after a successful forgot-password request.
   * Holds the submit button in a "Reset link sent!" success state — kept in
   * sync with the toast's auto-dismiss lifetime so the two surfaces never
   * read as contradictory. Mirrors the magic-link button's success hold.
   */
  forgotPasswordSentJustNow: boolean;
  loading: boolean;
  onBack: () => void;
  onEmailChange: (email: string) => void;
  onSubmit: (event: FormEvent) => void;
}

function submitLabel(
  loading: boolean,
  forgotPasswordSentJustNow: boolean,
): string {
  // Success-state label takes precedence over loading because loading is
  // released to false the instant the forgot-password request resolves; the
  // 3000ms `forgotPasswordSentJustNow` window is the success indicator
  // that stays in sync with the toast's own visible lifetime.
  if (forgotPasswordSentJustNow) return 'Reset link sent!';
  if (loading) return 'Working…';
  return 'Send password reset link';
}

export default function ForgotPasswordView({
  email,
  emailReference,
  error,
  errorReference,
  forgotPasswordSentJustNow,
  loading,
  onBack,
  onEmailChange,
  onSubmit,
}: ForgotPasswordViewProps) {
  return (
    <AuthCard>
      <h1 className="mb-2 text-[var(--mount-text)] text-center text-2xl font-bold text-balance">
        You forgot?
      </h1>
      <p className="mb-6 text-[var(--mount-alt-text)] text-center text-sm">
        Silly goose. We'll send you a reset link! Unless you don't have an
        account. Then this isn't gonna do much.
      </p>

      <form className="space-y-4" onSubmit={onSubmit}>
        <label
          className="block mb-0 text-[var(--mount-alt-text)] text-sm font-medium"
          htmlFor="forgot-email"
        >
          Email
        </label>
        <FormInput
          id="forgot-email"
          ref={emailReference}
          type="email"
          surface="mount"
          autoComplete="email"
          onChange={(event) => onEmailChange(event.target.value)}
          value={email}
          required
        />

        {error && (
          <Alert
            ref={errorReference}
            icon="fa-triangle-exclamation"
            tabIndex={-1}
            variant="error"
          >
            {error}
          </Alert>
        )}

        <PrimaryButton
          disabled={loading || forgotPasswordSentJustNow}
          className="w-full py-2.5"
        >
          <i
            className={`fa-solid ${forgotPasswordSentJustNow ? 'fa-circle-check' : 'fa-envelope'} text-xs`}
            aria-hidden="true"
          />
          {submitLabel(loading, forgotPasswordSentJustNow)}
        </PrimaryButton>

        <p className="text-center">
          <LinkButton onClick={onBack}>Back to login</LinkButton>
        </p>
      </form>
    </AuthCard>
  );
}
