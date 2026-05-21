import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import WelcomeModal from './WelcomeModal';

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.restoreAllMocks());

function renderModal(onClose = vi.fn()) {
  return {
    onClose,
    ...render(
      <MemoryRouter>
        <WelcomeModal onClose={onClose} />
      </MemoryRouter>,
    ),
  };
}

describe('WelcomeModal', () => {
  it('renders the welcome heading and overview paragraph', () => {
    renderModal();

    expect(
      screen.getByRole('heading', { name: /welcome to linklater/i, level: 2 }),
    ).toBeInTheDocument();
    expect(screen.getByText(/your read-it-later home/i)).toBeInTheDocument();
  });

  it('surfaces the bookmarklet feature with a settings link', () => {
    renderModal();

    expect(
      screen.getByText(/drag the bookmarklet to your bookmarks bar/i),
    ).toBeInTheDocument();
    const settingsLink = screen.getByRole('link', {
      name: /open settings to grab the bookmarklet/i,
    });
    expect(settingsLink).toHaveAttribute('href', '/settings#bookmarklet');
  });

  it('surfaces the stumble feature with a D keyboard shortcut hint', () => {
    renderModal();

    expect(
      screen.getByText(/jump to a random unread link/i),
    ).toBeInTheDocument();
    // The shortcut is wrapped in <kbd> for semantic clarity.
    const kbd = screen.getByText('D', { selector: 'kbd' });
    expect(kbd).toBeInTheDocument();
  });

  it('exposes the dialog with aria-modal and aria-describedby pointing at the overview', () => {
    renderModal();

    const dialog = screen.getByRole('dialog', {
      name: /welcome to linklater/i,
    });
    expect(dialog).toHaveAttribute('aria-modal', 'true');

    const describedById = dialog.getAttribute('aria-describedby');
    expect(describedById).not.toBeNull();
    const description = document.getElementById(describedById!);
    expect(description?.textContent).toMatch(/your read-it-later home/i);
  });

  it('calls onClose when the "Got it" button is clicked', () => {
    const { onClose } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: /got it/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when Escape is pressed', () => {
    const { onClose } = renderModal();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when the backdrop is clicked', () => {
    const { onClose } = renderModal();
    fireEvent.click(screen.getByTestId('modal-backdrop'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when the bookmarklet link is clicked so the welcome flag still fires on navigate-away', () => {
    const { onClose } = renderModal();
    fireEvent.click(
      screen.getByRole('link', {
        name: /open settings to grab the bookmarklet/i,
      }),
    );
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('moves initial focus to the heading so the first Tab lands on an action', () => {
    renderModal();
    const heading = screen.getByRole('heading', {
      name: /welcome to linklater/i,
    });
    expect(document.activeElement).toBe(heading);
  });

  it('locks body scroll while mounted and restores it on unmount', () => {
    const initialOverflow = document.body.style.overflow;
    const { unmount } = renderModal();
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe(initialOverflow);
  });
});
