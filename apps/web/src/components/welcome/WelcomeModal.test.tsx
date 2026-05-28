import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import WelcomeModal from './WelcomeModal';

const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual =
    await vi.importActual<typeof import('react-router-dom')>(
      'react-router-dom',
    );
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

beforeEach(() => {
  navigateMock.mockReset();
  vi.clearAllMocks();
});
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
    expect(
      screen.getByText(/two features worth knowing before you dive in/i),
    ).toBeInTheDocument();
  });

  it('surfaces the bookmarklet feature with a deep-link button', () => {
    renderModal();

    expect(
      screen.getByText(/drag it to your bookmarks bar/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /get the bookmarklet/i }),
    ).toBeInTheDocument();
  });

  it('surfaces the stumble feature with a deep-link button', () => {
    renderModal();

    expect(
      screen.getByText(/random unread link from your collection/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /try stumble/i }),
    ).toBeInTheDocument();
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
    expect(description?.textContent).toMatch(
      /two features worth knowing before you dive in/i,
    );
  });

  it('calls onClose when the close button is clicked', () => {
    const { onClose } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: /close welcome/i }));
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

  it('closes the modal and navigates to the bookmarklet section when the bookmarklet button is clicked', () => {
    const { onClose } = renderModal();
    fireEvent.click(
      screen.getByRole('button', { name: /get the bookmarklet/i }),
    );
    expect(onClose).toHaveBeenCalledOnce();
    expect(navigateMock).toHaveBeenCalledWith('/settings/bookmarklet');
  });

  it('closes the modal and navigates to the stumble page when the stumble button is clicked', () => {
    const { onClose } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: /try stumble/i }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(navigateMock).toHaveBeenCalledWith('/stumble');
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
