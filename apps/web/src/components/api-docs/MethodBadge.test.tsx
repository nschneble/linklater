import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import type { User } from '../../auth/AuthContext/types';

// ─── Module mocks (must precede import of MethodBadge) ────────────────────────

vi.mock('../../auth/AuthContext', () => ({
  useAuth: vi.fn(),
}));

// ─── Imports after mocks ──────────────────────────────────────────────────────

import MethodBadge from './MethodBadge';
import { useAuth } from '../../auth/AuthContext';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Point `useAuth` at a logged-out (brand) or logged-in (themed) state. */
function mockAuth(user: User | null) {
  vi.mocked(useAuth).mockReturnValue({
    user,
  } as ReturnType<typeof useAuth>);
}

/** Minimal logged-in user — only the presence (non-null) matters here. */
const SOME_USER = { userId: 'user-1' } as User;

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('MethodBadge', () => {
  it('renders the method as real, uppercased text', () => {
    mockAuth(null);
    const { container } = render(<MethodBadge method="get" />);
    expect(container).toHaveTextContent('GET');
  });

  it('marks the badge aria-hidden so the method is not double-announced (B1)', () => {
    mockAuth(null);
    const { container } = render(<MethodBadge method="post" />);
    const badge = container.querySelector('span');
    expect(badge).toHaveAttribute('aria-hidden', 'true');
  });

  describe('logged out (brand)', () => {
    it('applies the brand-locked palette per method (B2)', () => {
      mockAuth(null);
      const { container } = render(<MethodBadge method="get" />);
      const badge = container.querySelector('span');
      // Inline style colors are brand constants, not theme tokens.
      expect(badge).toHaveStyle({ color: '#a7f3d0' });
    });

    it('falls back to a neutral palette for an unknown method', () => {
      mockAuth(null);
      const { container } = render(<MethodBadge method="trace" />);
      const badge = container.querySelector('span');
      expect(badge).toHaveTextContent('TRACE');
      expect(badge).toHaveStyle({ color: '#eeeede' });
    });
  });

  describe('logged in (themed)', () => {
    it('paints a single neutral mount treatment with no per-method color', () => {
      mockAuth(SOME_USER);
      const { container } = render(<MethodBadge method="get" />);
      const badge = container.querySelector('span');
      // No inline color — the badge consumes the mount bundle tokens so the
      // method color is decorative-neutral (B1: method conveyed by the h3).
      expect(badge).not.toHaveAttribute('style');
      expect(badge?.className).toContain('text-[var(--mount-text)]');
      expect(badge?.className).toContain('border-[var(--mount-border)]');
    });

    it('uses the same neutral treatment for every method', () => {
      mockAuth(SOME_USER);
      const { container: getContainer } = render(<MethodBadge method="get" />);
      const { container: deleteContainer } = render(
        <MethodBadge method="delete" />,
      );
      const getBadge = getContainer.querySelector('span');
      const deleteBadge = deleteContainer.querySelector('span');
      expect(getBadge?.className).toBe(deleteBadge?.className);
    });
  });
});
