import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '../../theme/ThemeContext';
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

  it('selecting a theme from the submenu calls onThemeSelect and closes the menu', () => {
    const onThemeSelect = vi.fn();
    const onClose = vi.fn();
    renderMenu({ ...defaultProps, isOpen: true, onThemeSelect, onClose });
    fireEvent.click(screen.getByText('Boyhood'));
    expect(onThemeSelect).toHaveBeenCalledWith('boyhood');
    expect(onClose).toHaveBeenCalled();
  });

  it('clicking Theme editor calls onViewChange with theme-editor and closes the menu', () => {
    const onViewChange = vi.fn();
    const onClose = vi.fn();
    renderMenu({ ...defaultProps, isOpen: true, onViewChange, onClose });
    fireEvent.click(screen.getByText('Theme editor'));
    expect(onViewChange).toHaveBeenCalledWith('theme-editor');
    expect(onClose).toHaveBeenCalled();
  });
});
