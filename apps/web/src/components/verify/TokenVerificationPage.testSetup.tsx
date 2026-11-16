import { MemoryRouter } from 'react-router';
import { render } from '@testing-library/react';
import TokenVerificationPage from './TokenVerificationPage';
import { vi } from 'vitest';
import type { PendingNotice } from '../../lib/pendingNotice';

interface RenderOptions {
  search?: string;
  onVerify?: (token: string) => Promise<void>;
  onSuccess?: () => void | Promise<void>;
  verifyingText?: string;
  signedInNotice?: PendingNotice;
  signedOutNotice?: PendingNotice;
  invalidNotice?: PendingNotice;
}

export function renderPage(options: RenderOptions = {}) {
  const search = options.search ?? '?token=valid-token';
  const onVerify = options.onVerify ?? vi.fn(async () => undefined);
  return render(
    <MemoryRouter initialEntries={[`/verify-email${search}`]}>
      <TokenVerificationPage
        verifyingText={options.verifyingText ?? 'Verifying your email…'}
        signedInNotice={options.signedInNotice ?? 'email-verified'}
        signedOutNotice={
          options.signedOutNotice ?? 'email-verified-please-sign-in'
        }
        invalidNotice={options.invalidNotice ?? 'verification-link-invalid'}
        onVerify={onVerify}
        onSuccess={options.onSuccess}
      />
    </MemoryRouter>,
  );
}
