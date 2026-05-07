import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import KeyboardShortcutsModal from './KeyboardShortcutsModal';

afterEach(() => vi.restoreAllMocks());

describe('KeyboardShortcutsModal', () => {
  it('renders all keyboard shortcuts', () => {
    render(<KeyboardShortcutsModal onClose={vi.fn()} />);

    expect(screen.getByText('Show unread links')).toBeInTheDocument();
    expect(screen.getByText('Show read links')).toBeInTheDocument();
    expect(screen.getByText('Search')).toBeInTheDocument();
    expect(screen.getByText('Add link')).toBeInTheDocument();
    expect(screen.getByText('Stumble upon')).toBeInTheDocument();
    expect(screen.getByText('Show shortcuts')).toBeInTheDocument();
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
});
