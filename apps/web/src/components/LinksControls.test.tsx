import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import LinksControls from './LinksControls';

afterEach(() => vi.restoreAllMocks());

const defaultActiveProps = {
  filter: 'active' as const,
  isClearingArchived: false,
  linksCount: 5,
  randomLoading: false,
  showLinkForm: false,
  onClearArchived: vi.fn(),
  onRandom: vi.fn(),
  onToggleForm: vi.fn(),
};

describe('LinksControls', () => {
  describe('active filter', () => {
    it('shows Stumble upon and Add link buttons', () => {
      render(<LinksControls {...defaultActiveProps} />);
      expect(
        screen.getByRole('button', { name: /stumble upon/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /add link/i }),
      ).toBeInTheDocument();
    });

    it('shows Hide form when showLinkForm is true', () => {
      render(<LinksControls {...defaultActiveProps} showLinkForm={true} />);
      expect(
        screen.getByRole('button', { name: /hide form/i }),
      ).toBeInTheDocument();
    });

    it('calls onToggleForm when Add link is clicked', () => {
      const onToggleForm = vi.fn();
      render(
        <LinksControls {...defaultActiveProps} onToggleForm={onToggleForm} />,
      );
      fireEvent.click(screen.getByRole('button', { name: /add link/i }));
      expect(onToggleForm).toHaveBeenCalledOnce();
    });

    it('calls onRandom when Stumble upon is clicked', () => {
      const onRandom = vi.fn();
      render(<LinksControls {...defaultActiveProps} onRandom={onRandom} />);
      fireEvent.click(screen.getByRole('button', { name: /stumble upon/i }));
      expect(onRandom).toHaveBeenCalledOnce();
    });

    it('disables Stumble upon button while randomLoading', () => {
      render(<LinksControls {...defaultActiveProps} randomLoading={true} />);
      expect(screen.getByRole('button', { name: /stumbling/i })).toBeDisabled();
    });
  });

  describe('archived filter', () => {
    it('shows Remove all read button when links exist', () => {
      render(
        <LinksControls
          {...defaultActiveProps}
          filter="archived"
          linksCount={3}
        />,
      );
      expect(
        screen.getByRole('button', { name: /remove all read/i }),
      ).toBeInTheDocument();
    });

    it('hides Remove all read button when no links exist', () => {
      render(
        <LinksControls
          {...defaultActiveProps}
          filter="archived"
          linksCount={0}
        />,
      );
      const button = screen.getByRole('button', { name: /remove all read/i });
      expect(button).toHaveClass('opacity-0');
    });

    it('calls onClearArchived when Remove all read is clicked', () => {
      const onClearArchived = vi.fn();
      render(
        <LinksControls
          {...defaultActiveProps}
          filter="archived"
          linksCount={3}
          onClearArchived={onClearArchived}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: /remove all read/i }));
      expect(onClearArchived).toHaveBeenCalledOnce();
    });

    it('disables the button while isClearingArchived is true', () => {
      render(
        <LinksControls
          {...defaultActiveProps}
          filter="archived"
          linksCount={3}
          isClearingArchived={true}
        />,
      );
      expect(
        screen.getByRole('button', { name: /remove all read/i }),
      ).toBeDisabled();
    });
  });
});
