/*
 * Tests for LinksList – the paginated list region rendered inside LinksView.
 *
 * Focus of this file: the loading contract after the skeleton placeholders
 * were removed. Sighted users see no placeholder (links load fast enough that
 * one reads as a distracting flash); instead the initial-load / empty-refetch
 * branch renders a visually hidden `role="status"` "Loading links…" so screen
 * readers still hear the load (WCAG 4.1.3 Status Messages). Subsequent
 * re-fetches keep the stale list (or empty state) mounted with `aria-busy` on
 * the tabpanel container as the AT-only affordance, and the "Load more" button
 * stays mounted (aria-busy/aria-disabled) through the fetch it triggers so
 * keyboard focus is never dropped to <body> (WCAG 2.4.3 Focus Order).
 */

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import LinksList, { LINKS_LIST_ID } from './LinksList';
import { ThemeProvider } from '../../theme/ThemeContext';
import type { Link } from '../../lib/api';
import type { ReactElement } from 'react';

function renderWithProviders(ui: ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

function makeLink(overrides: Partial<Link> = {}): Link {
  return {
    id: 'link-1',
    url: 'https://example.com',
    meta: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    readAt: null,
    ...overrides,
  };
}

const baseProps = {
  filter: 'unread' as const,
  hasSettledOnce: false,
  isClearingRead: false,
  links: [],
  loadingLinks: false,
  pagination: null,
  search: '',
  debouncedSearch: '',
  selectedLinkIndex: null,
  onReadToggle: vi.fn(),
  onLoadMore: vi.fn(),
};

describe('LinksList initial load', () => {
  it('renders a visually hidden role="status" loading cue on the very first fetch (hasSettledOnce=false)', () => {
    renderWithProviders(
      <LinksList {...baseProps} loadingLinks={true} hasSettledOnce={false} />,
    );

    // No visible placeholder flashes; the load is announced to screen readers
    // only, via a visually hidden role="status" live region (WCAG 4.1.3). A
    // live region announces its text content on change, so we assert the
    // content rather than an accessible name (`status` takes no name from
    // content).
    const status = screen.getByRole('status');
    expect(status.className).toContain('sr-only');
    expect(status.textContent).toMatch(/loading links/i);
    // The empty-state message must not appear mid-load.
    expect(screen.queryByText(/no unread links/i)).toBeNull();
  });

  it('sets aria-busy="true" on the tabpanel container during the initial load', () => {
    renderWithProviders(
      <LinksList {...baseProps} loadingLinks={true} hasSettledOnce={false} />,
    );

    const tabpanel = document.getElementById(LINKS_LIST_ID);
    expect(tabpanel?.getAttribute('aria-busy')).toBe('true');
    expect(tabpanel?.getAttribute('role')).toBe('tabpanel');
  });
});

describe('LinksList re-fetch (post first settle)', () => {
  it('keeps stale content mounted with no loading cue when hasSettledOnce is true and the list is non-empty', () => {
    renderWithProviders(
      <LinksList
        {...baseProps}
        loadingLinks={true}
        hasSettledOnce={true}
        links={[makeLink({ id: 'a' })]}
      />,
    );

    // The stale list stays mounted instead of clearing; the loading affordance
    // is AT-only via aria-busy on the tabpanel, so no role="status" cue renders
    // over populated content.
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('sets aria-busy="true" on the tabpanel during a re-fetch (AT-only affordance)', () => {
    renderWithProviders(
      <LinksList
        {...baseProps}
        loadingLinks={true}
        hasSettledOnce={true}
        links={[makeLink({ id: 'a' })]}
      />,
    );

    const tabpanel = document.getElementById(LINKS_LIST_ID);
    expect(tabpanel?.getAttribute('aria-busy')).toBe('true');
  });

  it('renders the visually hidden loading cue (not the empty message) on a post-settle page-1 refetch over a blanked list', () => {
    // The flash bug: hasSettledOnce is already true, the page-1 refetch has
    // blanked links to [] and set loadingLinks true. There must be NO render
    // where links.length === 0 && loadingLinks === true resolves to the
    // empty-text branch; it must resolve to the visually hidden loading status.
    // (The empty list is reached the same way whether or not a search term is
    // active, so a single case covers both the blanked-list and no-matches
    // windows.)
    renderWithProviders(
      <LinksList
        {...baseProps}
        loadingLinks={true}
        hasSettledOnce={true}
        links={[]}
      />,
    );

    const status = screen.getByRole('status');
    expect(status.className).toContain('sr-only');
    expect(status.textContent).toMatch(/loading links/i);
    expect(screen.queryByText(/no unread links/i)).toBeNull();
    const tabpanel = document.getElementById(LINKS_LIST_ID);
    expect(tabpanel?.getAttribute('aria-busy')).toBe('true');
  });
});

describe('LinksList loading-status lifecycle (WCAG 4.1.3)', () => {
  it('shows the loading cue only while loading with no content, and drops it once content or the empty state renders', () => {
    const { rerender } = renderWithProviders(
      <LinksList {...baseProps} loadingLinks={true} hasSettledOnce={false} />,
    );
    expect(screen.getByRole('status').textContent).toMatch(/loading links/i);

    // Content settles: the cue is gone and cards render.
    rerender(
      <ThemeProvider>
        <LinksList
          {...baseProps}
          loadingLinks={false}
          hasSettledOnce={true}
          links={[makeLink({ id: 'a' })]}
        />
      </ThemeProvider>,
    );
    expect(screen.queryByRole('status')).toBeNull();

    // Empty state settles: the cue is gone and the empty message renders.
    rerender(
      <ThemeProvider>
        <LinksList
          {...baseProps}
          loadingLinks={false}
          hasSettledOnce={true}
          links={[]}
        />
      </ThemeProvider>,
    );
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByText(/no unread links/i)).toBeTruthy();
  });
});

describe('LinksList "Load more" focus preservation (WCAG 2.4.3)', () => {
  const loadMoreProps = {
    ...baseProps,
    hasSettledOnce: true,
    links: [makeLink({ id: 'a' })],
    pagination: { total: 5, limit: 20 },
  };

  it('keeps the button mounted with aria-busy/aria-disabled and a loading label through a page>1 fetch', () => {
    const { rerender } = renderWithProviders(
      <LinksList {...loadMoreProps} loadingLinks={false} />,
    );

    // Idle: the button offers the remaining count and is not busy.
    const idleButton = screen.getByRole('button', { name: /load more/i });
    expect(idleButton.getAttribute('aria-busy')).toBe('false');

    // Fetch starts: the button stays mounted, now busy/disabled with a loading
    // label, so keyboard focus is never dropped to <body>.
    rerender(
      <ThemeProvider>
        <LinksList {...loadMoreProps} loadingLinks={true} />
      </ThemeProvider>,
    );
    const busyButton = screen.getByRole('button', { name: /loading/i });
    expect(busyButton.getAttribute('aria-busy')).toBe('true');
    expect(busyButton.getAttribute('aria-disabled')).toBe('true');
    expect(screen.queryByRole('button', { name: /load more/i })).toBeNull();
  });

  it('does not fire onLoadMore while a fetch is already in flight', () => {
    const onLoadMore = vi.fn();
    renderWithProviders(
      <LinksList
        {...loadMoreProps}
        loadingLinks={true}
        onLoadMore={onLoadMore}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /loading/i }));
    expect(onLoadMore).not.toHaveBeenCalled();
  });
});

describe('LinksList mobile-reflow guard (WCAG 1.4.10)', () => {
  it('gives each grid item `min-w-0` so a long unbreakable title cannot inflate the track', () => {
    // The grid item's default `min-width: auto` lets an unbreakable title/URL
    // grow the `grid grid-cols-1` track past the viewport, producing horizontal
    // scroll on mobile. `min-w-0` on the map wrapper resets that minimum to 0
    // WITHOUT clipping (the card stays `overflow-visible`, so the favicon still
    // straddles the left border). Dropping `min-w-0` reintroduces the overflow,
    // so this fails if the guard is removed. jsdom has no layout engine, so the
    // live 320px scrollWidth check lives in the PR notes; this is the structural
    // oracle for the guard's presence.
    renderWithProviders(
      <LinksList
        {...baseProps}
        hasSettledOnce={true}
        links={[makeLink({ id: 'a' })]}
      />,
    );

    const tabpanel = document.getElementById(LINKS_LIST_ID);
    const list = tabpanel?.querySelector('[role="list"]');
    const listItem = list?.firstElementChild;
    expect(listItem?.className).toContain('min-w-0');
  });
});

describe('LinksList list semantics (WCAG 1.3.1)', () => {
  it('wraps the populated cards in a role="list" with role="listitem" children', () => {
    renderWithProviders(
      <LinksList
        {...baseProps}
        hasSettledOnce={true}
        links={[makeLink({ id: 'a' }), makeLink({ id: 'b' })]}
      />,
    );

    const tabpanel = document.getElementById(LINKS_LIST_ID);
    const list = tabpanel?.querySelector('[role="list"]');
    expect(list).not.toBeNull();
    // The grid classes live on the list itself, not the tabpanel container.
    expect(list?.className).toContain('grid');
    expect(list?.className).toContain('grid-cols-1');

    const listItems = list?.querySelectorAll('[role="listitem"]');
    expect(listItems?.length).toBe(2);
    // The tabpanel keeps its own busy/labelling contract.
    expect(tabpanel?.getAttribute('role')).toBe('tabpanel');
  });

  it('keeps the "Load more" button outside the role="list"', () => {
    renderWithProviders(
      <LinksList
        {...baseProps}
        hasSettledOnce={true}
        links={[makeLink({ id: 'a' })]}
        pagination={{ total: 5, limit: 20 }}
      />,
    );

    const loadMore = screen.getByRole('button', { name: /load more/i });
    expect(loadMore.closest('[role="list"]')).toBeNull();
  });

  it('does not render a role="list" for the empty state', () => {
    renderWithProviders(
      <LinksList {...baseProps} hasSettledOnce={true} links={[]} />,
    );

    const tabpanel = document.getElementById(LINKS_LIST_ID);
    expect(tabpanel?.querySelector('[role="list"]')).toBeNull();
  });
});

describe('LinksList settled non-loading states', () => {
  it('renders aria-busy="false" once the fetch has settled', () => {
    renderWithProviders(
      <LinksList
        {...baseProps}
        loadingLinks={false}
        hasSettledOnce={true}
        links={[makeLink({ id: 'a' })]}
      />,
    );

    const tabpanel = document.getElementById(LINKS_LIST_ID);
    expect(tabpanel?.getAttribute('aria-busy')).toBe('false');
  });

  it('preserves role="tabpanel" and aria-labelledby across every branch', () => {
    // Initial load
    const { rerender } = renderWithProviders(
      <LinksList {...baseProps} loadingLinks={true} hasSettledOnce={false} />,
    );
    let tabpanel = document.getElementById(LINKS_LIST_ID);
    expect(tabpanel?.getAttribute('role')).toBe('tabpanel');
    expect(tabpanel?.getAttribute('aria-labelledby')).toBe('tab-unread');

    // Empty branch
    rerender(
      <ThemeProvider>
        <LinksList
          {...baseProps}
          loadingLinks={false}
          hasSettledOnce={true}
          links={[]}
        />
      </ThemeProvider>,
    );
    tabpanel = document.getElementById(LINKS_LIST_ID);
    expect(tabpanel?.getAttribute('role')).toBe('tabpanel');

    // Populated branch
    rerender(
      <ThemeProvider>
        <LinksList
          {...baseProps}
          loadingLinks={false}
          hasSettledOnce={true}
          links={[makeLink({ id: 'a' })]}
        />
      </ThemeProvider>,
    );
    tabpanel = document.getElementById(LINKS_LIST_ID);
    expect(tabpanel?.getAttribute('role')).toBe('tabpanel');

    // Read filter swaps the aria-labelledby
    rerender(
      <ThemeProvider>
        <LinksList
          {...baseProps}
          filter="read"
          loadingLinks={false}
          hasSettledOnce={true}
          links={[]}
        />
      </ThemeProvider>,
    );
    tabpanel = document.getElementById(LINKS_LIST_ID);
    expect(tabpanel?.getAttribute('aria-labelledby')).toBe('tab-read');
  });
});
