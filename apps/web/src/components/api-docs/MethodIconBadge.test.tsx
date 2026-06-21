import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import type { User } from '../../auth/AuthContext/types';

vi.mock('../../auth/AuthContext', () => ({
  useAuth: vi.fn(),
}));

import MethodIconBadge from './MethodIconBadge';
import { useAuth } from '../../auth/AuthContext';

function mockAuth(user: User | null) {
  vi.mocked(useAuth).mockReturnValue({
    user,
  } as ReturnType<typeof useAuth>);
}

const SOME_USER = { userId: 'user-1' } as User;

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('MethodIconBadge', () => {
  it('renders a decorative Font Awesome glyph per method, not text', () => {
    mockAuth(null);
    const { container } = render(<MethodIconBadge method="get" />);
    expect(container).toHaveTextContent('');
    const icon = container.querySelector('i');
    expect(icon?.className).toContain('fa-magnifying-glass');
  });

  it('hides the badge from assistive tech via aria-hidden on the span (B1)', () => {
    mockAuth(null);
    const { container } = render(<MethodIconBadge method="post" />);
    const badge = container.querySelector('span');
    expect(badge).toHaveAttribute('aria-hidden', 'true');
  });

  describe('logged out (brand)', () => {
    it('paints the brand palette color on the span so the glyph inherits it', () => {
      mockAuth(null);
      const { container } = render(<MethodIconBadge method="get" />);
      const badge = container.querySelector('span');
      expect(badge).toHaveStyle({ color: '#a7f3d0' });
    });

    it('falls back to fa-code and the neutral color for an unknown method', () => {
      mockAuth(null);
      const { container } = render(<MethodIconBadge method="trace" />);
      const badge = container.querySelector('span');
      const icon = container.querySelector('i');
      expect(icon?.className).toContain('fa-code');
      expect(badge).toHaveStyle({ color: '#eeeede' });
    });
  });

  describe('logged in (themed)', () => {
    it('paints a neutral mount treatment with no inline color', () => {
      mockAuth(SOME_USER);
      const { container } = render(<MethodIconBadge method="get" />);
      const badge = container.querySelector('span');
      const icon = container.querySelector('i');
      expect(badge).not.toHaveAttribute('style');
      expect(badge?.className).toContain('border-[var(--mount-border)]');
      expect(icon?.className).toContain('text-[var(--mount-text)]');
    });

    it('uses the same neutral border for every method', () => {
      mockAuth(SOME_USER);
      const { container: getContainer } = render(
        <MethodIconBadge method="get" />,
      );
      const { container: deleteContainer } = render(
        <MethodIconBadge method="delete" />,
      );
      const getBadge = getContainer.querySelector('span');
      const deleteBadge = deleteContainer.querySelector('span');
      expect(getBadge?.className).toBe(deleteBadge?.className);
    });
  });
});
