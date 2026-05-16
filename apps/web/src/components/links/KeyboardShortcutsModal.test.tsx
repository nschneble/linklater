import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import KeyboardShortcutsModal from './KeyboardShortcutsModal';

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.restoreAllMocks());

describe('KeyboardShortcutsModal', () => {
  it('renders all keyboard shortcuts', () => {
    render(<KeyboardShortcutsModal onClose={vi.fn()} />);

    expect(screen.getByText('Navigate links / user menu')).toBeInTheDocument();
    expect(screen.getByText('Switch tabs')).toBeInTheDocument();
    expect(screen.getByText('Open link / menu item')).toBeInTheDocument();
    expect(screen.getByText('Show unread links')).toBeInTheDocument();
    expect(screen.getByText('Show read links')).toBeInTheDocument();
    expect(screen.getByText('Search')).toBeInTheDocument();
    expect(screen.getByText('Add link')).toBeInTheDocument();
    expect(screen.getByText('Stumble!')).toBeInTheDocument();
    expect(screen.getByText('Show shortcuts')).toBeInTheDocument();
    expect(screen.getByText('Show user menu')).toBeInTheDocument();
  });

  it('has dialog role with accessible label', () => {
    render(<KeyboardShortcutsModal onClose={vi.fn()} />);
    expect(
      screen.getByRole('dialog', { name: /keyboard shortcuts/i }),
    ).toBeInTheDocument();
  });

  it('calls onClose when Escape key is pressed', () => {
    const onClose = vi.fn();
    render(<KeyboardShortcutsModal onClose={onClose} />);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when the backdrop is clicked', () => {
    const onClose = vi.fn();
    render(<KeyboardShortcutsModal onClose={onClose} />);

    // The backdrop is an aria-hidden div — query it via its test id
    fireEvent.click(screen.getByTestId('modal-backdrop'));

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    render(<KeyboardShortcutsModal onClose={onClose} />);

    fireEvent.click(screen.getByLabelText('Close keyboard shortcuts'));

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('Tab key wraps focus from last element back to first', () => {
    render(<KeyboardShortcutsModal onClose={vi.fn()} />);

    // Focus the close button (last/only focusable element) then press Tab
    const closeButton = screen.getByLabelText('Close keyboard shortcuts');
    closeButton.focus();

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: false });

    // Focus should cycle back to the close button itself (only focusable element)
    expect(document.activeElement).toBe(closeButton);
  });

  it('Shift+Tab wraps focus from first element back to last', () => {
    render(<KeyboardShortcutsModal onClose={vi.fn()} />);

    const closeButton = screen.getByLabelText('Close keyboard shortcuts');
    closeButton.focus();

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });

    expect(document.activeElement).toBe(closeButton);
  });

  it('does not call onClose for non-Escape, non-Tab keydowns', () => {
    const onClose = vi.fn();
    render(<KeyboardShortcutsModal onClose={onClose} />);

    fireEvent.keyDown(document, { key: 'Enter' });

    expect(onClose).not.toHaveBeenCalled();
  });

  it('renders with aria-modal="true"', () => {
    render(<KeyboardShortcutsModal onClose={vi.fn()} />);
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
  });
});
