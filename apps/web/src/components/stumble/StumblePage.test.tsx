import { MemoryRouter } from 'react-router-dom';
import StumblePage from './StumblePage';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import * as api from '../../lib/api';

vi.mock('../../lib/api', () => ({
  stumbleLink: vi.fn(),
}));

// Wikipedia cards fetch is tested in StumbleEmptyView
vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false } as Response));

function renderStumblePage() {
  return render(
    <MemoryRouter>
      <StumblePage />
    </MemoryRouter>,
  );
}

describe('StumblePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the loading state before the API responds', () => {
    vi.mocked(api.stumbleLink).mockImplementation(() => new Promise(() => {}));
    renderStumblePage();
    expect(
      screen.queryByText(/your reading list is empty/i),
    ).not.toBeInTheDocument();
  });

  it('shows an interstitial with an Open link button instead of auto-redirecting', async () => {
    // Auto-redirect via window.location.href would be an unannounced context
    // change (WCAG 3.2.5) — the page must require an explicit user action.
    vi.mocked(api.stumbleLink).mockResolvedValue({
      url: 'https://example.com/article',
    });

    const mockLocation = { href: 'http://localhost:3000/' };
    vi.stubGlobal('location', mockLocation);

    renderStumblePage();

    const openLink = await screen.findByRole('link', { name: /open link/i });
    expect(openLink).toHaveAttribute('href', 'https://example.com/article');
    expect(openLink).toHaveAttribute('target', '_blank');
    expect(openLink).toHaveAttribute('rel', 'noreferrer');

    // The page must NOT have redirected on its own.
    expect(mockLocation.href).toBe('http://localhost:3000/');

    vi.unstubAllGlobals();
  });

  it('renders the empty state when no unread links exist', async () => {
    vi.mocked(api.stumbleLink).mockResolvedValue({ url: null });
    renderStumblePage();

    await waitFor(() => {
      expect(
        screen.getByText(/your reading list is empty/i),
      ).toBeInTheDocument();
    });
  });

  it('renders the empty state when the API call fails', async () => {
    vi.mocked(api.stumbleLink).mockRejectedValue(new Error('Network error'));
    renderStumblePage();

    await waitFor(() => {
      expect(
        screen.getByText(/your reading list is empty/i),
      ).toBeInTheDocument();
    });
  });

  it('moves keyboard focus to the Open link button when the interstitial appears', async () => {
    vi.mocked(api.stumbleLink).mockResolvedValue({
      url: 'https://example.com/article',
    });

    renderStumblePage();

    const openLink = await screen.findByRole('link', { name: /open link/i });
    await waitFor(() => {
      expect(document.activeElement).toBe(openLink);
    });
  });

  describe('live region', () => {
    it('renders a role="status" paragraph with aria-live="polite" while loading', () => {
      vi.mocked(api.stumbleLink).mockImplementation(
        () => new Promise(() => {}),
      );
      renderStumblePage();

      const status = screen.getByRole('status');
      expect(status).toBeInTheDocument();
      expect(status).toHaveAttribute('aria-live', 'polite');
    });

    it('shows "Finding a random link…" status text during the loading state', () => {
      vi.mocked(api.stumbleLink).mockImplementation(
        () => new Promise(() => {}),
      );
      renderStumblePage();

      expect(screen.getByRole('status')).toHaveTextContent(
        'Finding a random link…',
      );
    });

    it('announces the host of the found link via the live region', async () => {
      vi.mocked(api.stumbleLink).mockResolvedValue({
        url: 'https://blog.example.com/post',
      });

      renderStumblePage();

      await waitFor(() => {
        expect(screen.getByRole('status')).toHaveTextContent(
          /Found a link from blog\.example\.com/i,
        );
      });
    });
  });
});
