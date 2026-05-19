import { describe, expect, it, vi, afterEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import Header from './Header';
import { ThemeProvider } from '../theme/ThemeContext';
import type { AppView } from '../lib/navigation';
import type { User } from '../auth/AuthContext';

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
  view: 'links' as AppView,
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
    expect(screen.getByLabelText('User menu')).toBeInTheDocument();
  });

  it('clicking the logo button calls onViewChange with links', () => {
    const onViewChange = vi.fn();
    renderHeader({ ...defaultProps, onViewChange });
    fireEvent.click(screen.getByLabelText('Go to your links'));
    expect(onViewChange).toHaveBeenCalledWith('links');
  });

  it('clicking the avatar button sets aria-expanded to true', () => {
    renderHeader();
    const avatarButton = screen.getByLabelText('User menu');
    expect(avatarButton).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(avatarButton);
    expect(avatarButton).toHaveAttribute('aria-expanded', 'true');
  });

  it('clicking outside the header closes the menu', () => {
    renderHeader();
    const avatarButton = screen.getByLabelText('User menu');
    fireEvent.click(avatarButton);
    expect(avatarButton).toHaveAttribute('aria-expanded', 'true');
    fireEvent.mouseDown(document.body);
    expect(avatarButton).toHaveAttribute('aria-expanded', 'false');
  });

  it('pressing Escape closes the menu', () => {
    renderHeader();
    const avatarButton = screen.getByLabelText('User menu');
    fireEvent.click(avatarButton);
    expect(avatarButton).toHaveAttribute('aria-expanded', 'true');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(avatarButton).toHaveAttribute('aria-expanded', 'false');
  });
});
