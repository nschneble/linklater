import type { FormEvent } from 'react';
import Alert from '../common/Alert';
import FormInput from '../common/FormInput';
import LinkButton from '../common/LinkButton';
import PrimaryButton from '../common/PrimaryButton';

type ReauthAction = 'disable' | 'regenerate';

interface ReauthFormProps {
  action: ReauthAction;
  hasPassword: boolean;
  multiFactorMethod: 'totp' | null;
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
  action,
  code,
  error,
  hasPassword,
  loading,
  onCancel,
  onCodeChange,
  onPasswordChange,
  onSubmit,
  password,
  multiFactorMethod,
}: ReauthFormProps) {
  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <p className="text-[var(--text-muted)] text-sm">
        {action === 'disable'
          ? 'Confirm your identity to disable multi-factor authentication.'
          : 'Confirm your identity to regenerate recovery codes.'}
      </p>

      {hasPassword && (
        <>
          <label
            className="block mb-0 text-[var(--text-muted)] text-xs font-medium"
            htmlFor="reauth-password"
          >
            Current password
          </label>
          <FormInput
            id="reauth-password"
            type="password"
            value={password}
            onChange={(event) => onPasswordChange(event.target.value)}
          />
        </>
      )}

      {multiFactorMethod && (
        <>
          <label
            className="block mb-0 text-[var(--text-muted)] text-xs font-medium"
            htmlFor="reauth-code"
          >
            {hasPassword ? 'Or enter your ' : 'Enter your '}authenticator or
            recovery code
          </label>
          <FormInput
            id="reauth-code"
            type="text"
            maxLength={17}
            value={code}
            onChange={(event) => onCodeChange(event.target.value)}
          />
        </>
      )}

      {error && <Alert variant="error">{error}</Alert>}

      <div className="flex gap-3">
        <PrimaryButton disabled={loading} className="py-2.5">
          {loading ? 'Confirming…' : 'Confirm'}
        </PrimaryButton>
        <LinkButton onClick={onCancel}>Cancel</LinkButton>
      </div>
    </form>
  );
}
