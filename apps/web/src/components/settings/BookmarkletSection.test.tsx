import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import BookmarkletSection from './BookmarkletSection';

vi.mock('../../lib/api', () => ({
  getStoredToken: vi.fn().mockReturnValue('fake-jwt'),
}));

describe('BookmarkletSection', () => {
  it('renders the section heading', () => {
    render(<BookmarkletSection />);
    expect(
      screen.getByRole('heading', { name: /bookmarklet/i }),
    ).toBeInTheDocument();
  });

  it('renders the bookmarklet link with draggable="true"', () => {
    render(<BookmarkletSection />);
    const link = screen.getByRole('link', {
      name: /drag this bookmarklet to your bookmarks bar/i,
    });
    expect(link).toHaveAttribute('draggable', 'true');
  });

  it('bookmarklet link has a descriptive aria-label mentioning drag', () => {
    render(<BookmarkletSection />);
    const link = screen.getByRole('link', {
      name: /drag this bookmarklet to your bookmarks bar/i,
    });
    expect(link.getAttribute('aria-label')).toMatch(
      /drag this bookmarklet to your bookmarks bar/i,
    );
  });

  it('bookmarklet link text is "Save to Linklater"', () => {
    render(<BookmarkletSection />);
    expect(screen.getByText('Save to Linklater')).toBeInTheDocument();
  });
});
