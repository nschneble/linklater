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
  forgotPasswordSent: boolean;
  loading: boolean;
  onBack: () => void;
  onEmailChange: (email: string) => void;
  onSubmit: (event: FormEvent) => void;
}

export default function ForgotPasswordView({
  email,
  emailReference,
  error,
  errorReference,
  forgotPasswordSent,
  loading,
  onBack,
  onEmailChange,
  onSubmit,
}: ForgotPasswordViewProps) {
  return (
    <AuthCard>
      <h1 className="mb-2 text-[var(--text)] text-center text-2xl font-bold text-balance">
        You forgot?
      </h1>
      <p className="mb-6 text-[var(--text-muted)] text-center text-sm">
        Silly goose. We'll send you a reset link! Unless you don't have an
        account. Then this isn't gonna do much.
      </p>

      {forgotPasswordSent ? (
        <div className="text-center space-y-4">
          <Alert icon="fa-envelope" variant="success">
            Check your email for a reset link
          </Alert>
          <LinkButton onClick={onBack}>Back to login</LinkButton>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={onSubmit}>
          <label
            className="block mb-0 text-[var(--text-muted)] text-sm font-medium"
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

          <PrimaryButton disabled={loading} className="w-full py-2.5">
            <i className="fa-solid fa-envelope text-xs" aria-hidden="true" />
            Send password reset link
          </PrimaryButton>

          <p className="text-center">
            <LinkButton onClick={onBack}>Back to login</LinkButton>
          </p>
        </form>
      )}
    </AuthCard>
  );
}
