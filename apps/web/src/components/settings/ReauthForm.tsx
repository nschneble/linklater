import type { FormEvent } from 'react';
import Alert from '../common/Alert';
import FormInput from '../common/FormInput';
import LinkButton from '../common/LinkButton';
import PrimaryButton from '../common/PrimaryButton';

type ReauthAction = 'disable' | 'regenerate';

interface ReauthFormProps {
  action: ReauthAction;
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
  loading,
  onCancel,
  onCodeChange,
  onPasswordChange,
  onSubmit,
  password,
}: ReauthFormProps) {
  return (
    <form className="mt-[23px] space-y-4" onSubmit={onSubmit}>
      <p className="text-[var(--text-muted)] text-xs">
        {action === 'disable'
          ? 'Confirm your identity to disable multi-factor authentication.'
          : 'Confirm your identity to generate new recovery codes.'}
      </p>

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
        value={code}
        onChange={(event) => onCodeChange(event.target.value)}
      />

      {error && <Alert variant="error">{error}</Alert>}

      <div className="flex gap-3">
        <PrimaryButton disabled={loading}>
          {loading ? 'Confirming…' : 'Confirm'}
        </PrimaryButton>
        <LinkButton onClick={onCancel}>Cancel</LinkButton>
      </div>
    </form>
  );
}
