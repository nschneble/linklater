import { useEffect, useId, useRef } from 'react';
import type { FormEvent } from 'react';
import Alert from '../common/Alert';
import FormInput from '../common/FormInput';
import LinkButton from '../common/LinkButton';
import PrimaryButton from '../common/PrimaryButton';

interface ReauthFormProps {
  /**
   * Prompt shown above the inputs. Also wired to both `aria-describedby`
   * attributes so screen readers announce it when an input receives focus
   * — critical for destructive flows where the field labels alone don't
   * convey the consequence ("Current password" doesn't say *what* it's
   * confirming).
   */
  prompt: string;
  /** Visible label for the submit button when idle. */
  submitLabel: string;
  /** Visible label for the submit button while the request is in flight. */
  submittingLabel: string;
  /**
   * Accessible name override for the Cancel button. The visible text stays
   * "Cancel"; pass e.g. "Cancel account deletion" so a screen reader user
   * tabbing into the button hears full context.
   */
  cancelLabel?: string;
  /**
   * When `true`, focuses the password field on mount so keyboard users
   * land in the form on reveal. Defaults to `false` to preserve the
   * existing MFA-flow behaviour where callers don't manage focus.
   */
  focusOnMount?: boolean;
  loading: boolean;
  error: string | null;
  password: string;
  code: string;
  onPasswordChange: (value: string) => void;
  onCodeChange: (value: string) => void;
  onSubmit: (formEvent: FormEvent) => void;
  onCancel: () => void;
}

export default function ReauthForm({
  cancelLabel,
  code,
  error,
  focusOnMount = false,
  loading,
  onCancel,
  onCodeChange,
  onPasswordChange,
  onSubmit,
  password,
  prompt,
  submitLabel,
  submittingLabel,
}: ReauthFormProps) {
  const promptId = useId();
  const errorId = useId();
  const alertReference = useRef<HTMLParagraphElement>(null);
  const passwordReference = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (focusOnMount) passwordReference.current?.focus();
  }, [focusOnMount]);

  useEffect(() => {
    if (error) alertReference.current?.focus();
  }, [error]);

  const describedBy = error ? `${promptId} ${errorId}` : promptId;
  const isInvalid = Boolean(error);

  return (
    <form className="mt-[23px] space-y-4" onSubmit={onSubmit}>
      <p id={promptId} className="text-[var(--text-muted)] text-xs">
        {prompt}
      </p>

      <label
        className="block mb-0 text-[var(--text-muted)] text-xs font-medium"
        htmlFor="reauth-password"
      >
        Current password
      </label>
      <FormInput
        id="reauth-password"
        ref={passwordReference}
        type="password"
        autoComplete="current-password"
        aria-describedby={describedBy}
        aria-invalid={isInvalid}
        value={password}
        onChange={(event) => onPasswordChange(event.target.value)}
      />

      <label
        className="block mb-0 text-[var(--text-muted)] text-xs font-medium"
        htmlFor="reauth-code"
      >
        Or enter an authenticator or recovery code
      </label>
      <FormInput
        id="reauth-code"
        type="text"
        maxLength={17}
        inputMode="numeric"
        autoComplete="one-time-code"
        aria-describedby={describedBy}
        aria-invalid={isInvalid}
        value={code}
        onChange={(event) => onCodeChange(event.target.value)}
      />

      {error && (
        <Alert id={errorId} ref={alertReference} tabIndex={-1} variant="error">
          {error}
        </Alert>
      )}

      <div className="flex gap-3">
        <PrimaryButton disabled={loading}>
          {loading ? submittingLabel : submitLabel}
        </PrimaryButton>
        <LinkButton onClick={onCancel} aria-label={cancelLabel}>
          Cancel
        </LinkButton>
      </div>
    </form>
  );
}
