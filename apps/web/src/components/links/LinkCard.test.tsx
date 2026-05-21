import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import LinkCard from './LinkCard';
import type { Link } from '../../lib/api';

vi.mock('../../theme/ThemeContext', () => ({
  useTheme: () => ({ baseTheme: 'scanner-darkly' }),
}));

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
      render(<LinkCard link={makeLink()} onReadToggle={vi.fn()} />);

      fireEvent.click(screen.getByRole('link'));

      expect(window.open).toHaveBeenCalledWith(
        'https://example.com/article',
        '_blank',
        'noreferrer',
      );
    });

    it('calls onReadToggle when link is not read', () => {
      const onReadToggle = vi.fn();
      render(
        <LinkCard
          link={makeLink({ readAt: null })}
          onReadToggle={onReadToggle}
        />,
      );

      fireEvent.click(screen.getByRole('link'));

      expect(onReadToggle).toHaveBeenCalledOnce();
    });

    it('does not call onReadToggle when link is already read', () => {
      const onReadToggle = vi.fn();
      render(
        <LinkCard
          link={makeLink({ readAt: '2026-01-02T00:00:00.000Z' })}
          onReadToggle={onReadToggle}
        />,
      );

      fireEvent.click(screen.getByRole('link'));

      expect(onReadToggle).not.toHaveBeenCalled();
    });
  });

  describe('metadata loading state', () => {
    it('shows a pulsing dot when meta is null', () => {
      const { container } = render(
        <LinkCard link={makeLink({ meta: null })} onReadToggle={vi.fn()} />,
      );

      expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
    });

    it('does not show a pulsing dot when meta.fetchedAt is set', () => {
      const { container } = render(
        <LinkCard
          link={makeLink({ meta: { fetchedAt: '2026-01-01T00:01:00.000Z' } })}
          onReadToggle={vi.fn()}
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
          onReadToggle={vi.fn()}
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
          onReadToggle={vi.fn()}
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
          onReadToggle={vi.fn()}
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
          onReadToggle={vi.fn()}
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
          onReadToggle={vi.fn()}
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
          onReadToggle={vi.fn()}
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
          onReadToggle={vi.fn()}
        />,
      );

      expect(screen.getByText('Example Site')).toBeInTheDocument();
    });

    it('falls back to url hostname when meta.siteName is absent', () => {
      render(
        <LinkCard link={makeLink({ meta: null })} onReadToggle={vi.fn()} />,
      );

      expect(screen.getByText('example.com')).toBeInTheDocument();
    });
  });

  describe('aria-label', () => {
    it('has aria-label "title — site, opens in new tab" when meta is fully loaded', () => {
      render(
        <LinkCard
          link={makeLink({
            url: 'https://example.com/article',
            meta: {
              fetchedAt: '2026-01-01T00:01:00.000Z',
              title: 'Example Article',
              siteName: 'Example Site',
              faviconUrl: null,
              description: null,
              imageUrl: null,
            },
          })}
          onReadToggle={vi.fn()}
        />,
      );

      expect(screen.getByRole('link')).toHaveAttribute(
        'aria-label',
        'Example Article — Example Site, opens in new tab',
      );
    });

    it('falls back to hostname in aria-label when siteName is absent', () => {
      render(
        <LinkCard
          link={makeLink({
            url: 'https://www.example.com/article',
            meta: {
              fetchedAt: '2026-01-01T00:01:00.000Z',
              title: 'Some Post',
              siteName: null,
              faviconUrl: null,
              description: null,
              imageUrl: null,
            },
          })}
          onReadToggle={vi.fn()}
        />,
      );

      // www. is stripped from the hostname
      expect(screen.getByRole('link')).toHaveAttribute(
        'aria-label',
        'Some Post — example.com, opens in new tab',
      );
    });

    it('uses "(No title)" in aria-label when meta.title is absent', () => {
      render(
        <LinkCard
          link={makeLink({
            url: 'https://example.com/article',
            meta: {
              fetchedAt: '2026-01-01T00:01:00.000Z',
              title: null,
              siteName: 'Example Site',
              faviconUrl: null,
              description: null,
              imageUrl: null,
            },
          })}
          onReadToggle={vi.fn()}
        />,
      );

      expect(screen.getByRole('link')).toHaveAttribute(
        'aria-label',
        '(No title) — Example Site, opens in new tab',
      );
    });
  });

  describe('read state', () => {
    it('shows Mark as unread button when link is read', () => {
      render(
        <LinkCard
          link={makeLink({ readAt: '2026-01-02T00:00:00.000Z' })}
          onReadToggle={vi.fn()}
        />,
      );

      expect(
        screen.getByRole('button', { name: /mark unread/i }),
      ).toBeInTheDocument();
    });

    it('does not show Mark as unread button when link is not read', () => {
      render(
        <LinkCard link={makeLink({ readAt: null })} onReadToggle={vi.fn()} />,
      );

      expect(
        screen.queryByRole('button', { name: /mark unread/i }),
      ).not.toBeInTheDocument();
    });

    it('calls onReadToggle when Mark as unread is clicked', () => {
      const onReadToggle = vi.fn();
      render(
        <LinkCard
          link={makeLink({ readAt: '2026-01-02T00:00:00.000Z' })}
          onReadToggle={onReadToggle}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: /mark unread/i }));

      expect(onReadToggle).toHaveBeenCalledOnce();
    });

    it('does not open the link when Mark as unread is clicked', () => {
      render(
        <LinkCard
          link={makeLink({ readAt: '2026-01-02T00:00:00.000Z' })}
          onReadToggle={vi.fn()}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: /mark unread/i }));

      expect(window.open).not.toHaveBeenCalled();
    });
  });
});
