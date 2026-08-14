/**
 * Tests for LinksView focused on the cross-route pending-notice surface.
 *
 * Coverage:
 *   - When `usePendingNotice` returns a non-null notice, the
 *     `PendingNoticeAnnouncer` renders the toast.
 *   - The sr-only mirror text updates from empty → notice text.
 *   - No focus shift fires on pending-notice arrival – the toast IS the
 *     announcement, and moving focus into <main> mid-announce can
 *     interrupt the polite live region on NVDA/JAWS.
 *
 * `useLinksView` is mocked at the module boundary so this test exercises
 * LinksView's surface coordination without spinning up the full links data
 * pipeline. The hook's internals are tested in `useLinksView.test.ts`.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import LinksView from './LinksView';
import { MemoryRouter } from 'react-router';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../../lib/hooks/useLinksView', () => ({
  useLinksView: vi.fn(),
}));

vi.mock('../../lib/hooks/usePendingNotice', () => ({
  usePendingNotice: vi.fn(),
}));

// the two heavy DOM-effect hooks are no-ops for these tests
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
    pagination: { total: 0, hasMore: false } as unknown as ReturnType<
      typeof useLinksView
    >['pagination'],
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
    standing: false,
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

    // mobile: top-anchored so the iOS software keyboard never covers it
    expect(dialog.className).toContain('fixed');
    expect(dialog.className).toContain('top-16');
    // desktop: back to inline flow directly below the toolbar
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

    // aria-labelledby points at the visible <h2> so the name is on-screen
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

    // backdrop is mouse-only: aria-hidden and out of the tab order for AT
    const scrim = baseElement.querySelector('.scrim');
    expect(scrim).toHaveAttribute('aria-hidden', 'true');
    expect(scrim).toHaveAttribute('tabindex', '-1');
    expect(
      screen.queryByRole('button', { name: 'Close form' }),
    ).not.toBeInTheDocument();
  });
});

describe('LinksView – in-session toast announcement (Fix #7)', () => {
  it('mirrors toastMessage into the dedicated live region so the announcement is not missed', async () => {
    vi.mocked(useLinksView).mockReturnValue(
      makeViewResult({ toastMessage: 'Link saved!' }),
    );

    renderLinksView();

    const region = screen.getByTestId('toast-announcement');
    // clear-then-set driver fires next tick; await the mirror, not a sync read
    await waitFor(() => expect(region.textContent).toBe('Link saved!'));
  });

  it('keeps the dedicated region mounted (and empty) when no toast is showing', () => {
    vi.mocked(useLinksView).mockReturnValue(
      makeViewResult({ toastMessage: null }),
    );

    renderLinksView();

    const region = screen.getByTestId('toast-announcement');
    expect(region.textContent).toBe('');
  });
});

describe('LinksView – background inert while the add-link dialog is open (Fix #8)', () => {
  it('marks the background siblings inert when the dialog is open', () => {
    vi.mocked(useLinksView).mockReturnValue(
      makeViewResult({ showLinkForm: true, error: 'Could not save link' }),
    );

    const { container } = renderLinksView();

    // `inert` implies `aria-hidden`, so find these hosts structurally

    // heading row (holds the "Your links" h1 + shortcuts toggle)
    const heading = container.querySelector('h1');
    expect(heading?.parentElement).toHaveAttribute('inert');

    // description paragraph
    const description = screen
      .getByText('Add, search, or stumble upon something random.')
      .closest('p');
    expect(description).toHaveAttribute('inert');

    // both LinksToolbar rows sit under an inert ancestor
    const tablist = container.querySelector('[role="tablist"]');
    expect(tablist?.closest('[inert]')).not.toBeNull();
    const searchInput = container.querySelector('input[type="search"]');
    expect(searchInput?.closest('[inert]')).not.toBeNull();

    // the error Alert's rendered <p>
    expect(container.querySelector('[role="alert"]')).toHaveAttribute('inert');

    // the links list tabpanel root
    expect(container.querySelector('#links-list')).toHaveAttribute('inert');
  });

  it('keeps the dialog and its contents interactive (not inert) while open', () => {
    vi.mocked(useLinksView).mockReturnValue(
      makeViewResult({ showLinkForm: true }),
    );

    renderLinksView();

    // the dialog itself must never be inert (the #root-inerting regression)
    const dialog = screen.getByRole('dialog', { name: 'Add link' });
    expect(dialog).not.toHaveAttribute('inert');
    expect(dialog.closest('[inert]')).toBeNull();

    const closeButton = screen.getByRole('button', { name: 'Close add link' });
    expect(closeButton.closest('[inert]')).toBeNull();
  });

  it('never inerts the toast or the cross-cutting live regions, even alongside an open dialog', () => {
    // `toastMessage` + `showLinkForm` co-occur; inert would silence aria-live
    vi.mocked(useLinksView).mockReturnValue(
      makeViewResult({ showLinkForm: true, toastMessage: 'Link saved!' }),
    );

    renderLinksView();

    const toastRegion = screen.getByTestId('toast-announcement');
    expect(toastRegion).not.toHaveAttribute('inert');
    expect(toastRegion.closest('[inert]')).toBeNull();

    // the visual Toast card is not behind an inert ancestor either
    const toastCards = screen.getAllByText('Link saved!', { selector: 'div' });
    for (const card of toastCards) {
      expect(card.closest('[inert]')).toBeNull();
    }
  });

  it('leaves every sibling non-inert when the dialog is closed', () => {
    vi.mocked(useLinksView).mockReturnValue(
      makeViewResult({ showLinkForm: false, error: 'Could not save link' }),
    );

    renderLinksView();

    const heading = screen.getByRole('heading', {
      name: 'Your links',
      level: 1,
    });
    expect(heading.parentElement).not.toHaveAttribute('inert');
    expect(screen.getByRole('tabpanel')).not.toHaveAttribute('inert');
    expect(screen.getByRole('alert')).not.toHaveAttribute('inert');
    expect(
      screen.getByRole('tablist', { name: 'Links filter' }).closest('[inert]'),
    ).toBeNull();
  });
});

describe('LinksView – cross-route pending notice surface', () => {
  it('renders the PendingNoticeAnnouncer toast when usePendingNotice returns a notice', () => {
    vi.mocked(usePendingNotice).mockReturnValue({
      notice: 'Your email has been verified.',
      variant: 'success',
      standing: false,
      dismiss: vi.fn(),
    });

    renderLinksView();

    // multiple role="status" exist, so locate the toast by message text
    expect(
      screen.getByText('Your email has been verified.', { selector: 'div' }),
    ).toBeInTheDocument();
  });

  it('paints a standing notice in the flow rather than in a timed toast', () => {
    vi.mocked(usePendingNotice).mockReturnValue({
      notice: "We couldn't get you back into that session",
      variant: 'warning',
      standing: true,
      dismiss: vi.fn(),
    });

    renderLinksView();

    const painted = screen
      .getAllByText("We couldn't get you back into that session")
      .find((element) => element.closest('.sr-only') === null);
    expect(painted?.closest('div')?.className).not.toContain('fixed');
  });

  it('omits the toast when no notice is queued', () => {
    vi.mocked(usePendingNotice).mockReturnValue({
      notice: null,
      variant: 'success',
      standing: false,
      dismiss: vi.fn(),
    });

    renderLinksView();

    // mirror stays mounted empty so a later empty→populated change announces
    expect(
      screen.queryByText(/email has been verified/i),
    ).not.toBeInTheDocument();
  });

  it('sr-only mirror text updates from empty to the notice text', () => {
    const { rerender } = render(
      <MemoryRouter initialEntries={['/unread']}>
        <LinksView />
      </MemoryRouter>,
    );

    // several regions share this sr-only shape; take the pending-notice one
    const liveRegions = document.querySelectorAll(
      'span.sr-only[data-testid="pending-notice-announcement"]',
    );
    expect(liveRegions.length).toBe(1);
    expect(liveRegions[0]?.textContent).toBe('');

    // the empty→populated transition is what triggers the SR announcement
    vi.mocked(usePendingNotice).mockReturnValue({
      notice: 'Your account has been deleted.',
      variant: 'success',
      standing: false,
      dismiss: vi.fn(),
    });
    rerender(
      <MemoryRouter initialEntries={['/unread']}>
        <LinksView />
      </MemoryRouter>,
    );

    const liveRegionsAfter = document.querySelectorAll(
      'span.sr-only[data-testid="pending-notice-announcement"]',
    );
    expect(liveRegionsAfter[0]?.textContent).toBe(
      'Your account has been deleted.',
    );
  });

  it('does not move focus to <main> on pending-notice arrival (B2)', () => {
    // no focus shift on notice arrival; the toast IS the announcement
    vi.mocked(usePendingNotice).mockReturnValue({
      notice: 'Your email has been verified.',
      variant: 'success',
      standing: false,
      dismiss: vi.fn(),
    });

    // spy on <main>.focus to prove LinksView never moves focus there
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
