import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import LinksMobileControls from './LinksMobileControls';

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

describe('LinksMobileControls', () => {
  describe('unread filter', () => {
    it('shows the shuffle and add link buttons', () => {
      render(<LinksMobileControls {...defaultUnreadProps} />);
      expect(
        screen.getByRole('button', { name: 'Stumble!' }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Add link' }),
      ).toBeInTheDocument();
    });

    it('calls onRandom when the shuffle button is clicked', () => {
      const onRandom = vi.fn();
      render(
        <LinksMobileControls {...defaultUnreadProps} onRandom={onRandom} />,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Stumble!' }));
      expect(onRandom).toHaveBeenCalledOnce();
    });

    it('calls onToggleForm when the add link button is clicked', () => {
      const onToggleForm = vi.fn();
      render(
        <LinksMobileControls
          {...defaultUnreadProps}
          onToggleForm={onToggleForm}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Add link' }));
      expect(onToggleForm).toHaveBeenCalledOnce();
    });

    it('disables the shuffle button while randomLoading', () => {
      render(
        <LinksMobileControls {...defaultUnreadProps} randomLoading={true} />,
      );
      expect(screen.getByRole('button', { name: 'Stumble!' })).toBeDisabled();
    });

    it('sets aria-label to "Hide form" when showLinkForm is true', () => {
      render(
        <LinksMobileControls {...defaultUnreadProps} showLinkForm={true} />,
      );
      expect(
        screen.getByRole('button', { name: 'Hide form' }),
      ).toBeInTheDocument();
    });

    it('sets aria-expanded=true on the toggle button when showLinkForm is true', () => {
      render(
        <LinksMobileControls {...defaultUnreadProps} showLinkForm={true} />,
      );
      expect(screen.getByRole('button', { name: 'Hide form' })).toHaveAttribute(
        'aria-expanded',
        'true',
      );
    });

    it('sets aria-expanded=false on the toggle button when showLinkForm is false', () => {
      render(
        <LinksMobileControls {...defaultUnreadProps} showLinkForm={false} />,
      );
      expect(screen.getByRole('button', { name: 'Add link' })).toHaveAttribute(
        'aria-expanded',
        'false',
      );
    });
  });

  describe('read filter', () => {
    it('shows the trash button when links exist', () => {
      render(
        <LinksMobileControls
          {...defaultUnreadProps}
          filter="read"
          linksCount={3}
        />,
      );
      expect(
        screen.getByRole('button', { name: 'Remove all read links' }),
      ).toBeInTheDocument();
    });

    it('does not show the trash button when no links exist', () => {
      render(
        <LinksMobileControls
          {...defaultUnreadProps}
          filter="read"
          linksCount={0}
        />,
      );
      expect(
        screen.queryByRole('button', { name: 'Remove all read links' }),
      ).toBeNull();
    });

    it('calls onClearRead when the trash button is clicked', () => {
      const onClearRead = vi.fn();
      render(
        <LinksMobileControls
          {...defaultUnreadProps}
          filter="read"
          linksCount={3}
          onClearRead={onClearRead}
        />,
      );
      fireEvent.click(
        screen.getByRole('button', { name: 'Remove all read links' }),
      );
      expect(onClearRead).toHaveBeenCalledOnce();
    });

    it('disables the trash button while isClearingRead is true', () => {
      render(
        <LinksMobileControls
          {...defaultUnreadProps}
          filter="read"
          linksCount={3}
          isClearingRead={true}
        />,
      );
      expect(
        screen.getByRole('button', { name: 'Remove all read links' }),
      ).toBeDisabled();
    });
  });
});
