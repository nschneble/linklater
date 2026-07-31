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

// pure builder; a fixed string keeps env/URL resolution out of the test
vi.mock('./bookmarkletCode', () => ({
  buildBookmarkletCode: () => 'javascript:void 0',
}));

vi.mock('./useReanchorOnLoad', () => ({
  useReanchorOnLoad: vi.fn(),
}));

// stub the ActionGuard confirm as a plain button that fires toast.show
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
  it('mirrors a regenerate result into its own announcement region', async () => {
    // ToastAnnouncer.test.tsx proves the generic contract; this checks wiring
    render(<BookmarkletSection />);

    // the mirror is present from first paint, empty until a toast fires
    const region = screen.getByTestId('bookmarklet-toast-announcement');
    expect(region).toBeEmptyDOMElement();

    const regenerate = await screen.findByRole('button', {
      name: 'Regenerate',
    });
    fireEvent.click(regenerate);

    // empty → populated is the transition a screen reader announces
    await waitFor(() =>
      expect(region).toHaveTextContent('Bookmarklet regenerated'),
    );
  });

  it('keeps the mirror region distinct from the loading-status paragraph', async () => {
    render(<BookmarkletSection />);

    // while loading, the loading paragraph owns role="status", mirror empty
    const loadingParagraph = screen.getByText('Generating your bookmarklet…');
    const region = screen.getByTestId('bookmarklet-toast-announcement');
    expect(loadingParagraph).not.toBe(region);
    expect(loadingParagraph).toHaveAttribute('role', 'status');
    expect(region).toBeEmptyDOMElement();

    // after load, the loading paragraph empties but stays a distinct node
    await screen.findByRole('button', { name: 'Regenerate' });
    const statusRegions = screen.getAllByRole('status');
    expect(statusRegions).toContain(loadingParagraph);
    expect(statusRegions).toContain(region);
    expect(loadingParagraph).toBeEmptyDOMElement();
  });
});
