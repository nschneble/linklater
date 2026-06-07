import OAuthCallbackPage from './OAuthCallbackPage';
import { MemoryRouter } from 'react-router-dom';
import { render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const loginWithToken = vi.fn();
const navigate = vi.fn();

vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({ loginWithToken }),
}));

vi.mock('react-router-dom', async () => {
  const actual =
    await vi.importActual<typeof import('react-router-dom')>(
      'react-router-dom',
    );
  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

describe('OAuthCallbackPage hash scrub', () => {
  let replaceStateSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    loginWithToken.mockReset();
    navigate.mockReset();
    loginWithToken.mockResolvedValue(undefined);
    replaceStateSpy = vi.spyOn(window.history, 'replaceState');
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

  it('still scrubs the URL when no token is present, before surfacing the error state', async () => {
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
  });
});
