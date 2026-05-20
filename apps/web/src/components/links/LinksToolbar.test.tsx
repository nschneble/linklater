import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import LinksToolbar from './LinksToolbar';

afterEach(() => vi.restoreAllMocks());

function renderToolbar(
  overrides: Partial<Parameters<typeof LinksToolbar>[0]> = {},
) {
  const searchInputRef = {
    current: null,
  } as React.RefObject<HTMLInputElement | null>;
  return render(
    <LinksToolbar
      filter="unread"
      isClearingRead={false}
      links={[]}
      randomLoading={false}
      search=""
      searchInputRef={searchInputRef}
      showLinkForm={false}
      onClearRead={vi.fn()}
      onNavigateRead={vi.fn()}
      onNavigateUnread={vi.fn()}
      onRandom={vi.fn()}
      onSearch={vi.fn()}
      onToggleForm={vi.fn()}
      {...overrides}
    />,
  );
}

describe('LinksToolbar', () => {
  it('renders Unread and Read tabs', () => {
    renderToolbar();
    expect(screen.getByRole('tab', { name: 'Unread' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Read' })).toBeInTheDocument();
  });

  it('marks the Unread tab as active when filter is unread', () => {
    renderToolbar({ filter: 'unread' });
    expect(screen.getByRole('tab', { name: 'Unread' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tab', { name: 'Read' })).toHaveAttribute(
      'aria-selected',
      'false',
    );
  });

  it('marks the Read tab as active when filter is read', () => {
    renderToolbar({ filter: 'read' });
    expect(screen.getByRole('tab', { name: 'Read' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tab', { name: 'Unread' })).toHaveAttribute(
      'aria-selected',
      'false',
    );
  });

  it('calls onNavigateUnread when the Unread tab is clicked', () => {
    const onNavigateUnread = vi.fn();
    renderToolbar({ onNavigateUnread });
    fireEvent.click(screen.getByRole('tab', { name: 'Unread' }));
    expect(onNavigateUnread).toHaveBeenCalledOnce();
  });

  it('calls onNavigateRead when the Read tab is clicked', () => {
    const onNavigateRead = vi.fn();
    renderToolbar({ onNavigateRead });
    fireEvent.click(screen.getByRole('tab', { name: 'Read' }));
    expect(onNavigateRead).toHaveBeenCalledOnce();
  });

  it('renders the search input with placeholder for unread filter', () => {
    renderToolbar({ filter: 'unread' });
    expect(
      screen.getByPlaceholderText('Search unread links'),
    ).toBeInTheDocument();
  });

  it('renders the search input with placeholder for read filter', () => {
    renderToolbar({ filter: 'read' });
    expect(
      screen.getByPlaceholderText('Search read links'),
    ).toBeInTheDocument();
  });

  it('calls onSearch when search input changes', () => {
    const onSearch = vi.fn();
    renderToolbar({ onSearch });
    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: 'typescript' },
    });
    expect(onSearch).toHaveBeenCalledWith('typescript');
  });

  it('renders with the current search value', () => {
    renderToolbar({ search: 'hello' });
    expect(screen.getByRole('searchbox')).toHaveValue('hello');
  });

  it('blurs the search input when Escape is pressed inside it', () => {
    renderToolbar();
    const input = screen.getByRole('searchbox');
    input.focus();
    expect(document.activeElement).toBe(input);

    fireEvent.keyDown(input, { key: 'Escape' });

    expect(document.activeElement).not.toBe(input);
  });

  describe('mobile filter controls', () => {
    // The mobile icon strip uses explicit aria-label attributes that differ from
    // the desktop button text — so we can target it precisely.

    it('shows the mobile trash button when filter is read and links exist', () => {
      renderToolbar({
        filter: 'read',
        links: [
          {
            id: 'link-1',
            url: 'https://example.com',
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-01T00:00:00Z',
            readAt: '2026-01-02T00:00:00Z',
            meta: null,
          },
        ],
      });
      // Mobile trash uses aria-label="Remove all read links" (no "button" text)
      expect(
        screen.getByRole('button', { name: 'Remove all read links' }),
      ).toBeInTheDocument();
    });

    it('does not show the mobile trash button when filter is read but links is empty', () => {
      renderToolbar({ filter: 'read', links: [] });
      // Mobile trash uses disabled (not the hidden prop), so it stays visible
      // but non-interactive when the list is empty.
      const button = screen.getByRole('button', { name: 'Remove all read links' });
      expect(button).toBeDisabled();
    });

    it('calls onClearRead when the mobile trash button is clicked', () => {
      const onClearRead = vi.fn();
      renderToolbar({
        filter: 'read',
        links: [
          {
            id: 'link-1',
            url: 'https://example.com',
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-01T00:00:00Z',
            readAt: '2026-01-02T00:00:00Z',
            meta: null,
          },
        ],
        onClearRead,
      });
      fireEvent.click(
        screen.getByRole('button', { name: 'Remove all read links' }),
      );
      expect(onClearRead).toHaveBeenCalledOnce();
    });

    it('shows the mobile shuffle button when filter is unread', () => {
      renderToolbar({ filter: 'unread' });
      // Both the desktop and mobile Stumble! buttons share the same accessible
      // name, so getAllByRole is used to avoid a "multiple elements" error.
      expect(
        screen.getAllByRole('button', { name: 'Stumble!' })[0],
      ).toBeInTheDocument();
    });

    it('calls onToggleForm when the mobile Add link button is clicked', () => {
      const onToggleForm = vi.fn();
      renderToolbar({ filter: 'unread', onToggleForm });
      // The mobile button has a unique aria-label="Add link" (no icon text next to it)
      // while the desktop button's accessible name comes from its text content.
      // Both match "Add link" — clicking any of them should invoke onToggleForm.
      const addButtons = screen.getAllByRole('button', { name: 'Add link' });
      fireEvent.click(addButtons[addButtons.length - 1]);
      expect(onToggleForm).toHaveBeenCalledOnce();
    });

    it('shows Hide form label when showLinkForm is true', () => {
      renderToolbar({ filter: 'unread', showLinkForm: true });
      // Both desktop ("Hide form" text) and mobile (aria-label="Hide form") are present
      const hideButtons = screen.getAllByRole('button', { name: /hide form/i });
      expect(hideButtons.length).toBeGreaterThanOrEqual(1);
    });
  });
});
