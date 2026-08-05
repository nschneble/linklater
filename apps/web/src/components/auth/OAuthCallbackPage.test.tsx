import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { consumePendingNotice } from '../../lib/pendingNotice';
import { MemoryRouter } from 'react-router';
import OAuthCallbackPage from './OAuthCallbackPage';
import { render, waitFor } from '@testing-library/react';

const loginWithToken = vi.fn();
const navigate = vi.fn();

vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({ loginWithToken }),
}));

vi.mock('react-router', async () => {
  const actual =
    await vi.importActual<typeof import('react-router')>('react-router');
  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

describe('OAuthCallbackPage', () => {
  let replaceStateSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    loginWithToken.mockReset();
    navigate.mockReset();
    loginWithToken.mockResolvedValue(undefined);
    replaceStateSpy = vi.spyOn(window.history, 'replaceState');
    // drain a stale pending notice so the guard doesn't carry across tests
    consumePendingNotice();
  });

  afterEach(() => {
    replaceStateSpy.mockRestore();
    window.location.hash = '';
  });

  it('scrubs the token from the URL bar via replaceState before invoking loginWithToken', async () => {
    window.location.hash = '#token=test-jwt&refresh=test-refresh';

    let hashAtLoginCall: string | null = null;
    loginWithToken.mockImplementation(() => {
      hashAtLoginCall = window.location.hash;
      return Promise.resolve();
    });

    render(
      <MemoryRouter>
        <OAuthCallbackPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(loginWithToken).toHaveBeenCalledWith('test-jwt', 'test-refresh');
    });

    expect(replaceStateSpy).toHaveBeenCalledTimes(1);
    expect(replaceStateSpy.mock.invocationCallOrder[0]).toBeLessThan(
      loginWithToken.mock.invocationCallOrder[0],
    );
    expect(hashAtLoginCall).toBe('');
  });

  it('navigates to /unread on success without queuing a notice', async () => {
    window.location.hash = '#token=test-jwt';

    render(
      <MemoryRouter>
        <OAuthCallbackPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith('/unread', { replace: true });
    });
    expect(consumePendingNotice()).toBeNull();
  });

  it('queues oauth-failed and redirects to /login when the hash has no token', async () => {
    window.location.hash = '#error=cancelled';

    render(
      <MemoryRouter>
        <OAuthCallbackPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(replaceStateSpy).toHaveBeenCalledTimes(1);
    });
    expect(loginWithToken).not.toHaveBeenCalled();
    expect(window.location.hash).toBe('');
    expect(navigate).toHaveBeenCalledWith('/login', { replace: true });
    expect(consumePendingNotice()).toEqual({
      message: "We couldn't sign you in. Please try again.",
      variant: 'error',
    });
  });

  it('queues oauth-failed and redirects to /login when loginWithToken rejects', async () => {
    window.location.hash = '#token=test-jwt';
    loginWithToken.mockRejectedValue(new Error('provider rejected token'));

    render(
      <MemoryRouter>
        <OAuthCallbackPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith('/login', { replace: true });
    });
    expect(consumePendingNotice()).toEqual({
      message: "We couldn't sign you in. Please try again.",
      variant: 'error',
    });
  });

  it('does not render a legacy error card (no alert role surfaced inline)', async () => {
    window.location.hash = '#token=test-jwt';
    loginWithToken.mockRejectedValue(new Error('boom'));

    const { queryByRole } = render(
      <MemoryRouter>
        <OAuthCallbackPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith('/login', { replace: true });
    });
    expect(queryByRole('alert')).toBeNull();
  });
});
