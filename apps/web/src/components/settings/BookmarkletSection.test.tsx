import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import BookmarkletSection from './BookmarkletSection';

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
  vi.mocked(apiModule.getBookmarkletToken).mockResolvedValue(
    makeBookmarkletToken(),
  );
});

afterEach(() => vi.restoreAllMocks());

async function renderResolved() {
  const utilities = render(<BookmarkletSection />);
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
    render(<BookmarkletSection />);
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
      render(<BookmarkletSection />);
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
      render(<BookmarkletSection />);
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
      render(<BookmarkletSection />);
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
      render(<BookmarkletSection />);
      const link = screen.getByRole('link', {
        name: /drag to your bookmarks bar/i,
      });
      expect(link).toHaveAttribute('aria-busy', 'true');
    });

    it('renders an error alert when the initial load fails', async () => {
      vi.mocked(apiModule.getBookmarkletToken).mockRejectedValue(
        new Error('Network down'),
      );
      render(<BookmarkletSection />);
      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Network down');
      });
      // Heading still renders even on error.
      expect(
        screen.getByRole('heading', { name: /bookmarklet/i }),
      ).toBeInTheDocument();
    });
  });

  describe('copy bookmarklet code', () => {
    it('renders a "Copy bookmarklet code" button next to the anchor', async () => {
      await renderResolved();
      expect(
        screen.getByRole('button', { name: /copy bookmarklet code/i }),
      ).toBeInTheDocument();
    });

    it('writes the javascript: URL to the clipboard when clicked', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText } });

      await renderResolved();
      const link = screen.getByRole('link', {
        name: /drag to your bookmarks bar/i,
      });
      const code = link.getAttribute('href') ?? '';

      await act(async () => {
        fireEvent.click(
          screen.getByRole('button', { name: /copy bookmarklet code/i }),
        );
      });

      expect(writeText).toHaveBeenCalledWith(code);
    });
  });

  describe('regenerate flow', () => {
    it('renders a Regenerate button with the right aria attributes', async () => {
      await renderResolved();
      const trigger = screen.getByRole('button', {
        name: /regenerate bookmarklet token/i,
      });
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(trigger).toHaveAttribute(
        'aria-controls',
        'bookmarklet-regenerate-confirm',
      );
    });

    it('opens the confirm row when Regenerate is clicked', async () => {
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
    });

    it('flips the trigger aria-expanded to true when confirm opens', async () => {
      await renderResolved();
      const trigger = screen.getByRole('button', {
        name: /regenerate bookmarklet token/i,
      });
      fireEvent.click(trigger);
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
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
      const trigger = screen.getByRole('button', {
        name: /regenerate bookmarklet token/i,
      });

      await act(async () => {
        fireEvent.click(trigger);
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
      });

      expect(screen.queryByText('Sure?')).not.toBeInTheDocument();
      await waitFor(() => {
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
      const trigger = screen.getByRole('button', {
        name: /regenerate bookmarklet token/i,
      });

      await act(async () => {
        fireEvent.click(trigger);
      });
      await act(async () => {
        fireEvent.click(
          screen.getByRole('button', { name: /yes, regenerate/i }),
        );
      });

      await waitFor(() => {
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
        const alert = document.getElementById('bookmarklet-regenerate-error');
        expect(alert).not.toBeNull();
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
