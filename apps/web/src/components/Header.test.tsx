import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import Header from './Header';
import { ThemeProvider } from '../theme/ThemeContext';
import type { AppView } from '../lib/navigation';
import type { User } from '../auth/AuthContext';

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
  multiFactorMethod: null,
  multiFactorPending: false,
  userId: '1',
};

const defaultProps = {
  user: mockUser,
  view: 'links' as AppView,
  isUserMenuOpen: false,
  onUserMenuToggle: vi.fn(),
  onUserMenuClose: vi.fn(),
  onLogout: vi.fn(),
  onModeToggle: vi.fn(),
  onThemeSelect: vi.fn(),
  onViewChange: vi.fn(),
};

function renderHeader(props = defaultProps) {
  return render(
    <ThemeProvider>
      <Header {...props} />
    </ThemeProvider>,
  );
}

describe('Header', () => {
  it('renders the logo and avatar button', () => {
    renderHeader();
    expect(screen.getByLabelText('Go to your links')).toBeInTheDocument();
    expect(
      screen.getByLabelText(`User menu (${mockUser.email})`),
    ).toBeInTheDocument();
  });

  it('clicking the logo button calls onViewChange with links', () => {
    const onViewChange = vi.fn();
    renderHeader({ ...defaultProps, onViewChange });
    fireEvent.click(screen.getByLabelText('Go to your links'));
    expect(onViewChange).toHaveBeenCalledWith('links');
  });

  it('avatar button reflects isUserMenuOpen=false via aria-expanded', () => {
    renderHeader({ ...defaultProps, isUserMenuOpen: false });
    expect(
      screen.getByLabelText(`User menu (${mockUser.email})`),
    ).toHaveAttribute('aria-expanded', 'false');
  });

  it('avatar button reflects isUserMenuOpen=true via aria-expanded', () => {
    renderHeader({ ...defaultProps, isUserMenuOpen: true });
    expect(
      screen.getByLabelText(`User menu (${mockUser.email})`),
    ).toHaveAttribute('aria-expanded', 'true');
  });

  it('clicking the avatar button calls onUserMenuToggle', () => {
    const onUserMenuToggle = vi.fn();
    renderHeader({ ...defaultProps, onUserMenuToggle });
    fireEvent.click(screen.getByLabelText(`User menu (${mockUser.email})`));
    expect(onUserMenuToggle).toHaveBeenCalledOnce();
  });

  it('clicking outside the header calls onUserMenuClose when menu is open', () => {
    const onUserMenuClose = vi.fn();
    renderHeader({ ...defaultProps, isUserMenuOpen: true, onUserMenuClose });
    fireEvent.mouseDown(document.body);
    expect(onUserMenuClose).toHaveBeenCalledOnce();
  });

  it('pressing Escape calls onUserMenuClose when menu is open', () => {
    const onUserMenuClose = vi.fn();
    renderHeader({ ...defaultProps, isUserMenuOpen: true, onUserMenuClose });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onUserMenuClose).toHaveBeenCalledOnce();
  });

  it('touchstart outside the header calls onUserMenuClose when menu is open', () => {
    const onUserMenuClose = vi.fn();
    renderHeader({ ...defaultProps, isUserMenuOpen: true, onUserMenuClose });
    fireEvent.touchStart(document.body);
    expect(onUserMenuClose).toHaveBeenCalledOnce();
  });

  it('clicking the avatar button does not call onUserMenuClose', () => {
    const onUserMenuClose = vi.fn();
    renderHeader({ ...defaultProps, isUserMenuOpen: true, onUserMenuClose });
    fireEvent.mouseDown(screen.getByLabelText(`User menu (${mockUser.email})`));
    expect(onUserMenuClose).not.toHaveBeenCalled();
  });

  it('clicking the logo within the header calls onUserMenuClose when menu is open', () => {
    const onUserMenuClose = vi.fn();
    renderHeader({ ...defaultProps, isUserMenuOpen: true, onUserMenuClose });
    fireEvent.mouseDown(screen.getByLabelText('Go to your links'));
    expect(onUserMenuClose).toHaveBeenCalledOnce();
  });
});
