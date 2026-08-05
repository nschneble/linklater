import Alert from '../common/Alert';
import { formatTotpCode } from '../../lib/totpCode';
import FormInput from '../common/FormInput';
import LinkButton from '../common/LinkButton';
import PrimaryButton from '../common/PrimaryButton';
import { useEffect, useId, useRef } from 'react';
import type { FormEvent } from 'react';

// TOTP = up to 6 digits; a hyphen or letter marks a recovery code
const TOTP_SHAPE = /^\d{0,6}$/;
const DIGITS_AND_SPACES_ONLY = /^[\d ]*$/;

interface ReauthFormProps {
  /**
   * Prompt shown above the inputs. Also wired to both `aria-describedby`
   * attributes so screen readers announce it when an input receives focus
   * – critical for destructive flows where the field labels alone don't
   * convey the consequence ("Current password" doesn't say *what* it's
   * confirming).
   */
  prompt: string;
  /**
   * Visually-hidden `<h3>` rendered above the prompt so screen-reader users
   * navigating by heading (NVDA/JAWS `H`, VoiceOver rotor) find the form.
   * Each caller passes per-flow text – e.g. "Confirm account deletion".
   * Level `h3` matches the surrounding hierarchy (`h1` Settings →
   * `h2` SettingsGroup → `h3` here).
   */
  srOnlyHeading?: string;
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
  /**
   * Whether the user has a password set. Gates the "Current password" input.
   * Callers must guarantee `hasPassword || hasMfa` so the form has at least
   * one credential to collect.
   */
  hasPassword: boolean;
  /**
   * Whether the user has multi-factor authentication enrolled. Gates the
   * "Authenticator or recovery code" input. Without this gate, password-only
   * users see a code field they cannot fill – see `DangerZone`'s credentialed
   * branch, which admits any user with `hasPassword || multiFactorMethod`.
   */
  hasMfa: boolean;
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
  hasMfa,
  hasPassword,
  loading,
  onCancel,
  onCodeChange,
  onPasswordChange,
  onSubmit,
  password,
  prompt,
  srOnlyHeading,
  submitLabel,
  submittingLabel,
}: ReauthFormProps) {
  const promptId = useId();
  const errorId = useId();
  const alertReference = useRef<HTMLParagraphElement>(null);
  const passwordReference = useRef<HTMLInputElement>(null);
  const codeReference = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!focusOnMount) return;
    if (hasPassword) passwordReference.current?.focus();
    else if (hasMfa) codeReference.current?.focus();
  }, [focusOnMount, hasMfa, hasPassword]);

  useEffect(() => {
    if (error) alertReference.current?.focus();
  }, [error]);

  const describedBy = error ? `${promptId} ${errorId}` : promptId;
  const isInvalid = Boolean(error);

  return (
    <form className="mt-[23px] space-y-4" onSubmit={onSubmit}>
      {srOnlyHeading && <h3 className="sr-only">{srOnlyHeading}</h3>}
      <p id={promptId} className="text-[var(--mount-alt-text)] text-xs">
        {prompt}
      </p>

      {hasPassword && (
        <>
          <label
            className="block mb-0 text-[var(--mount-alt-text)] text-xs font-medium"
            htmlFor="reauth-password"
          >
            Current password
          </label>
          <FormInput
            id="reauth-password"
            ref={passwordReference}
            surface="mount"
            type="password"
            autoComplete="current-password"
            required={!hasMfa}
            aria-describedby={describedBy}
            aria-invalid={isInvalid}
            value={password}
            onChange={(event) => onPasswordChange(event.target.value)}
          />
        </>
      )}

      {hasMfa && (
        <>
          <label
            className="block mb-0 text-[var(--mount-alt-text)] text-xs font-medium"
            htmlFor="reauth-code"
          >
            {hasPassword
              ? 'Or enter an authenticator or recovery code'
              : 'Authenticator or recovery code'}
          </label>
          <FormInput
            id="reauth-code"
            ref={codeReference}
            surface="mount"
            type="text"
            maxLength={17}
            placeholder="000 000"
            inputMode="numeric"
            autoComplete="one-time-code"
            required={!hasPassword}
            aria-describedby={describedBy}
            aria-invalid={isInvalid}
            value={TOTP_SHAPE.test(code) ? formatTotpCode(code) : code}
            onChange={(event) => {
              const raw = event.target.value;
              if (DIGITS_AND_SPACES_ONLY.test(raw)) {
                // TOTP path: store digits only, cap at 6 (guards against paste)
                onCodeChange(raw.replace(/\D/g, '').slice(0, 6));
              } else {
                // recovery path: hyphen or letter detected, leave verbatim
                onCodeChange(raw);
              }
            }}
          />
        </>
      )}

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
