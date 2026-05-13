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
    it('shows Stumble upon and Add link buttons', () => {
      render(<LinksControls {...defaultUnreadProps} />);
      expect(
        screen.getByRole('button', { name: /stumble upon/i }),
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

    it('calls onRandom when Stumble upon is clicked', () => {
      const onRandom = vi.fn();
      render(<LinksControls {...defaultUnreadProps} onRandom={onRandom} />);
      fireEvent.click(screen.getByRole('button', { name: /stumble upon/i }));
      expect(onRandom).toHaveBeenCalledOnce();
    });

    it('disables Stumble upon button while randomLoading', () => {
      render(<LinksControls {...defaultUnreadProps} randomLoading={true} />);
      expect(
        screen.getByRole('button', { name: /stumble upon/i }),
      ).toBeDisabled();
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
      const { container } = render(
        <LinksControls {...defaultUnreadProps} filter="read" linksCount={0} />,
      );
      // When hidden, the button is removed from the accessibility tree via
      // aria-hidden="true", so getByRole cannot find it. Query the DOM
      // directly to assert the visual hidden state.
      expect(
        screen.queryByRole('button', { name: /remove all read/i }),
      ).toBeNull();
      const button = container.querySelector('button[aria-hidden="true"]');
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

  describe('Stumble upon button', () => {
    it('shows Stumbling… label while randomLoading is true', () => {
      render(<LinksControls {...defaultUnreadProps} randomLoading={true} />);
      expect(
        screen.getByRole('button', { name: /stumble upon/i }),
      ).toBeInTheDocument();
    });

    it('is hidden on the read filter', () => {
      render(
        <LinksControls {...defaultUnreadProps} filter="read" linksCount={3} />,
      );
      // Hidden buttons are removed from the accessibility tree via aria-hidden
      expect(
        screen.queryByRole('button', { name: /stumble upon/i }),
      ).toBeNull();
    });
  });
});
