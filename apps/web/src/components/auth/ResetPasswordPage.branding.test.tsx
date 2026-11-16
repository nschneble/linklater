import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fillForm, renderPage } from './ResetPasswordPage.testSetup';

vi.mock('../../lib/api', () => ({
  resetPassword: vi.fn(),
  verifyOtp: vi.fn(),
}));

vi.mock('../../lib/pendingNotice', () => ({
  setPendingNotice: vi.fn(),
}));

const refreshUser = vi.fn();

vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({ refreshUser }),
}));

const navigate = vi.fn();

vi.mock('react-router', async () => {
  const actual =
    await vi.importActual<typeof import('react-router')>('react-router');
  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

import * as apiModule from '../../lib/api';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(apiModule.resetPassword).mockResolvedValue({
    accessToken: 'fresh-jwt',
    refreshToken: 'fresh-refresh',
  });
  refreshUser.mockResolvedValue(undefined);
});

describe('ResetPasswordPage branding pin', () => {
  // branding pin: every branch sets data-theme="branding", never inherited
  it('renders the form in a branding-scoped wrapper', () => {
    const { container } = renderPage();
    expect(container.querySelector('[data-theme="branding"]')).not.toBeNull();
  });

  it('keeps the in-flight spinner branding-scoped', async () => {
    let resolveReset: (value: {
      accessToken: string;
      refreshToken: string;
    }) => void = () => {};
    vi.mocked(apiModule.resetPassword).mockReturnValue(
      new Promise((resolve) => {
        resolveReset = resolve;
      }),
    );
    const { container } = renderPage();
    fillForm();

    await act(async () => {
      fireEvent.submit(container.querySelector('form')!);
    });

    expect(
      screen.getByRole('status').closest('[data-theme="branding"]'),
    ).not.toBeNull();

    await act(async () => {
      resolveReset({ accessToken: 'a', refreshToken: 'r' });
    });
  });

  it('keeps the MFA challenge branding-scoped', async () => {
    vi.mocked(apiModule.resetPassword).mockResolvedValue({
      mfaToken: 'mfa-tok',
      mfaMethod: 'totp',
    });
    const { container } = renderPage();
    fillForm();

    await act(async () => {
      fireEvent.submit(container.querySelector('form')!);
    });

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /multi-factor authentication/i }),
      ).toBeInTheDocument();
    });
    expect(container.querySelector('[data-theme="branding"]')).not.toBeNull();
  });
});
