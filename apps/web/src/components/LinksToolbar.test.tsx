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
      filter="active"
      isClearingArchived={false}
      links={[]}
      randomLoading={false}
      search=""
      searchInputRef={searchInputRef}
      showLinkForm={false}
      onClearArchived={vi.fn()}
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

  it('marks the Unread tab as active when filter is active', () => {
    renderToolbar({ filter: 'active' });
    expect(screen.getByRole('tab', { name: 'Unread' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tab', { name: 'Read' })).toHaveAttribute(
      'aria-selected',
      'false',
    );
  });

  it('marks the Read tab as active when filter is archived', () => {
    renderToolbar({ filter: 'archived' });
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
    renderToolbar({ filter: 'active' });
    expect(
      screen.getByPlaceholderText('Search unread links'),
    ).toBeInTheDocument();
  });

  it('renders the search input with placeholder for archived filter', () => {
    renderToolbar({ filter: 'archived' });
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
});
