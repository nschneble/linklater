import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ApiTokensSection from './ApiTokensSection';

vi.mock('../../lib/api', () => ({
  createApiToken: vi.fn(),
  listApiTokens: vi.fn(),
  revokeApiToken: vi.fn(),
}));

vi.mock('./ApiTokensList', () => ({
  default: ({
    tokens,
    onRevoke,
  }: {
    tokens: { id: string; name: string }[];
    onRevoke: (id: string) => Promise<void>;
  }) => (
    <div data-testid="api-tokens-list">
      {tokens.map((token) => (
        <div key={token.id} data-testid={`token-${token.id}`}>
          {token.name}
          <button onClick={() => void onRevoke(token.id)}>
            Revoke {token.name}
          </button>
        </div>
      ))}
    </div>
  ),
}));

import * as apiModule from '../../lib/api';

const makeApiToken = (overrides = {}) => ({
  id: 'tok-1',
  name: 'Chrome Extension',
  prefix: 'ltk_aBcDeFgH',
  createdAt: '2026-01-01T00:00:00.000Z',
  lastUsedAt: null,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(apiModule.listApiTokens).mockResolvedValue([]);
});

afterEach(() => vi.restoreAllMocks());

describe('ApiTokensSection', () => {
  it('renders the section heading', async () => {
    render(<ApiTokensSection />);
    await waitFor(() => {
      expect(screen.getByText('API Tokens')).toBeInTheDocument();
    });
  });

  it('renders the "Create new token" button', async () => {
    render(<ApiTokensSection />);
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /create new token/i }),
      ).toBeInTheDocument();
    });
  });

  it('renders the token list from listApiTokens', async () => {
    const tokens = [makeApiToken(), makeApiToken({ id: 'tok-2', name: 'iOS' })];
    vi.mocked(apiModule.listApiTokens).mockResolvedValue(tokens);

    render(<ApiTokensSection />);

    await waitFor(() => {
      expect(screen.getByTestId('token-tok-1')).toBeInTheDocument();
      expect(screen.getByTestId('token-tok-2')).toBeInTheDocument();
    });
  });

  it('shows the create form when "Create new token" is clicked', async () => {
    render(<ApiTokensSection />);
    await waitFor(() =>
      screen.getByRole('button', { name: /create new token/i }),
    );

    fireEvent.click(screen.getByRole('button', { name: /create new token/i }));

    expect(screen.getByLabelText(/token name/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /^create$/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('shows the raw token after successful creation', async () => {
    const created = {
      ...makeApiToken(),
      rawToken: 'ltk_aBcDeFgHiJkLmNoPqRsTuVwXyZ12',
    };
    vi.mocked(apiModule.createApiToken).mockResolvedValue(created);

    render(<ApiTokensSection />);
    await waitFor(() =>
      screen.getByRole('button', { name: /create new token/i }),
    );

    fireEvent.click(screen.getByRole('button', { name: /create new token/i }));
    fireEvent.change(screen.getByLabelText(/token name/i), {
      target: { value: 'Chrome Extension' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^create$/i }));

    await waitFor(() => {
      expect(screen.getByText(created.rawToken)).toBeInTheDocument();
    });
  });

  it('hides the raw token and reloads the list when "Done" is clicked', async () => {
    const created = {
      ...makeApiToken(),
      rawToken: 'ltk_aBcDeFgHiJkLmNoPqRsTuVwXyZ12',
    };
    vi.mocked(apiModule.createApiToken).mockResolvedValue(created);
    vi.mocked(apiModule.listApiTokens).mockResolvedValue([makeApiToken()]);

    render(<ApiTokensSection />);
    await waitFor(() =>
      screen.getByRole('button', { name: /create new token/i }),
    );

    fireEvent.click(screen.getByRole('button', { name: /create new token/i }));
    fireEvent.change(screen.getByLabelText(/token name/i), {
      target: { value: 'Chrome Extension' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^create$/i }));

    await waitFor(() => screen.getByText(created.rawToken));

    fireEvent.click(screen.getByRole('button', { name: /done/i }));

    await waitFor(() => {
      expect(screen.queryByText(created.rawToken)).not.toBeInTheDocument();
    });

    await waitFor(() => {
      expect(apiModule.listApiTokens).toHaveBeenCalledTimes(2);
    });
  });

  it('shows an error when token creation fails', async () => {
    vi.mocked(apiModule.createApiToken).mockRejectedValue(
      new Error('Name already taken'),
    );

    render(<ApiTokensSection />);
    await waitFor(() =>
      screen.getByRole('button', { name: /create new token/i }),
    );

    fireEvent.click(screen.getByRole('button', { name: /create new token/i }));
    fireEvent.change(screen.getByLabelText(/token name/i), {
      target: { value: 'Chrome Extension' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^create$/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Name already taken')).toBeInTheDocument();
    });
  });

  it('hides the generate form and clears the name when Cancel is clicked', async () => {
    render(<ApiTokensSection />);
    await waitFor(() =>
      screen.getByRole('button', { name: /create new token/i }),
    );

    fireEvent.click(screen.getByRole('button', { name: /create new token/i }));
    fireEvent.change(screen.getByLabelText(/token name/i), {
      target: { value: 'My Token' },
    });
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(screen.queryByLabelText(/token name/i)).not.toBeInTheDocument();
  });

  it('shows an error when the token list fails to load', async () => {
    vi.mocked(apiModule.listApiTokens).mockRejectedValue(
      new Error('Unauthorized'),
    );

    render(<ApiTokensSection />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Unauthorized')).toBeInTheDocument();
    });
  });

  it('calls revokeApiToken when a token is revoked', async () => {
    const token = makeApiToken();
    vi.mocked(apiModule.listApiTokens).mockResolvedValue([token]);
    vi.mocked(apiModule.revokeApiToken).mockResolvedValue({ success: true });

    render(<ApiTokensSection />);
    await waitFor(() => screen.getByTestId('token-tok-1'));

    fireEvent.click(
      screen.getByRole('button', { name: /revoke chrome extension/i }),
    );

    await waitFor(() => {
      expect(apiModule.revokeApiToken).toHaveBeenCalledWith('tok-1');
    });
  });
});
