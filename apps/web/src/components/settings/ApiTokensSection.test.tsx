import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ApiTokensSection from './ApiTokensSection';

function renderInRouter() {
  return render(
    <MemoryRouter>
      <ApiTokensSection />
    </MemoryRouter>,
  );
}

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
    renderInRouter();
    await waitFor(() => {
      expect(screen.getByText('API Tokens')).toBeInTheDocument();
    });
  });

  it('renders the "Create new token" button', async () => {
    renderInRouter();
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /create new token/i }),
      ).toBeInTheDocument();
    });
  });

  it('renders the token list from listApiTokens', async () => {
    const tokens = [makeApiToken(), makeApiToken({ id: 'tok-2', name: 'iOS' })];
    vi.mocked(apiModule.listApiTokens).mockResolvedValue(tokens);

    renderInRouter();

    await waitFor(() => {
      expect(screen.getByTestId('token-tok-1')).toBeInTheDocument();
      expect(screen.getByTestId('token-tok-2')).toBeInTheDocument();
    });
  });

  it('shows the create form when "Create new token" is clicked', async () => {
    renderInRouter();
    await waitFor(() =>
      screen.getByRole('button', { name: /create new token/i }),
    );

    fireEvent.click(screen.getByRole('button', { name: /create new token/i }));

    expect(screen.getByLabelText(/new token name/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /^create token$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /do nothing and close this form/i }),
    ).toBeInTheDocument();
  });

  it('shows the raw token after successful creation', async () => {
    const created = {
      ...makeApiToken(),
      rawToken: 'ltk_aBcDeFgHiJkLmNoPqRsTuVwXyZ12',
    };
    vi.mocked(apiModule.createApiToken).mockResolvedValue(created);

    renderInRouter();
    await waitFor(() =>
      screen.getByRole('button', { name: /create new token/i }),
    );

    fireEvent.click(screen.getByRole('button', { name: /create new token/i }));
    fireEvent.change(screen.getByLabelText(/new token name/i), {
      target: { value: 'Chrome Extension' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^create token$/i }));

    await waitFor(() => {
      expect(screen.getByText(created.rawToken)).toBeInTheDocument();
    });
  });

  it('shows an error when token creation fails', async () => {
    vi.mocked(apiModule.createApiToken).mockRejectedValue(
      new Error('Name already taken'),
    );

    renderInRouter();
    await waitFor(() =>
      screen.getByRole('button', { name: /create new token/i }),
    );

    fireEvent.click(screen.getByRole('button', { name: /create new token/i }));
    fireEvent.change(screen.getByLabelText(/new token name/i), {
      target: { value: 'Chrome Extension' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^create token$/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Name already taken')).toBeInTheDocument();
    });
  });

  it('hides the generate form and clears the name when Cancel is clicked', async () => {
    renderInRouter();
    await waitFor(() =>
      screen.getByRole('button', { name: /create new token/i }),
    );

    fireEvent.click(screen.getByRole('button', { name: /create new token/i }));
    fireEvent.change(screen.getByLabelText(/new token name/i), {
      target: { value: 'My Token' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: /do nothing and close this form/i }),
    );

    expect(screen.queryByLabelText(/new token name/i)).not.toBeInTheDocument();
  });

  it('shows an error when the token list fails to load', async () => {
    vi.mocked(apiModule.listApiTokens).mockRejectedValue(
      new Error('Unauthorized'),
    );

    renderInRouter();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Unauthorized')).toBeInTheDocument();
    });
  });

  it('renders a link to the API documentation page', async () => {
    renderInRouter();
    await waitFor(() =>
      screen.getByRole('button', { name: /create new token/i }),
    );
    const link = screen.getByRole('link', {
      name: /view the api documentation/i,
    });
    expect(link).toHaveAttribute('href', '/settings/api');
  });

  it('calls revokeApiToken when a token is revoked', async () => {
    const token = makeApiToken();
    vi.mocked(apiModule.listApiTokens).mockResolvedValue([token]);
    vi.mocked(apiModule.revokeApiToken).mockResolvedValue({ success: true });

    renderInRouter();
    await waitFor(() => screen.getByTestId('token-tok-1'));

    fireEvent.click(
      screen.getByRole('button', { name: /revoke chrome extension/i }),
    );

    await waitFor(() => {
      expect(apiModule.revokeApiToken).toHaveBeenCalledWith('tok-1');
    });
  });
});
