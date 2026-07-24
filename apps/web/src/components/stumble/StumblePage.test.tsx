/**
 * Tests for StumblePage.
 *
 * On mount, calls stumbleLink(). Based on the result:
 *   - Safe URL → window.location.replace() called with the URL
 *   - Null/empty URL → StumbleEmptyView (no unread links)
 *   - Unsafe URL → error state with retry button (recoverable)
 *   - API error → error state with retry button
 *
 * document.title is verified to confirm useDocumentTitle fires, including
 * the "Linklater – Stumble error" title for the error state.
 * isSafeRedirectUrl rejection prevents open-redirect security regression.
 */

import StumblePage from './StumblePage';
import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../../lib/api', () => ({
  stumbleLink: vi.fn(),
  getSuggestions: vi.fn().mockResolvedValue({ suggestions: [] }),
}));

// ─── Imports after mocks ──────────────────────────────────────────────────────

import * as apiModule from '../../lib/api';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderStumblePage() {
  return render(
    <MemoryRouter>
      <StumblePage />
    </MemoryRouter>,
  );
}

// ─── Setup ────────────────────────────────────────────────────────────────────

// jsdom's window.location is sealed – replace it with a configurable object so
// we can spy on replace() without hitting "Cannot redefine property".
const replaceMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  replaceMock.mockReset();
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: { ...window.location, replace: replaceMock },
  });
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('StumblePage loading state', () => {
  it('shows a polite status region while waiting for the API call', () => {
    // Never resolves – keeps the component in 'loading' state
    vi.mocked(apiModule.stumbleLink).mockReturnValue(new Promise(() => {}));

    renderStumblePage();

    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('does not render StumbleEmptyView while loading', () => {
    vi.mocked(apiModule.stumbleLink).mockReturnValue(new Promise(() => {}));

    renderStumblePage();

    expect(
      screen.queryByRole('heading', { name: /boo/i }),
    ).not.toBeInTheDocument();
  });
});

describe('StumblePage sets document title', () => {
  it('sets document.title to "Linklater – Stumble"', async () => {
    vi.mocked(apiModule.stumbleLink).mockReturnValue(new Promise(() => {}));

    renderStumblePage();

    await waitFor(() => {
      expect(document.title).toBe('Linklater – Stumble');
    });
  });
});

describe('StumblePage success path', () => {
  it('calls window.location.replace with the returned URL', async () => {
    vi.mocked(apiModule.stumbleLink).mockResolvedValue({
      url: 'https://example.com/article',
    });

    await act(async () => {
      renderStumblePage();
    });

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('https://example.com/article');
    });
  });

  it('does not render StumbleEmptyView when a valid URL is returned', async () => {
    vi.mocked(apiModule.stumbleLink).mockResolvedValue({
      url: 'https://example.com/article',
    });

    await act(async () => {
      renderStumblePage();
    });

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalled();
    });

    expect(
      screen.queryByRole('heading', { name: /boo/i }),
    ).not.toBeInTheDocument();
  });
});

describe('StumblePage empty/null result', () => {
  it('renders StumbleEmptyView when the API returns an empty URL', async () => {
    vi.mocked(apiModule.stumbleLink).mockResolvedValue({ url: '' });

    await act(async () => {
      renderStumblePage();
    });

    await waitFor(() => {
      expect(
        screen.getByRole('heading', {
          name: /boo\. your reading list is empty/i,
        }),
      ).toBeInTheDocument();
    });
  });
});

describe('StumblePage error path', () => {
  it('renders an error Alert with a retry button when the API call throws', async () => {
    vi.mocked(apiModule.stumbleLink).mockRejectedValue(
      new Error('Server error'),
    );

    await act(async () => {
      renderStumblePage();
    });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(
      screen.getByRole('button', { name: /try another link/i }),
    ).toBeInTheDocument();
    expect(document.title).toBe('Linklater – Stumble error');
  });

  it('retries the API call when the retry button is clicked', async () => {
    vi.mocked(apiModule.stumbleLink)
      .mockRejectedValueOnce(new Error('Server error'))
      .mockResolvedValueOnce({ url: 'https://example.com/recovered' });

    await act(async () => {
      renderStumblePage();
    });

    const retryButton = await screen.findByRole('button', {
      name: /try another link/i,
    });

    await act(async () => {
      retryButton.click();
    });

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('https://example.com/recovered');
    });
  });
});

describe('StumblePage security: isSafeRedirectUrl rejection', () => {
  it('does NOT call window.location.replace for a javascript: URL', async () => {
    vi.mocked(apiModule.stumbleLink).mockResolvedValue({
      url: 'javascript:alert(1)',
    });

    await act(async () => {
      renderStumblePage();
    });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    expect(replaceMock).not.toHaveBeenCalled();
    expect(
      screen.getByRole('button', { name: /try another link/i }),
    ).toBeInTheDocument();
  });

  it('does NOT call window.location.replace for a data: URL', async () => {
    vi.mocked(apiModule.stumbleLink).mockResolvedValue({
      url: 'data:text/html,<h1>pwned</h1>',
    });

    await act(async () => {
      renderStumblePage();
    });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('does NOT call window.location.replace for a protocol-relative URL', async () => {
    vi.mocked(apiModule.stumbleLink).mockResolvedValue({
      url: '//evil.com/xss',
    });

    await act(async () => {
      renderStumblePage();
    });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    expect(replaceMock).not.toHaveBeenCalled();
  });
});
