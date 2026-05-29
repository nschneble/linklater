import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import BookmarkletSection from './BookmarkletSection';

// Render under the single `/settings` route. `BookmarkletSection` uses router
// hooks, so a router is still required; the re-anchor target now comes from the
// module-level active-section accessor, not the URL.
function renderSection(route = '/settings') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/settings" element={<BookmarkletSection />} />
      </Routes>
    </MemoryRouter>,
  );
}

vi.mock('../../lib/api', () => ({
  getBookmarkletToken: vi.fn(),
  regenerateBookmarkletToken: vi.fn(),
}));

import * as apiModule from '../../lib/api';

const makeBookmarkletToken = (overrides = {}) => ({
  id: 'bookmarklet-tok-1',
  name: 'Bookmarklet',
  prefix: 'ltk_FAKE_TO',
  createdAt: '2026-05-26T11:00:00.000Z',
  lastUsedAt: null,
  rawToken: 'ltk_FAKE_TOKEN_ABCDEFGHIJKLMNOPQRSTUVWX',
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  // `useReanchorOnLoad` may call `scrollIntoView` once the token resolves.
  // jsdom doesn't implement it, so stub it out to keep the path inert.
  Element.prototype.scrollIntoView = vi.fn();
  vi.mocked(apiModule.getBookmarkletToken).mockResolvedValue(
    makeBookmarkletToken(),
  );
});

afterEach(() => vi.restoreAllMocks());

async function renderResolved() {
  const utilities = renderSection();
  // Wait for getBookmarkletToken to resolve and the href to be applied.
  await waitFor(() => {
    expect(
      screen
        .getByRole('link', { name: /drag to your bookmarks bar/i })
        .getAttribute('href'),
    ).toMatch(/^javascript:/);
  });
  return utilities;
}

describe('BookmarkletSection', () => {
  it('renders the section heading', async () => {
    renderSection();
    expect(
      screen.getByRole('heading', { name: /bookmarklet/i }),
    ).toBeInTheDocument();
  });

  it('renders the bookmarklet link with draggable="true"', async () => {
    await renderResolved();
    const link = screen.getByRole('link', {
      name: /drag to your bookmarks bar/i,
    });
    expect(link).toHaveAttribute('draggable', 'true');
  });

  it('bookmarklet link has a descriptive aria-label mentioning drag', async () => {
    await renderResolved();
    const link = screen.getByRole('link', {
      name: /drag to your bookmarks bar/i,
    });
    expect(link.getAttribute('aria-label')).toMatch(
      /drag to your bookmarks bar/i,
    );
  });

  it('bookmarklet link text is "Save to Linklater"', async () => {
    await renderResolved();
    expect(screen.getByText('Save to Linklater')).toBeInTheDocument();
  });

  describe('initial load', () => {
    it('calls getBookmarkletToken on mount', async () => {
      renderSection();
      await waitFor(() => {
        expect(apiModule.getBookmarkletToken).toHaveBeenCalledTimes(1);
      });
    });

    it('shows a polite "Generating your bookmarklet…" status while loading', () => {
      let resolve: (
        token: ReturnType<typeof makeBookmarkletToken>,
      ) => void = () => {};
      vi.mocked(apiModule.getBookmarkletToken).mockReturnValue(
        new Promise((res) => {
          resolve = res;
        }),
      );
      renderSection();
      const status = screen.getByText(/generating your bookmarklet/i);
      expect(status).toHaveAttribute('role', 'status');
      resolve(makeBookmarkletToken());
    });

    it('embeds the rawToken into the bookmarklet href once resolved', async () => {
      await renderResolved();
      const link = screen.getByRole('link', {
        name: /drag to your bookmarks bar/i,
      });
      const href = link.getAttribute('href') ?? '';
      expect(href.startsWith('javascript:')).toBe(true);
      expect(href.includes('ltk_FAKE_TOKEN_ABCDEFGHIJKLMNOPQRSTUVWX')).toBe(
        true,
      );
      expect(href).toContain("fetch(a+'/links'");
      expect(href).toContain("'Authorization':'Bearer '+t");
    });

    it('does not move focus when the token resolves', async () => {
      const previouslyFocused = document.createElement('button');
      document.body.appendChild(previouslyFocused);
      previouslyFocused.focus();
      renderSection();
      await waitFor(() => {
        expect(apiModule.getBookmarkletToken).toHaveBeenCalled();
      });
      expect(document.activeElement).toBe(previouslyFocused);
      document.body.removeChild(previouslyFocused);
    });

    it('marks the bookmarklet anchor aria-busy while loading', () => {
      vi.mocked(apiModule.getBookmarkletToken).mockReturnValue(
        new Promise(() => {}),
      );
      renderSection();
      const link = screen.getByRole('link', {
        name: /drag to your bookmarks bar/i,
      });
      expect(link).toHaveAttribute('aria-busy', 'true');
    });

    it('renders an error alert when the initial load fails', async () => {
      vi.mocked(apiModule.getBookmarkletToken).mockRejectedValue(
        new Error('Network down'),
      );
      renderSection();
      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Network down');
      });
      // Heading still renders even on error.
      expect(
        screen.getByRole('heading', { name: /bookmarklet/i }),
      ).toBeInTheDocument();
    });
  });

  describe('regenerate flow', () => {
    it('renders a Regenerate trigger button', async () => {
      await renderResolved();
      const trigger = screen.getByRole('button', {
        name: /regenerate bookmarklet token/i,
      });
      expect(trigger).toBeInTheDocument();
      // Disclosure ARIA was dropped: the trigger unmounts when the confirm row
      // is open, so `aria-controls` would point at nothing. Matches the
      // DangerZone/ApiTokenRow guard pattern.
      expect(trigger).not.toHaveAttribute('aria-controls');
      expect(trigger).not.toHaveAttribute('aria-expanded');
    });

    it('swaps the trigger for the confirm row when Regenerate is clicked', async () => {
      await renderResolved();
      fireEvent.click(
        screen.getByRole('button', { name: /regenerate bookmarklet token/i }),
      );
      expect(screen.getByText('Sure?')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /yes, regenerate/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /^cancel$/i }),
      ).toBeInTheDocument();
      // Trigger unmounts during confirm to avoid the layout-leap/flash caused
      // by the previous `hidden`-keeps-layout-space approach.
      expect(
        screen.queryByRole('button', { name: /regenerate bookmarklet token/i }),
      ).not.toBeInTheDocument();
    });

    it('focuses the "Yes, regenerate" button when the confirm row appears', async () => {
      await renderResolved();
      await act(async () => {
        fireEvent.click(
          screen.getByRole('button', { name: /regenerate bookmarklet token/i }),
        );
      });
      await waitFor(() => {
        expect(document.activeElement).toBe(
          screen.getByRole('button', { name: /yes, regenerate/i }),
        );
      });
    });

    it('cancels and returns focus to the Regenerate trigger when Cancel is clicked', async () => {
      await renderResolved();

      await act(async () => {
        fireEvent.click(
          screen.getByRole('button', { name: /regenerate bookmarklet token/i }),
        );
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
      });

      expect(screen.queryByText('Sure?')).not.toBeInTheDocument();
      // Re-query: the trigger is unmounted while the confirm row is open and
      // remounts when it closes, so a reference captured before the click is
      // stale.
      await waitFor(() => {
        const trigger = screen.getByRole('button', {
          name: /regenerate bookmarklet token/i,
        });
        expect(document.activeElement).toBe(trigger);
      });
    });

    it('cancels when Escape is pressed while the confirm row is open', async () => {
      await renderResolved();
      const trigger = screen.getByRole('button', {
        name: /regenerate bookmarklet token/i,
      });

      await act(async () => {
        fireEvent.click(trigger);
      });

      await act(async () => {
        fireEvent.keyDown(document, { key: 'Escape' });
      });

      expect(screen.queryByText('Sure?')).not.toBeInTheDocument();
    });

    it('calls regenerateBookmarkletToken and swaps the href on confirm', async () => {
      const fresh = makeBookmarkletToken({
        rawToken: 'ltk_FAKE_TOKEN_REGENERATED_XXXXXXXXXXXX',
      });
      vi.mocked(apiModule.regenerateBookmarkletToken).mockResolvedValue(fresh);

      await renderResolved();

      await act(async () => {
        fireEvent.click(
          screen.getByRole('button', { name: /regenerate bookmarklet token/i }),
        );
      });

      await act(async () => {
        fireEvent.click(
          screen.getByRole('button', { name: /yes, regenerate/i }),
        );
      });

      expect(apiModule.regenerateBookmarkletToken).toHaveBeenCalledTimes(1);

      await waitFor(() => {
        const link = screen.getByRole('link', {
          name: /drag to your bookmarks bar/i,
        });
        expect(link.getAttribute('href')).toContain(
          'ltk_FAKE_TOKEN_REGENERATED_XXXXXXXXXXXX',
        );
      });

      // Confirm row dismissed after success.
      expect(screen.queryByText('Sure?')).not.toBeInTheDocument();
    });

    it('returns focus to the Regenerate trigger after a successful regenerate', async () => {
      vi.mocked(apiModule.regenerateBookmarkletToken).mockResolvedValue(
        makeBookmarkletToken({ rawToken: 'ltk_FAKE_TOKEN_NEW1' }),
      );

      await renderResolved();

      await act(async () => {
        fireEvent.click(
          screen.getByRole('button', { name: /regenerate bookmarklet token/i }),
        );
      });
      await act(async () => {
        fireEvent.click(
          screen.getByRole('button', { name: /yes, regenerate/i }),
        );
      });

      // Trigger unmounts during confirm and remounts on success — re-query.
      await waitFor(() => {
        const trigger = screen.getByRole('button', {
          name: /regenerate bookmarklet token/i,
        });
        expect(document.activeElement).toBe(trigger);
      });
    });

    it('announces success via a polite sr-only status after regenerate', async () => {
      vi.mocked(apiModule.regenerateBookmarkletToken).mockResolvedValue(
        makeBookmarkletToken({ rawToken: 'ltk_FAKE_TOKEN_NEW2' }),
      );

      await renderResolved();
      await act(async () => {
        fireEvent.click(
          screen.getByRole('button', { name: /regenerate bookmarklet token/i }),
        );
      });
      await act(async () => {
        fireEvent.click(
          screen.getByRole('button', { name: /yes, regenerate/i }),
        );
      });

      await waitFor(() => {
        const statuses = screen.getAllByRole('status');
        const announcement = statuses.find((node) =>
          /bookmarklet regenerated/i.test(node.textContent ?? ''),
        );
        expect(announcement).toBeTruthy();
      });
    });

    it('renders an error alert when regenerate fails', async () => {
      vi.mocked(apiModule.regenerateBookmarkletToken).mockRejectedValue(
        new Error('Server unavailable'),
      );

      await renderResolved();
      await act(async () => {
        fireEvent.click(
          screen.getByRole('button', { name: /regenerate bookmarklet token/i }),
        );
      });
      await act(async () => {
        fireEvent.click(
          screen.getByRole('button', { name: /yes, regenerate/i }),
        );
      });

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(
          'Server unavailable',
        );
      });
    });

    it('moves focus into the error alert when regenerate fails', async () => {
      vi.mocked(apiModule.regenerateBookmarkletToken).mockRejectedValue(
        new Error('Server unavailable'),
      );

      await renderResolved();
      await act(async () => {
        fireEvent.click(
          screen.getByRole('button', { name: /regenerate bookmarklet token/i }),
        );
      });
      await act(async () => {
        fireEvent.click(
          screen.getByRole('button', { name: /yes, regenerate/i }),
        );
      });

      await waitFor(() => {
        // Alert id is auto-generated by `useId` inside ActionGuard; query by
        // role + assert focus instead of by stable id.
        const alert = screen.getByRole('alert');
        expect(document.activeElement).toBe(alert);
      });
    });

    it('clears a previous error when the confirm row is reopened', async () => {
      vi.mocked(apiModule.regenerateBookmarkletToken).mockRejectedValueOnce(
        new Error('Server unavailable'),
      );

      await renderResolved();
      await act(async () => {
        fireEvent.click(
          screen.getByRole('button', { name: /regenerate bookmarklet token/i }),
        );
      });
      await act(async () => {
        fireEvent.click(
          screen.getByRole('button', { name: /yes, regenerate/i }),
        );
      });

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(
          screen.getByRole('button', { name: /regenerate bookmarklet token/i }),
        );
      });

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });
});
