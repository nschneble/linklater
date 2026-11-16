import { act, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ANNOUNCE_DELAY_MS } from '../../lib/liveRegion';
import { renderPage } from './ConfirmAccountDeletionPage.testSetup';

vi.mock('../../lib/api', () => ({
  confirmAccountDeletion: vi.fn(),
}));

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

import * as apiModule from '../../lib/api';
import { makeAuthContext } from '../../../test/factories';
import { useAuth } from '../../auth/AuthContext';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useAuth).mockReturnValue(makeAuthContext());
  vi.mocked(apiModule.confirmAccountDeletion).mockResolvedValue(undefined);
});

describe('ConfirmAccountDeletionPage verifying state', () => {
  describe('announcement timing', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('announces the verifying status after the announce delay', () => {
      vi.mocked(apiModule.confirmAccountDeletion).mockReturnValue(
        new Promise(() => {}),
      );

      renderPage();
      act(() => {
        vi.advanceTimersByTime(ANNOUNCE_DELAY_MS);
      });

      expect(screen.getByRole('status')).toHaveTextContent(
        /verifying your deletion link/i,
      );
    });
  });

  it('does not render the legacy "Verifying deletion link" card heading', () => {
    vi.mocked(apiModule.confirmAccountDeletion).mockReturnValue(
      new Promise(() => {}),
    );

    renderPage();

    expect(
      screen.queryByRole('heading', { name: /verifying deletion link/i }),
    ).not.toBeInTheDocument();
  });
});
