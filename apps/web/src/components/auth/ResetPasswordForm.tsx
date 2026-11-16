import Alert from '../common/Alert';
import FormInput from '../common/FormInput';
import { Fragment, type FormEvent, type RefObject } from 'react';
import LinkButton from '../common/LinkButton';
import PrimaryButton from '../common/PrimaryButton';
import { useNavigate } from 'react-router';

const ERROR_ID = 'reset-error';

interface ResetPasswordFormProps {
  confirm: string;
  confirmMismatch: boolean;
  error: string | null;
  errorReference: RefObject<HTMLParagraphElement | null>;
  failedSubmitCount: number;
  onConfirmChange: (confirm: string) => void;
  onPasswordChange: (password: string) => void;
  onSubmit: (event: FormEvent) => void;
  password: string;
}

export default function ResetPasswordForm({
  confirm,
  confirmMismatch,
  error,
  errorReference,
  failedSubmitCount,
  onConfirmChange,
  onPasswordChange,
  onSubmit,
  password,
}: ResetPasswordFormProps) {
  const navigate = useNavigate();

  let confirmDescribedBy: string | undefined;
  if (confirmMismatch) confirmDescribedBy = ERROR_ID;

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <label
        className="block mb-0 text-[var(--mount-alt-text)] text-sm font-medium"
        htmlFor="reset-password"
      >
        New password
      </label>
      <FormInput
        id="reset-password"
        type="password"
        surface="mount"
        autoComplete="new-password"
        onChange={(event) => onPasswordChange(event.target.value)}
        value={password}
        required
        minLength={12}
      />

      <label
        className="block mb-0 text-[var(--mount-alt-text)] text-sm font-medium"
        htmlFor="reset-confirm"
      >
        Confirm new password
      </label>
      <FormInput
        id="reset-confirm"
        type="password"
        surface="mount"
        autoComplete="new-password"
        onChange={(event) => onConfirmChange(event.target.value)}
        value={confirm}
        required
        aria-describedby={confirmDescribedBy}
        aria-invalid={confirmMismatch || undefined}
      />

      {error && (
        <Alert id={ERROR_ID} ref={errorReference} tabIndex={-1} variant="error">
          <Fragment key={failedSubmitCount}>{error}</Fragment>
        </Alert>
      )}

      <PrimaryButton className="w-full py-2.5">
        <i className="fa-solid fa-lock text-xs" aria-hidden="true" />
        Reset password
      </PrimaryButton>

      <p className="text-center">
        <LinkButton onClick={() => navigate('/login')}>
          Back to login
        </LinkButton>
      </p>
    </form>
  );
}
