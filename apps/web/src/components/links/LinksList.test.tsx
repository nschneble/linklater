import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import LinksList from './LinksList';
import type { Link, PaginatedLinks } from '../../lib/api';

afterEach(() => vi.restoreAllMocks());

beforeEach(() => {
  vi.stubGlobal('open', vi.fn());
});

const makeLink = (overrides: Partial<Link> = {}): Link => ({
  id: 'link-1',
  url: 'https://example.com',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  readAt: null,
  meta: null,
  ...overrides,
});

const makePagination = (
  overrides: Partial<Pick<PaginatedLinks, 'total' | 'limit'>> = {},
): Pick<PaginatedLinks, 'total' | 'limit'> => ({
  total: 10,
  limit: 5,
  ...overrides,
});

const defaultProps = {
  filter: 'unread' as const,
  isClearingRead: false,
  links: [],
  loadingLinks: false,
  page: 1,
  pagination: null,
  search: '',
  debouncedSearch: '',
  onReadToggle: vi.fn(),
  onLoadMore: vi.fn(),
};

describe('LinksList', () => {
  it('shows a skeleton card when loading on page 1', () => {
    const { container } = render(
      <LinksList {...defaultProps} loadingLinks={true} page={1} />,
    );
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('shows "No unread links" when unread filter has no results', () => {
    render(<LinksList {...defaultProps} filter="unread" links={[]} />);
    expect(screen.getByText('No unread links')).toBeInTheDocument();
  });

  it('shows "No read links" when read filter has no results', () => {
    render(<LinksList {...defaultProps} filter="read" links={[]} />);
    expect(screen.getByText('No read links')).toBeInTheDocument();
  });

  it('shows a search icon when no results and a search query is present', () => {
    const { container } = render(
      <LinksList {...defaultProps} links={[]} search="typescript" />,
    );
    expect(container.querySelector('.fa-magnifying-glass')).toBeInTheDocument();
  });

  it('renders one card per link', () => {
    const links = [
      makeLink({ id: 'link-1' }),
      makeLink({ id: 'link-2' }),
      makeLink({ id: 'link-3' }),
    ];
    render(<LinksList {...defaultProps} links={links} />);
    expect(screen.getAllByRole('link')).toHaveLength(3);
  });

  it('shows a Load more button when there are more links to load', () => {
    const links = [makeLink({ id: 'link-1' }), makeLink({ id: 'link-2' })];
    render(
      <LinksList
        {...defaultProps}
        links={links}
        pagination={makePagination({ total: 10, limit: 5 })}
      />,
    );
    expect(screen.getByText(/load more/i)).toBeInTheDocument();
  });

  it('does not show Load more when all links are loaded', () => {
    const links = [makeLink({ id: 'link-1' })];
    render(
      <LinksList
        {...defaultProps}
        links={links}
        pagination={makePagination({ total: 1, limit: 5 })}
      />,
    );
    expect(screen.queryByText(/load more/i)).not.toBeInTheDocument();
  });

  it('calls onLoadMore when Load more is clicked', () => {
    const onLoadMore = vi.fn();
    const links = [makeLink()];
    render(
      <LinksList
        {...defaultProps}
        links={links}
        pagination={makePagination({ total: 5 })}
        onLoadMore={onLoadMore}
      />,
    );
    fireEvent.click(screen.getByText(/load more/i));
    expect(onLoadMore).toHaveBeenCalledOnce();
  });

  it('shows a skeleton at the bottom when loading on page 2+', () => {
    const links = [makeLink()];
    const { container } = render(
      <LinksList
        {...defaultProps}
        links={links}
        loadingLinks={true}
        page={2}
      />,
    );
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
    expect(screen.queryByRole('link')).toBeInTheDocument();
  });

  it('shows a search icon when debouncedSearch is non-empty but search is empty', () => {
    const { container } = render(
      <LinksList
        {...defaultProps}
        links={[]}
        search=""
        debouncedSearch="react"
      />,
    );
    expect(container.querySelector('.fa-magnifying-glass')).toBeInTheDocument();
  });

  it('applies animate-card-exit class to cards while isClearingRead is true', () => {
    const links = [makeLink({ id: 'link-1' }), makeLink({ id: 'link-2' })];
    const { container } = render(
      <LinksList {...defaultProps} links={links} isClearingRead={true} />,
    );
    const exitCards = container.querySelectorAll('.animate-card-exit');
    expect(exitCards.length).toBe(2);
  });

  it('does not apply animate-card-exit class when isClearingRead is false', () => {
    const links = [makeLink()];
    const { container } = render(
      <LinksList {...defaultProps} links={links} isClearingRead={false} />,
    );
    expect(container.querySelector('.animate-card-exit')).toBeNull();
  });

  it('does not show Load more while loading more pages', () => {
    const links = [makeLink()];
    render(
      <LinksList
        {...defaultProps}
        links={links}
        loadingLinks={true}
        page={2}
        pagination={makePagination({ total: 5 })}
      />,
    );
    expect(screen.queryByText(/load more/i)).not.toBeInTheDocument();
  });

  it('shows the remaining count in the Load more button label', () => {
    const links = [makeLink({ id: 'link-1' }), makeLink({ id: 'link-2' })];
    render(
      <LinksList
        {...defaultProps}
        links={links}
        pagination={makePagination({ total: 7, limit: 5 })}
      />,
    );
    expect(screen.getByText(/5 remaining/i)).toBeInTheDocument();
  });
});
