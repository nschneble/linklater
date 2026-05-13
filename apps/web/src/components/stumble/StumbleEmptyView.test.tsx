import { MemoryRouter } from 'react-router-dom';
import StumbleEmptyView from './StumbleEmptyView';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const WIKIPEDIA_ARTICLE = {
  title: 'Interesting Topic',
  extract: 'A fascinating subject that warrants further reading.',
  content_urls: {
    desktop: { page: 'https://en.wikipedia.org/wiki/Interesting_Topic' },
  },
};

function makeWikipediaResponse(article = WIKIPEDIA_ARTICLE) {
  return {
    ok: true,
    json: () => Promise.resolve(article),
  } as Response;
}

function renderView() {
  return render(
    <MemoryRouter>
      <StumbleEmptyView />
    </MemoryRouter>,
  );
}

describe('StumbleEmptyView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the ghost illustration, headline, and back link', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeWikipediaResponse()));
    renderView();

    expect(screen.getByRole('img', { name: /ghost/i })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /your reading list is empty/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /back to linklater/i }),
    ).toBeInTheDocument();
  });

  it('renders wikipedia cards after fetching', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeWikipediaResponse()));
    renderView();

    await waitFor(() => {
      const cards = screen.getAllByText('Interesting Topic');
      expect(cards.length).toBe(3);
    });
  });

  it('shows fallback message when all wikipedia fetches fail', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false } as Response),
    );
    renderView();

    await waitFor(() => {
      expect(
        screen.getByText(/wikipedia seems to be napping/i),
      ).toBeInTheDocument();
    });
  });

  it('shows partial results when some wikipedia fetches fail', async () => {
    let callCount = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => {
        callCount += 1;
        return Promise.resolve(
          callCount === 1
            ? makeWikipediaResponse()
            : ({ ok: false } as Response),
        );
      }),
    );
    renderView();

    await waitFor(() => {
      expect(screen.getAllByText('Interesting Topic')).toHaveLength(1);
    });
  });

  it('back link points to /unread', () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeWikipediaResponse()));
    renderView();

    expect(
      screen.getByRole('link', { name: /back to linklater/i }),
    ).toHaveAttribute('href', '/unread');
  });

  it('shows the loading text while fetching articles', () => {
    // Never resolves so the component stays in loading state
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));
    renderView();

    expect(screen.getByText('Fetching curiousities…')).toBeInTheDocument();
  });

  it('shows three skeleton cards while loading', () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));
    const { container } = renderView();

    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBe(3);
  });

  it('shows "How about one of these?" after articles load', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeWikipediaResponse()));
    renderView();

    await waitFor(() => {
      expect(screen.getByText('How about one of these?')).toBeInTheDocument();
    });
  });

  it('aborts pending fetches when unmounted', async () => {
    let capturedSignal: AbortSignal | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((_url: string, options: RequestInit) => {
        capturedSignal = options.signal;
        return new Promise(() => {});
      }),
    );

    const { unmount } = renderView();
    unmount();

    expect(capturedSignal?.aborted).toBe(true);
  });
});
