import {
  act,
  render,
  screen,
  waitFor,
  fireEvent,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ApiTokensList from './ApiTokensList';
import type { ApiToken } from '../../lib/api';

afterEach(() => vi.restoreAllMocks());

const makeToken = (overrides: Partial<ApiToken> = {}): ApiToken => ({
  id: 'tok-1',
  name: 'Chrome Extension',
  prefix: 'ltk_aBcDeFgH',
  createdAt: '2026-01-01T00:00:00.000Z',
  lastUsedAt: null,
  ...overrides,
});

describe('ApiTokensList', () => {
  it('shows "No tokens yet." when the token list is empty', () => {
    render(<ApiTokensList tokens={[]} onRevoke={vi.fn()} />);
    expect(screen.getByText('No tokens yet.')).toBeInTheDocument();
  });

  it('renders one row per token', () => {
    const tokens = [
      makeToken({ id: 'tok-1', name: 'Chrome Extension' }),
      makeToken({ id: 'tok-2', name: 'iOS' }),
    ];
    render(<ApiTokensList tokens={tokens} onRevoke={vi.fn()} />);
    expect(screen.getByText('Chrome Extension')).toBeInTheDocument();
    expect(screen.getByText('iOS')).toBeInTheDocument();
  });

  it('shows the token prefix', () => {
    render(<ApiTokensList tokens={[makeToken()]} onRevoke={vi.fn()} />);
    expect(screen.getByText('ltk_aBcDeFgH…')).toBeInTheDocument();
  });

  describe('revoke flow', () => {
    it('shows a confirmation "Sure?" prompt when Revoke is clicked', () => {
      render(<ApiTokensList tokens={[makeToken()]} onRevoke={vi.fn()} />);
      fireEvent.click(
        screen.getByRole('button', { name: /revoke chrome extension/i }),
      );
      expect(screen.getByText('Sure?')).toBeInTheDocument();
      expect(
        screen.getByRole('button', {
          name: /confirm revoke chrome extension/i,
        }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', {
          name: /cancel revoke chrome extension/i,
        }),
      ).toBeInTheDocument();
    });

    it('focuses the first confirm button when the confirmation row appears', async () => {
      render(<ApiTokensList tokens={[makeToken()]} onRevoke={vi.fn()} />);

      await act(async () => {
        fireEvent.click(
          screen.getByRole('button', { name: /revoke chrome extension/i }),
        );
      });

      // Focus is moved via a useEffect that queries the confirmRow container
      // — wait for it to settle.
      await waitFor(() => {
        expect(document.activeElement).toBe(
          screen.getByRole('button', {
            name: /confirm revoke chrome extension/i,
          }),
        );
      });
    });

    it('hides the confirmation row when Cancel is clicked', () => {
      render(<ApiTokensList tokens={[makeToken()]} onRevoke={vi.fn()} />);
      fireEvent.click(
        screen.getByRole('button', { name: /revoke chrome extension/i }),
      );
      fireEvent.click(
        screen.getByRole('button', {
          name: /cancel revoke chrome extension/i,
        }),
      );
      expect(screen.queryByText('Sure?')).not.toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /revoke chrome extension/i }),
      ).toBeInTheDocument();
    });

    it('calls onRevoke with the token id when Yes, revoke is clicked', async () => {
      const onRevoke = vi.fn().mockResolvedValue(undefined);
      render(<ApiTokensList tokens={[makeToken()]} onRevoke={onRevoke} />);

      fireEvent.click(
        screen.getByRole('button', { name: /revoke chrome extension/i }),
      );

      await act(async () => {
        fireEvent.click(
          screen.getByRole('button', {
            name: /confirm revoke chrome extension/i,
          }),
        );
      });

      expect(onRevoke).toHaveBeenCalledWith('tok-1');
    });

    it('shows an error alert when onRevoke rejects', async () => {
      const onRevoke = vi.fn().mockRejectedValue(new Error('Revoke failed'));
      render(<ApiTokensList tokens={[makeToken()]} onRevoke={onRevoke} />);

      fireEvent.click(
        screen.getByRole('button', { name: /revoke chrome extension/i }),
      );

      await act(async () => {
        fireEvent.click(
          screen.getByRole('button', {
            name: /confirm revoke chrome extension/i,
          }),
        );
      });

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Revoke failed');
      });
    });
  });

  describe('date display', () => {
    it('shows "Last used never" when lastUsedAt is null', () => {
      render(
        <ApiTokensList
          tokens={[makeToken({ lastUsedAt: null })]}
          onRevoke={vi.fn()}
        />,
      );
      expect(screen.getByText(/last used never/i)).toBeInTheDocument();
    });

    it('shows a formatted last-used date when lastUsedAt is set', () => {
      render(
        <ApiTokensList
          tokens={[makeToken({ lastUsedAt: '2026-03-15T12:00:00.000Z' })]}
          onRevoke={vi.fn()}
        />,
      );
      // The exact format is locale-dependent; match "Last used" + year.
      expect(screen.getByText(/last used.*2026/i)).toBeInTheDocument();
    });
  });
});
