import { MemoryRouter } from 'react-router-dom';
import StumblePage from './StumblePage';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import * as api from '../lib/api';

vi.mock('../lib/api', () => ({
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

  it('replaces window.location.href when a link is found', async () => {
    vi.mocked(api.stumbleLink).mockResolvedValue({
      url: 'https://example.com/article',
    });

    const mockLocation = { href: 'http://localhost:3000/' };
    vi.stubGlobal('location', mockLocation);

    renderStumblePage();

    await waitFor(() => {
      expect(mockLocation.href).toBe('https://example.com/article');
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
});
