/**
 * Tests for BookmarkletSection's toast-announcement plumbing.
 *
 * The visual Toast renders `announce={false}`, so it carries no live-region
 * semantics; an always-mounted sr-only `role="status"` mirror region
 * (data-testid="bookmarklet-toast-announcement") does the announcing. That
 * region is a separate channel from the pre-existing "Generating your
 * bookmarklet…" loading-status paragraph, and both are distinct DOM nodes.
 *
 * The regenerate control and the token API are mocked so the test stays on
 * BookmarkletSection's own responsibility: bridging a conditionally-mounted
 * Toast to the always-mounted mirror.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../../lib/api', () => ({
  getBookmarkletToken: vi.fn(),
  regenerateBookmarkletToken: vi.fn(),
}));

// Pure builder; a fixed string keeps env/URL resolution out of the test.
vi.mock('./bookmarkletCode', () => ({
  buildBookmarkletCode: () => 'javascript:void 0',
}));

vi.mock('./useReanchorOnLoad', () => ({
  useReanchorOnLoad: vi.fn(),
}));

// Collapse the two-step ActionGuard confirm into a plain button so the test
// can trigger a `toast.show(...)` without exercising the regenerate flow.
vi.mock('./BookmarkletRegenerateButton', () => ({
  default: ({
    onRegenerated,
  }: {
    onRegenerated: (rawToken: string) => void;
  }) => (
    <button type="button" onClick={() => onRegenerated('ltk_regenerated')}>
      Regenerate
    </button>
  ),
}));

// ─── Imports after mocks ──────────────────────────────────────────────────────

import { getBookmarkletToken } from '../../lib/api';
import BookmarkletSection from './BookmarkletSection';
import type { BookmarkletToken } from '../../lib/api/tokens';

const getBookmarkletTokenMock = vi.mocked(getBookmarkletToken);

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  getBookmarkletTokenMock.mockResolvedValue({
    rawToken: 'ltk_initial',
  } as unknown as BookmarkletToken);
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('BookmarkletSection toast announcement', () => {
  it('renders the visual Toast with announce={false} (no role/aria-live on the card)', async () => {
    render(<BookmarkletSection />);

    // Wait for the token to resolve so the regenerate control mounts.
    const regenerate = await screen.findByRole('button', {
      name: 'Regenerate',
    });
    fireEvent.click(regenerate);

    const dismiss = await screen.findByRole('button', { name: 'Dismiss' });
    const card = dismiss.closest('div');
    expect(card).toHaveTextContent('Bookmarklet regenerated');
    expect(card).not.toHaveAttribute('role');
    expect(card).not.toHaveAttribute('aria-live');
  });

  it('mirrors a shown toast message into the always-mounted announcement region', async () => {
    render(<BookmarkletSection />);

    // The mirror is present from first paint, empty until a toast fires.
    const region = screen.getByTestId('bookmarklet-toast-announcement');
    expect(region).toBeEmptyDOMElement();
    expect(region).toHaveAttribute('role', 'status');
    expect(region).toHaveAttribute('aria-live', 'polite');

    const regenerate = await screen.findByRole('button', {
      name: 'Regenerate',
    });
    fireEvent.click(regenerate);

    // Empty → populated is the transition a screen reader announces.
    await waitFor(() =>
      expect(region).toHaveTextContent('Bookmarklet regenerated'),
    );
  });

  it('keeps the mirror region distinct from the loading-status paragraph', async () => {
    render(<BookmarkletSection />);

    // While the token is loading, the loading paragraph owns its own
    // role="status" and text; the mirror region is a separate, empty node.
    const loadingParagraph = screen.getByText('Generating your bookmarklet…');
    const region = screen.getByTestId('bookmarklet-toast-announcement');
    expect(loadingParagraph).not.toBe(region);
    expect(loadingParagraph).toHaveAttribute('role', 'status');
    expect(region).toBeEmptyDOMElement();

    // After load, the loading paragraph empties but stays a distinct node;
    // the two role="status" regions never collapse into one.
    await screen.findByRole('button', { name: 'Regenerate' });
    const statusRegions = screen.getAllByRole('status');
    expect(statusRegions).toContain(loadingParagraph);
    expect(statusRegions).toContain(region);
    expect(loadingParagraph).toBeEmptyDOMElement();
  });
});
