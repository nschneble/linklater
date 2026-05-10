import { fireEvent, render, screen } from '@testing-library/react';
import LinkCard from './LinkCard';
import type { Link } from '../lib/api';

const makeLink = (overrides: Partial<Link> = {}): Link => ({
  createdAt: '2026-01-01T00:00:00.000Z',
  id: 'link-1',
  updatedAt: '2026-01-01T00:00:00.000Z',
  url: 'https://example.com/article',
  readAt: null,
  meta: {
    fetchedAt: '2026-01-01T00:01:00.000Z',
    title: 'Example Article',
    faviconUrl: null,
    description: null,
    imageUrl: null,
    siteName: null,
  },
  ...overrides,
});

describe('LinkCard', () => {
  beforeEach(() => {
    vi.stubGlobal('open', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('card click', () => {
    it('opens the link in a new tab', () => {
      render(<LinkCard link={makeLink()} onArchiveToggle={vi.fn()} />);

      fireEvent.click(screen.getByRole('link'));

      expect(window.open).toHaveBeenCalledWith(
        'https://example.com/article',
        '_blank',
        'noreferrer',
      );
    });

    it('calls onArchiveToggle when link is not archived', () => {
      const onArchiveToggle = vi.fn();
      render(
        <LinkCard
          link={makeLink({ readAt: null })}
          onArchiveToggle={onArchiveToggle}
        />,
      );

      fireEvent.click(screen.getByRole('link'));

      expect(onArchiveToggle).toHaveBeenCalledOnce();
    });

    it('does not call onArchiveToggle when link is already archived', () => {
      const onArchiveToggle = vi.fn();
      render(
        <LinkCard
          link={makeLink({ readAt: '2026-01-02T00:00:00.000Z' })}
          onArchiveToggle={onArchiveToggle}
        />,
      );

      fireEvent.click(screen.getByRole('link'));

      expect(onArchiveToggle).not.toHaveBeenCalled();
    });
  });

  describe('metadata loading state', () => {
    it('shows a pulsing dot when meta is null', () => {
      const { container } = render(
        <LinkCard link={makeLink({ meta: null })} onArchiveToggle={vi.fn()} />,
      );

      expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
    });

    it('does not show a pulsing dot when meta.fetchedAt is set', () => {
      const { container } = render(
        <LinkCard
          link={makeLink({ meta: { fetchedAt: '2026-01-01T00:01:00.000Z' } })}
          onArchiveToggle={vi.fn()}
        />,
      );

      expect(
        container.querySelector('span.animate-pulse'),
      ).not.toBeInTheDocument();
    });

    it('renders favicon image when meta.faviconUrl is set and meta.fetchedAt is set', () => {
      const { container } = render(
        <LinkCard
          link={makeLink({
            meta: {
              fetchedAt: '2026-01-01T00:01:00.000Z',
              faviconUrl: 'https://example.com/favicon.ico',
            },
          })}
          onArchiveToggle={vi.fn()}
        />,
      );

      const images = container.querySelectorAll('img[aria-hidden="true"]');
      const faviconImage = Array.from(images).find(
        (image) =>
          (image as HTMLImageElement).src === 'https://example.com/favicon.ico',
      );
      expect(faviconImage).toBeInTheDocument();
    });
  });

  describe('metadata content', () => {
    it('renders description when meta.title and meta.description are set', () => {
      render(
        <LinkCard
          link={makeLink({
            meta: {
              fetchedAt: '2026-01-01T00:01:00.000Z',
              title: 'Example Article',
              description: 'An interesting article',
            },
          })}
          onArchiveToggle={vi.fn()}
        />,
      );

      expect(screen.getByText('An interesting article')).toBeInTheDocument();
    });

    it('renders image when meta.imageUrl is set', () => {
      const { container } = render(
        <LinkCard
          link={makeLink({
            meta: {
              fetchedAt: '2026-01-01T00:01:00.000Z',
              imageUrl: 'https://example.com/og.jpg',
            },
          })}
          onArchiveToggle={vi.fn()}
        />,
      );

      const images = container.querySelectorAll('img[aria-hidden="true"]');
      const ogImage = Array.from(images).find(
        (image) =>
          (image as HTMLImageElement).src === 'https://example.com/og.jpg',
      );
      expect(ogImage).toBeInTheDocument();
    });

    it('shows placeholder image when meta.fetchedAt is set but imageUrl is absent', () => {
      const { container } = render(
        <LinkCard
          link={makeLink({
            meta: {
              fetchedAt: '2026-01-01T00:01:00.000Z',
              imageUrl: null,
            },
          })}
          onArchiveToggle={vi.fn()}
        />,
      );

      const images = container.querySelectorAll('img[aria-hidden="true"]');
      const placeholderImage = Array.from(images).find((image) =>
        (image as HTMLImageElement).src.startsWith('https://placehold.co/'),
      );
      expect(placeholderImage).toBeInTheDocument();
    });

    it('shows (No Title) when meta.title is absent', () => {
      render(
        <LinkCard
          link={makeLink({
            meta: {
              fetchedAt: '2026-01-01T00:01:00.000Z',
              title: null,
            },
          })}
          onArchiveToggle={vi.fn()}
        />,
      );

      expect(screen.getByText('(No title)')).toBeInTheDocument();
    });

    it('shows url as description when meta.title is absent', () => {
      render(
        <LinkCard
          link={makeLink({
            url: 'https://example.com/article',
            meta: {
              fetchedAt: '2026-01-01T00:01:00.000Z',
              title: null,
            },
          })}
          onArchiveToggle={vi.fn()}
        />,
      );

      expect(
        screen.getByText('https://example.com/article'),
      ).toBeInTheDocument();
    });

    it('shows site name from meta.siteName', () => {
      render(
        <LinkCard
          link={makeLink({
            meta: {
              fetchedAt: '2026-01-01T00:01:00.000Z',
              siteName: 'Example Site',
            },
          })}
          onArchiveToggle={vi.fn()}
        />,
      );

      expect(screen.getByText('Example Site')).toBeInTheDocument();
    });

    it('falls back to url hostname when meta.siteName is absent', () => {
      render(
        <LinkCard link={makeLink({ meta: null })} onArchiveToggle={vi.fn()} />,
      );

      expect(screen.getByText('example.com')).toBeInTheDocument();
    });
  });

  describe('archived state', () => {
    it('shows Mark as unread button when link is archived', () => {
      render(
        <LinkCard
          link={makeLink({ readAt: '2026-01-02T00:00:00.000Z' })}
          onArchiveToggle={vi.fn()}
        />,
      );

      expect(
        screen.getByRole('button', { name: /mark as unread/i }),
      ).toBeInTheDocument();
    });

    it('does not show Mark as unread button when link is not archived', () => {
      render(
        <LinkCard
          link={makeLink({ readAt: null })}
          onArchiveToggle={vi.fn()}
        />,
      );

      expect(
        screen.queryByRole('button', { name: /mark as unread/i }),
      ).not.toBeInTheDocument();
    });

    it('calls onArchiveToggle when Mark as unread is clicked', () => {
      const onArchiveToggle = vi.fn();
      render(
        <LinkCard
          link={makeLink({ readAt: '2026-01-02T00:00:00.000Z' })}
          onArchiveToggle={onArchiveToggle}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: /mark as unread/i }));

      expect(onArchiveToggle).toHaveBeenCalledOnce();
    });

    it('does not open the link when Mark as unread is clicked', () => {
      render(
        <LinkCard
          link={makeLink({ readAt: '2026-01-02T00:00:00.000Z' })}
          onArchiveToggle={vi.fn()}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: /mark as unread/i }));

      expect(window.open).not.toHaveBeenCalled();
    });
  });
});
