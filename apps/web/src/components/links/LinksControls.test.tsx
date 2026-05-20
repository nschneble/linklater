import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import LinksControls from './LinksControls';

afterEach(() => vi.restoreAllMocks());

const defaultUnreadProps = {
  filter: 'unread' as const,
  isClearingRead: false,
  linksCount: 5,
  randomLoading: false,
  showLinkForm: false,
  onClearRead: vi.fn(),
  onRandom: vi.fn(),
  onToggleForm: vi.fn(),
};

describe('LinksControls', () => {
  describe('unread filter', () => {
    it('shows Stumble!and Add link buttons', () => {
      render(<LinksControls {...defaultUnreadProps} />);
      expect(
        screen.getByRole('button', { name: /stumble!/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /add link/i }),
      ).toBeInTheDocument();
    });

    it('calls onToggleForm when Add link is clicked', () => {
      const onToggleForm = vi.fn();
      render(
        <LinksControls {...defaultUnreadProps} onToggleForm={onToggleForm} />,
      );
      fireEvent.click(screen.getByRole('button', { name: /add link/i }));
      expect(onToggleForm).toHaveBeenCalledOnce();
    });

    it('calls onRandom when Stumble! is clicked', () => {
      const onRandom = vi.fn();
      render(<LinksControls {...defaultUnreadProps} onRandom={onRandom} />);
      fireEvent.click(screen.getByRole('button', { name: /stumble!/i }));
      expect(onRandom).toHaveBeenCalledOnce();
    });

    it('disables Stumble! button while randomLoading', () => {
      render(<LinksControls {...defaultUnreadProps} randomLoading={true} />);
      expect(screen.getByRole('button', { name: /stumble!/i })).toBeDisabled();
    });
  });

  describe('read filter', () => {
    it('shows Remove all read button when links exist', () => {
      render(
        <LinksControls {...defaultUnreadProps} filter="read" linksCount={3} />,
      );
      expect(
        screen.getByRole('button', { name: /remove all read/i }),
      ).toBeInTheDocument();
    });

    it('hides Remove all read button when no links exist', () => {
      render(
        <LinksControls {...defaultUnreadProps} filter="read" linksCount={0} />,
      );
      // When hidden, the button is disabled and visually hidden but stays in
      // the accessibility tree (no aria-hidden) so AT users know it exists.
      const button = screen.getByRole('button', { name: /remove all read/i });
      expect(button).toBeDisabled();
      expect(button).toHaveClass('opacity-0');
    });

    it('calls onClearRead when Remove all read is clicked', () => {
      const onClearRead = vi.fn();
      render(
        <LinksControls
          {...defaultUnreadProps}
          filter="read"
          linksCount={3}
          onClearRead={onClearRead}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: /remove all read/i }));
      expect(onClearRead).toHaveBeenCalledOnce();
    });

    it('disables the button while isClearingRead is true', () => {
      render(
        <LinksControls
          {...defaultUnreadProps}
          filter="read"
          linksCount={3}
          isClearingRead={true}
        />,
      );
      expect(
        screen.getByRole('button', { name: /remove all read/i }),
      ).toBeDisabled();
    });
  });

  describe('Add link / Hide form button', () => {
    it('has aria-expanded=false when form is closed', () => {
      render(<LinksControls {...defaultUnreadProps} showLinkForm={false} />);
      const button = screen.getByRole('button', { name: /add link/i });
      expect(button).toHaveAttribute('aria-expanded', 'false');
    });

    it('has aria-expanded=true when form is open', () => {
      render(<LinksControls {...defaultUnreadProps} showLinkForm={true} />);
      const button = screen.getByRole('button', { name: /add link/i });
      expect(button).toHaveAttribute('aria-expanded', 'true');
    });
  });

  describe('Stumble! button', () => {
    it('is hidden on the read filter', () => {
      render(
        <LinksControls {...defaultUnreadProps} filter="read" linksCount={3} />,
      );
      // Hidden buttons are disabled and visually hidden, but remain in the
      // accessibility tree (no aria-hidden).
      const button = screen.getByRole('button', { name: /stumble!/i });
      expect(button).toBeDisabled();
      expect(button).toHaveClass('opacity-0');
    });
  });
});
