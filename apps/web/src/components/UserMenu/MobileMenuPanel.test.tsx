import { describe, expect, it, vi, afterEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import MobileMenuPanel from './MobileMenuPanel';
import { THEMES } from '../../theme/ThemeContext';
import type { User } from '../../auth/AuthContext';

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
  baseTheme: 'scanner-darkly' as const,
  mode: 'light' as const,
  onClose: vi.fn(),
  onLogout: vi.fn(),
  onModeToggle: vi.fn(),
  onThemeSelect: vi.fn(),
  onViewChange: vi.fn(),
};

describe('MobileMenuPanel', () => {
  it('has aria-hidden="true" when closed', () => {
    const { container } = render(
      <MobileMenuPanel {...defaultProps} isOpen={false} />,
    );
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
  });

  it('has aria-hidden="false" when open', () => {
    const { container } = render(
      <MobileMenuPanel {...defaultProps} isOpen={true} />,
    );
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'false');
  });

  it('renders the user email', () => {
    render(<MobileMenuPanel {...defaultProps} isOpen={true} />);
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
  });

  it('clicking Your links calls onViewChange with links and then onClose', () => {
    const onViewChange = vi.fn();
    const onClose = vi.fn();
    render(
      <MobileMenuPanel
        {...defaultProps}
        isOpen={true}
        onViewChange={onViewChange}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByText('Your links'));
    expect(onViewChange).toHaveBeenCalledWith('links');
    expect(onClose).toHaveBeenCalled();
  });

  it('clicking Settings calls onViewChange with settings and then onClose', () => {
    const onViewChange = vi.fn();
    const onClose = vi.fn();
    render(
      <MobileMenuPanel
        {...defaultProps}
        isOpen={true}
        onViewChange={onViewChange}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByText('Settings'));
    expect(onViewChange).toHaveBeenCalledWith('settings');
    expect(onClose).toHaveBeenCalled();
  });

  it('clicking Theme editor calls onViewChange with theme-editor and then onClose', () => {
    const onViewChange = vi.fn();
    const onClose = vi.fn();
    render(
      <MobileMenuPanel
        {...defaultProps}
        isOpen={true}
        onViewChange={onViewChange}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByText('Theme editor'));
    expect(onViewChange).toHaveBeenCalledWith('theme-editor');
    expect(onClose).toHaveBeenCalled();
  });

  it('clicking the mode toggle calls onModeToggle', () => {
    const onModeToggle = vi.fn();
    render(
      <MobileMenuPanel
        {...defaultProps}
        isOpen={true}
        onModeToggle={onModeToggle}
      />,
    );
    fireEvent.click(screen.getByText('Switch to dark mode'));
    expect(onModeToggle).toHaveBeenCalled();
  });

  it('clicking Log out calls onLogout and onClose', () => {
    const onLogout = vi.fn();
    const onClose = vi.fn();
    render(
      <MobileMenuPanel
        {...defaultProps}
        isOpen={true}
        onLogout={onLogout}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByText('Log out'));
    expect(onLogout).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('clicking a theme calls onThemeSelect with the theme id and then onClose', () => {
    const onThemeSelect = vi.fn();
    const onClose = vi.fn();
    render(
      <MobileMenuPanel
        {...defaultProps}
        isOpen={true}
        onThemeSelect={onThemeSelect}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByText(THEMES[1].label));
    expect(onThemeSelect).toHaveBeenCalledWith(THEMES[1].id);
    expect(onClose).toHaveBeenCalled();
  });
});
