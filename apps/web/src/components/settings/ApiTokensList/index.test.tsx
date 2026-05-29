import {
  act,
  render,
  screen,
  waitFor,
  fireEvent,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ApiTokensList from '.';
import type { ApiToken } from '../../../lib/api';

const NOW = new Date('2026-05-26T12:00:00.000Z');

/**
 * Pin `Date.now` without taking over the timer scheduler. Real timers stay
 * intact so `waitFor` and `useEffect` keep firing — only the wall clock is
 * frozen, which is all `formatRelativeTimeFuzzy` needs.
 */
function pinNow(now: Date = NOW) {
  vi.spyOn(Date, 'now').mockReturnValue(now.getTime());
}

afterEach(() => vi.restoreAllMocks());

const makeToken = (overrides: Partial<ApiToken> = {}): ApiToken => ({
  id: 'tok-1',
  name: 'Chrome Extension',
  prefix: 'ltk_aBcDeFgH',
  createdAt: '2026-05-26T11:00:00.000Z',
  lastUsedAt: null,
  ...overrides,
});

describe('ApiTokensList', () => {
  it('shows "You haven\'t created any tokens" when the token list is empty', () => {
    render(<ApiTokensList tokens={[]} onRevoke={vi.fn()} />);
    expect(
      screen.getByText("You haven't created any tokens"),
    ).toBeInTheDocument();
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

  it('renders the token name as the card title', () => {
    render(<ApiTokensList tokens={[makeToken()]} onRevoke={vi.fn()} />);
    expect(screen.getByText('Chrome Extension')).toBeInTheDocument();
  });

  it('renders the created date with a "Created" prefix and a machine-readable <time>', () => {
    pinNow();
    render(
      <ApiTokensList
        tokens={[makeToken({ createdAt: '2026-05-26T11:00:00.000Z' })]}
        onRevoke={vi.fn()}
      />,
    );
    expect(screen.getByText(/^Created/)).toBeInTheDocument();
    expect(screen.getByText('an hour ago')).toBeInTheDocument();
    expect(screen.getByText('an hour ago').tagName).toBe('TIME');
    expect(screen.getByText('an hour ago')).toHaveAttribute(
      'datetime',
      '2026-05-26T11:00:00.000Z',
    );
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

  describe('last-used display', () => {
    it('shows "This token has never been used." when lastUsedAt is null', () => {
      render(
        <ApiTokensList
          tokens={[makeToken({ lastUsedAt: null })]}
          onRevoke={vi.fn()}
        />,
      );
      expect(
        screen.getByText('This token has never been used.'),
      ).toBeInTheDocument();
    });

    it('shows a fuzzy relative last-used phrase when lastUsedAt is set', () => {
      pinNow();
      render(
        <ApiTokensList
          tokens={[
            makeToken({ lastUsedAt: '2026-05-26T11:40:00.000Z' }), // 20 min ago
          ]}
          onRevoke={vi.fn()}
        />,
      );
      expect(screen.getByText(/This token was last used/)).toBeInTheDocument();
      expect(screen.getByText('a few minutes ago')).toBeInTheDocument();
      expect(screen.getByText('a few minutes ago').tagName).toBe('TIME');
      expect(screen.getByText('a few minutes ago')).toHaveAttribute(
        'datetime',
        '2026-05-26T11:40:00.000Z',
      );
    });
  });
});
