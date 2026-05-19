import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRef } from 'react';
import { ThemeProvider } from '../../theme/ThemeContext';
import { useMenuNavigation } from './useMenuNavigation';
import UserMenu from './index';
import type { User } from '../../auth/AuthContext';

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.restoreAllMocks());

const mockUser: User = {
  connectedProviders: [],
  email: 'test@example.com',
  emailVerifiedAt: null,
  hasPassword: true,
  mode: 'light',
  pendingEmail: null,
  theme: 'scanner-darkly',
  twoFactorMethod: null,
  twoFactorPending: false,
  userId: '1',
};

const defaultProps = {
  user: mockUser,
  view: 'links' as const,
  isOpen: false,
  onToggle: vi.fn(),
  onClose: vi.fn(),
  onLogout: vi.fn(),
  onModeToggle: vi.fn(),
  onThemeSelect: vi.fn(),
  onViewChange: vi.fn(),
};

function renderMenu(props = defaultProps) {
  return render(
    <ThemeProvider>
      <UserMenu {...props} />
    </ThemeProvider>,
  );
}

describe('UserMenu', () => {
  it('renders avatar button with aria-label containing the user email', () => {
    renderMenu();
    expect(
      screen.getByLabelText(`User menu (${mockUser.email})`),
    ).toBeInTheDocument();
  });

  it('avatar button has aria-expanded false when menu is closed', () => {
    renderMenu({ ...defaultProps, isOpen: false });
    expect(
      screen.getByLabelText(`User menu (${mockUser.email})`),
    ).toHaveAttribute('aria-expanded', 'false');
  });

  it('avatar button has aria-expanded true when menu is open', () => {
    renderMenu({ ...defaultProps, isOpen: true });
    expect(
      screen.getByLabelText(`User menu (${mockUser.email})`),
    ).toHaveAttribute('aria-expanded', 'true');
  });

  it('clicking the avatar button calls onToggle', () => {
    const onToggle = vi.fn();
    renderMenu({ ...defaultProps, onToggle });
    fireEvent.click(screen.getByLabelText(`User menu (${mockUser.email})`));
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it('menu div has aria-hidden true when closed', () => {
    const { container } = renderMenu({ ...defaultProps, isOpen: false });
    const menu = container.querySelector('[role="menu"]');
    expect(menu).toHaveAttribute('aria-hidden', 'true');
  });

  it('menu div has aria-hidden false when open', () => {
    const { container } = renderMenu({ ...defaultProps, isOpen: true });
    const menu = container.querySelector('[role="menu"]');
    expect(menu).toHaveAttribute('aria-hidden', 'false');
  });

  it('displays the user email in the menu', () => {
    renderMenu({ ...defaultProps, isOpen: true });
    expect(screen.getByText(mockUser.email)).toBeInTheDocument();
  });

  it('clicking Your links calls onViewChange with links and then onClose', () => {
    const onViewChange = vi.fn();
    const onClose = vi.fn();
    renderMenu({ ...defaultProps, isOpen: true, onViewChange, onClose });
    fireEvent.click(screen.getByText('Your links'));
    expect(onViewChange).toHaveBeenCalledWith('links');
    expect(onClose).toHaveBeenCalled();
  });

  it('clicking Settings calls onViewChange with settings and then onClose', () => {
    const onViewChange = vi.fn();
    const onClose = vi.fn();
    renderMenu({ ...defaultProps, isOpen: true, onViewChange, onClose });
    fireEvent.click(screen.getByText('Settings'));
    expect(onViewChange).toHaveBeenCalledWith('settings');
    expect(onClose).toHaveBeenCalled();
  });

  it('shows a mode toggle button in the menu', () => {
    renderMenu({ ...defaultProps, isOpen: true });
    const modeButton = screen.getByText(/Switch to (dark|light) mode/);
    expect(modeButton).toBeInTheDocument();
  });

  it('clicking the mode toggle calls onModeToggle', () => {
    const onModeToggle = vi.fn();
    renderMenu({ ...defaultProps, isOpen: true, onModeToggle });
    fireEvent.click(screen.getByText(/Switch to (dark|light) mode/));
    expect(onModeToggle).toHaveBeenCalledOnce();
  });

  it('clicking Log out calls onLogout and onClose', () => {
    const onLogout = vi.fn();
    const onClose = vi.fn();
    renderMenu({ ...defaultProps, isOpen: true, onLogout, onClose });
    fireEvent.click(screen.getByText('Log out'));
    expect(onLogout).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });
});

function FakeMenu({ onClose }: { onClose: () => void }) {
  const menuReference = useRef<HTMLDivElement>(null);
  useMenuNavigation(menuReference, onClose);

  return (
    <div ref={menuReference} role="menu">
      <button type="button" role="menuitem">
        First
      </button>
      <button type="button" role="menuitem">
        Second
      </button>
      <button type="button" role="menuitem">
        Third
      </button>
    </div>
  );
}

describe('useMenuNavigation', () => {
  it('ArrowDown moves focus to next item', () => {
    render(<FakeMenu onClose={vi.fn()} />);
    const [first, second] = screen.getAllByRole('menuitem');
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(second);
  });

  it('ArrowUp moves focus to previous item', () => {
    render(<FakeMenu onClose={vi.fn()} />);
    const [first, second] = screen.getAllByRole('menuitem');
    second.focus();
    fireEvent.keyDown(second, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(first);
  });

  it('ArrowDown on last item wraps to first', () => {
    render(<FakeMenu onClose={vi.fn()} />);
    const items = screen.getAllByRole('menuitem');
    const last = items[items.length - 1];
    last.focus();
    fireEvent.keyDown(last, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(items[0]);
  });

  it('ArrowUp on first item wraps to last', () => {
    render(<FakeMenu onClose={vi.fn()} />);
    const items = screen.getAllByRole('menuitem');
    items[0].focus();
    fireEvent.keyDown(items[0], { key: 'ArrowUp' });
    expect(document.activeElement).toBe(items[items.length - 1]);
  });

  it('Escape calls onClose', () => {
    const onClose = vi.fn();
    render(<FakeMenu onClose={onClose} />);
    const [first] = screen.getAllByRole('menuitem');
    first.focus();
    fireEvent.keyDown(first, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
