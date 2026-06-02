import { MemoryRouter } from 'react-router-dom';
import StumblePage from './StumblePage';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import * as api from '../../lib/api';

vi.mock('../../lib/api', () => ({
  stumbleLink: vi.fn(),
  // Suggestions fetch is tested in StumbleEmptyView.test.tsx; here, a
  // never-resolving stub keeps the empty view's callout in loading state
  // without affecting these assertions.
  getSuggestions: vi.fn(() => new Promise(() => {})),
}));

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

  it('redirects via window.location.replace when a link is found', async () => {
    // Use `replace` rather than assigning `href` so `/stumble` is dropped from
    // history and the back button returns to the page before the bookmark click.
    vi.mocked(api.stumbleLink).mockResolvedValue({
      url: 'https://example.com/article',
    });

    const replaceMock = vi.fn();
    vi.stubGlobal('location', { replace: replaceMock });

    renderStumblePage();

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('https://example.com/article');
    });

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
  });
});
