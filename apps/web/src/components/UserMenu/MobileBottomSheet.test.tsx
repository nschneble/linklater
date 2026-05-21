import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import MobileBottomSheet from './MobileBottomSheet';
import { THEMES } from '../../theme/ThemeContext';
import type { User } from '../../auth/AuthContext';

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.restoreAllMocks());

const mockUser: User = {
  cvdMode: false,
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

describe('MobileBottomSheet', () => {
  it('sheet is inert when closed', () => {
    render(<MobileBottomSheet {...defaultProps} isOpen={false} />);
    const sheet = document.querySelector('[role="dialog"]');
    expect(sheet).toHaveAttribute('inert');
  });

  it('sheet is not inert when open', () => {
    render(<MobileBottomSheet {...defaultProps} isOpen={true} />);
    const sheet = screen.getByRole('dialog');
    expect(sheet).not.toHaveAttribute('inert');
  });

  it('renders the user email', () => {
    render(<MobileBottomSheet {...defaultProps} isOpen={true} />);
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
  });

  it('clicking Your links calls onViewChange with links and then onClose', () => {
    const onViewChange = vi.fn();
    const onClose = vi.fn();
    render(
      <MobileBottomSheet
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
      <MobileBottomSheet
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
      <MobileBottomSheet
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
      <MobileBottomSheet
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
      <MobileBottomSheet
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

  it('clicking a theme calls onThemeSelect with the theme id', () => {
    const onThemeSelect = vi.fn();
    const onClose = vi.fn();
    render(
      <MobileBottomSheet
        {...defaultProps}
        isOpen={true}
        onThemeSelect={onThemeSelect}
        onClose={onClose}
      />,
    );
    // Use a theme that is not the active theme (scanner-darkly) so there
    // is only one element with that label text in the DOM.
    const nonActiveTheme = THEMES.find(
      (theme) => theme.id !== defaultProps.baseTheme,
    )!;
    fireEvent.click(screen.getByText('Theme').closest('button')!);
    fireEvent.click(screen.getByText(nonActiveTheme.label));
    expect(onThemeSelect).toHaveBeenCalledWith(nonActiveTheme.id);
  });

  it('clicking the scrim calls onClose', () => {
    const onClose = vi.fn();
    render(
      <MobileBottomSheet {...defaultProps} isOpen={true} onClose={onClose} />,
    );
    const scrim = document.querySelector('[aria-hidden="true"]');
    fireEvent.click(scrim!);
    expect(onClose).toHaveBeenCalled();
  });
});
