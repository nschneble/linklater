import { useEffect, useRef } from 'react';
import type { FormEvent, RefObject } from 'react';
import Alert from '../common/Alert';
import FormInput from '../common/FormInput';
import LinkButton from '../common/LinkButton';
import PrimaryButton from '../common/PrimaryButton';

interface TotpSetupViewProps {
  /** Base64 PNG data URL for the authenticator-app QR code. */
  qrCodeDataUrl: string;
  /** Plaintext TOTP secret, shown as the manual-entry alternative to the QR. */
  secret: string;
  /** Current 6-digit verification code value (controlled). */
  code: string;
  /** Ref to the verification code input — used by the parent to focus on mount. */
  codeInputReference: RefObject<HTMLInputElement | null>;
  /** Disables the form while a verify or cancel request is in flight. */
  loading: boolean;
  /** Last server error message, rendered as a `role="alert"` banner. */
  error: string | null;
  /** Cancels the in-flight TOTP enrollment. Parent unwinds setup state. */
  onCancel: () => void;
  /** Called on every keystroke in the verification code input. */
  onCodeChange: (value: string) => void;
  /** Submit handler for the verification form. */
  onSubmit: (formEvent: FormEvent) => void;
}

/**
 * QR + manual-secret enrollment view for TOTP setup. Renders the QR image,
 * the secret as a selectable code block, and the 6-digit verification form.
 *
 * Auto-submits the verification form as soon as the input reaches 6 digits
 * (see `useEffect` below) so users do not need to click Verify after typing
 * the final digit. A describedby hint advises users of this behavior to
 * satisfy WCAG 3.2.2 (On Input).
 */
export default function TotpSetupView({
  code,
  codeInputReference,
  error,
  loading,
  onCancel,
  onCodeChange,
  onSubmit,
  qrCodeDataUrl,
  secret,
}: TotpSetupViewProps) {
  const formReference = useRef<HTMLFormElement>(null);

  // NOTE: Auto-submit on 6th digit. `requestSubmit()` (not `.submit()`) so
  // React's synthetic `onSubmit` handler runs and validation fires. The
  // advisory hint near the label tells users this will happen, per WCAG
  // 3.2.2 (On Input).
  useEffect(() => {
    if (/^\d{6}$/.test(code)) {
      formReference.current?.requestSubmit();
    }
  }, [code]);

  return (
    <div className="space-y-4">
      <p className="text-[var(--text-muted)] text-xs">
        <span className="text-[var(--text)] font-semibold">
          Scan the QR code to add Linklater to your authenticator app.
        </span>{' '}
        You can also enter the secret manually if you enjoy doing things the
        hard way.
      </p>
      {/*
       * QR image is decorative (`alt=""`): a screen-reader user cannot scan
       * it, so the manual secret below is the canonical pathway and the
       * surrounding copy already explains both options.
       */}
      <img
        src={qrCodeDataUrl}
        alt=""
        className="w-40 h-40 rounded border border-[var(--border)]"
      />
      <code
        aria-label="TOTP secret"
        className="block px-3 py-2 bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text)] text-xs font-mono rounded select-all"
      >
        {secret}
      </code>
      <form ref={formReference} className="space-y-3" onSubmit={onSubmit}>
        <label className="sr-only" htmlFor="totp-code">
          Verification code
        </label>
        <p className="text-[var(--text-subtle)] text-xs" id="totp-code-hint">
          <span className="text-[var(--text)] font-semibold">
            Enter the 6-digit code from your authenticator app.
          </span>{' '}
          We'll verify it automatically after you finish typing.
        </p>
        <FormInput
          id="totp-code"
          ref={codeInputReference}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          aria-describedby="totp-code-hint"
          maxLength={6}
          placeholder="000000"
          value={code}
          onChange={(event) => onCodeChange(event.target.value)}
          required
        />
        {error && <Alert variant="error">{error}</Alert>}
        <div className="flex items-center gap-3">
          <PrimaryButton disabled={loading} className="py-2.5">
            <i className="fa-solid fa-check text-xs" aria-hidden="true" />
            {loading ? 'Verifying…' : 'Verify code'}
          </PrimaryButton>
          <LinkButton onClick={onCancel} disabled={loading}>
            Cancel
          </LinkButton>
        </div>
      </form>
    </div>
  );
}
