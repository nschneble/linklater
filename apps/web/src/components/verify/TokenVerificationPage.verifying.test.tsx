import { act, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ANNOUNCE_DELAY_MS } from '../../lib/liveRegion';
import { renderPage } from './TokenVerificationPage.testSetup';

vi.mock('../../lib/pendingNotice', () => ({
  setPendingNotice: vi.fn(),
}));

vi.mock('../../auth/AuthContext', () => ({
  useAuth: vi.fn(),
}));

const navigate = vi.fn();

vi.mock('react-router', async () => {
  const actual =
    await vi.importActual<typeof import('react-router')>('react-router');
  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

import { makeAuthContext } from '../../../test/factories';
import { useAuth } from '../../auth/AuthContext';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useAuth).mockReturnValue(makeAuthContext());
});

describe('TokenVerificationPage verifying state', () => {
  describe('announcement timing', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('announces the verifying text after the announce delay', () => {
      const onVerify = vi.fn().mockReturnValue(new Promise(() => {}));

      renderPage({ onVerify, verifyingText: 'Verifying your email…' });
      act(() => {
        vi.advanceTimersByTime(ANNOUNCE_DELAY_MS);
      });

      expect(screen.getByRole('status')).toHaveTextContent(
        /verifying your email/i,
      );
    });
  });

  it('does not render any card heading during the verifying state', () => {
    const onVerify = vi.fn().mockReturnValue(new Promise(() => {}));

    renderPage({ onVerify, verifyingText: 'Confirming your new email…' });

    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });
});
