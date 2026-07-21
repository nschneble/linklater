/**
 * Tests for LinksView focused on the cross-route pending-notice surface.
 *
 * Coverage:
 *   - When `usePendingNotice` returns a non-null notice, the
 *     `PendingNoticeAnnouncer` renders the toast.
 *   - The notice announces through exactly one live region (the Toast owns
 *     announcement; the old external mirror is gone, so no double-announce).
 *   - No focus shift fires on pending-notice arrival – the toast IS the
 *     announcement, and moving focus into <main> mid-announce can
 *     interrupt the polite live region on NVDA/JAWS.
 *
 * `useLinksView` is mocked at the module boundary so this test exercises
 * LinksView's surface coordination without spinning up the full links data
 * pipeline. The hook's internals are tested in `useLinksView.test.ts`.
 */

import LinksView from './LinksView';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../../lib/hooks/useLinksView', () => ({
  useLinksView: vi.fn(),
}));

vi.mock('../../lib/hooks/usePendingNotice', () => ({
  usePendingNotice: vi.fn(),
}));

// The two heavy DOM-effect hooks are no-ops for these tests.
vi.mock('../../lib/hooks/useFocusTrap', () => ({
  useFocusTrap: vi.fn(),
}));

vi.mock('../../lib/hooks/useFocusReturn', () => ({
  useFocusReturn: vi.fn(),
}));

vi.mock('../../lib/hooks/useDocumentTitle', () => ({
  useDocumentTitle: vi.fn(),
}));

// ─── Imports after mocks ──────────────────────────────────────────────────────

import { useLinksView } from '../../lib/hooks/useLinksView';
import { usePendingNotice } from '../../lib/hooks/usePendingNotice';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeViewResult(
  overrides: Partial<ReturnType<typeof useLinksView>> = {},
): ReturnType<typeof useLinksView> {
  return {
    debouncedSearch: '',
    deleteError: null,
    error: null,
    fetchError: null,
    filter: 'unread',
    handleClearRead: vi.fn(),
    handleCreated: vi.fn(),
    handleDismissToast: vi.fn(),
    handleLoadMore: vi.fn(),
    handlePasteAndSave: vi.fn(),
    handleRandom: vi.fn(),
    handleToggleForm: vi.fn(),
    handleToggleRead: vi.fn(),
    hasSettledOnce: true,
    isClearingRead: false,
    links: [],
    loadingLinks: false,
    newLinksAnnouncement: '',
    onCloseShortcuts: vi.fn(),
    onNavigateRead: vi.fn(),
    onNavigateUnread: vi.fn(),
    onSearch: vi.fn(),
    onToggleShortcuts: vi.fn(),
    page: 1,
    pagination: { total: 0, hasMore: false } as ReturnType<
      typeof useLinksView
    >['pagination'],
    pasting: false,
    randomError: null,
    randomLoading: false,
    readError: null,
    saveError: null,
    search: '',
    searchInputReference: {
      current: null,
    } as ReturnType<typeof useLinksView>['searchInputReference'],
    selectedLinkIndex: null,
    showLinkForm: false,
    showShortcuts: false,
    toastMessage: null,
    toastVariant: undefined,
    ...overrides,
  };
}

function renderLinksView() {
  return render(
    <MemoryRouter initialEntries={['/unread']}>
      <LinksView />
    </MemoryRouter>,
  );
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useLinksView).mockReturnValue(makeViewResult());
  vi.mocked(usePendingNotice).mockReturnValue({
    notice: null,
    variant: 'success',
    dismiss: vi.fn(),
  });
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('LinksView – add-link form placement', () => {
  it('top-anchors the form on mobile and restores inline flow on desktop', () => {
    vi.mocked(useLinksView).mockReturnValue(
      makeViewResult({ showLinkForm: true }),
    );

    renderLinksView();

    const dialog = screen.getByRole('dialog', { name: 'Add link' });

    // Mobile: pinned near the top of the viewport so the iOS software
    // keyboard (which opens from the bottom) never covers the form and iOS
    // does not scroll it into the lower-middle of the screen.
    expect(dialog.className).toContain('fixed');
    expect(dialog.className).toContain('top-16');
    // Desktop: back to inline flow directly below the toolbar.
    expect(dialog.className).toContain('sm:relative');
    expect(dialog.className).toContain('sm:top-auto');
  });
});

describe('LinksView – add-link form dismissal', () => {
  it('names the dialog with a visible "Add link" heading', () => {
    vi.mocked(useLinksView).mockReturnValue(
      makeViewResult({ showLinkForm: true }),
    );

    renderLinksView();

    // The dialog is named via aria-labelledby pointing at the visible <h2>,
    // so the accessible name resolves from on-screen text.
    const dialog = screen.getByRole('dialog', { name: 'Add link' });
    const heading = screen.getByRole('heading', { name: 'Add link' });
    expect(heading.tagName).toBe('H2');
    expect(dialog).toHaveAttribute('aria-labelledby', heading.id);
  });

  it('closes the form when the Close button is clicked', () => {
    const handleToggleForm = vi.fn();
    vi.mocked(useLinksView).mockReturnValue(
      makeViewResult({ showLinkForm: true, handleToggleForm }),
    );

    renderLinksView();

    fireEvent.click(screen.getByRole('button', { name: 'Close add link' }));

    expect(handleToggleForm).toHaveBeenCalledTimes(1);
  });

  it('hides the backdrop from assistive tech (keyboard close is Escape + the Close button)', () => {
    vi.mocked(useLinksView).mockReturnValue(
      makeViewResult({ showLinkForm: true }),
    );

    const { baseElement } = renderLinksView();

    // The backdrop is a mouse-only affordance: aria-hidden and out of the tab
    // order, so it no longer duplicates the Close control for AT users.
    const scrim = baseElement.querySelector('.scrim');
    expect(scrim).toHaveAttribute('aria-hidden', 'true');
    expect(scrim).toHaveAttribute('tabindex', '-1');
    expect(
      screen.queryByRole('button', { name: 'Close form' }),
    ).not.toBeInTheDocument();
  });
});

describe('LinksView – cross-route pending notice surface', () => {
  it('renders the PendingNoticeAnnouncer toast when usePendingNotice returns a notice', () => {
    vi.mocked(usePendingNotice).mockReturnValue({
      notice: 'Your email has been verified.',
      variant: 'success',
      dismiss: vi.fn(),
    });

    renderLinksView();

    // The visible toast text is a synchronous <div>; locate it by message
    // text (the sr-only announce region is a <span>, excluded by the selector).
    expect(
      screen.getByText('Your email has been verified.', { selector: 'div' }),
    ).toBeInTheDocument();
  });

  it('omits the toast when no notice is queued', () => {
    vi.mocked(usePendingNotice).mockReturnValue({
      notice: null,
      variant: 'success',
      dismiss: vi.fn(),
    });

    renderLinksView();

    // No notice: no toast and no announcing region. The notice surface is the
    // Toast's `span.sr-only[aria-live]`; scoping to it excludes the unrelated
    // newLinksAnnouncement span (role="status", no aria-live) and the
    // SuggestionCallout live region (a <p>, not span.sr-only).
    expect(
      screen.queryByText(/email has been verified/i),
    ).not.toBeInTheDocument();
    expect(document.querySelector('span.sr-only[aria-live]')).toBeNull();
  });

  it('announces an arriving notice through exactly one live region (no double-announce)', () => {
    const { rerender } = render(
      <MemoryRouter initialEntries={['/unread']}>
        <LinksView />
      </MemoryRouter>,
    );

    // First render: notice = null, so the notice surface announces nothing.
    expect(document.querySelector('span.sr-only[aria-live]')).toBeNull();

    // A notice arrives. The Toast mounts and owns the announcement through its
    // own sr-only live region; there is no second (mirror) region to compete.
    vi.mocked(usePendingNotice).mockReturnValue({
      notice: 'Your account has been deleted.',
      variant: 'success',
      dismiss: vi.fn(),
    });
    rerender(
      <MemoryRouter initialEntries={['/unread']}>
        <LinksView />
      </MemoryRouter>,
    );

    const liveRegions = document.querySelectorAll('span.sr-only[aria-live]');
    expect(liveRegions).toHaveLength(1);
    expect(liveRegions[0].getAttribute('role')).toBe('status');
    expect(liveRegions[0].getAttribute('aria-live')).toBe('polite');
    expect(
      screen.getByText('Your account has been deleted.', { selector: 'div' }),
    ).toBeInTheDocument();
  });

  it('does not move focus to <main> on pending-notice arrival (B2)', () => {
    // The fix removed the focus-shift effect entirely; the
    // <main> landmark gets a stable aria-label in AppShell instead, and
    // the toast IS the announcement. This test pins that contract – if
    // a future contributor reintroduces a focus shift here, it'll fail.
    vi.mocked(usePendingNotice).mockReturnValue({
      notice: 'Your email has been verified.',
      variant: 'success',
      dismiss: vi.fn(),
    });

    // Create a <main> element and spy on its focus method to confirm
    // LinksView does NOT call it during render. Even though LinksView
    // no longer accepts a mainReference prop, this guard ensures any
    // future regression that wires one up gets caught.
    const main = document.createElement('main');
    const focusSpy = vi.spyOn(main, 'focus');
    document.body.appendChild(main);

    try {
      renderLinksView();
      expect(focusSpy).not.toHaveBeenCalled();
    } finally {
      main.remove();
    }
  });
});
