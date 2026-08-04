/**
 * Per-document coverage for the terms and conditions page: its same-tab
 * in-content links and its document title. The shared legal-shell contract
 * (landmarks, single h1, skip link, theme branch) is covered once in
 * PolicyDocumentPage.test.tsx.
 */

import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '../../auth/AuthContext/types';

// auth drives the visual branch (brand chrome vs active theme); mock it
vi.mock('../../auth/AuthContext', () => ({
  useAuth: vi.fn(),
}));

import TermsPage from './TermsPage';
import { useAuth } from '../../auth/AuthContext';

const useAuthMock = vi.mocked(useAuth);

function renderPage(user: User | null) {
  useAuthMock.mockReturnValue({ user } as ReturnType<typeof useAuth>);
  return render(
    <MemoryRouter initialEntries={['/terms']}>
      <TermsPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('TermsPage', () => {
  it('keeps every in-content link same-tab (no target="_blank")', () => {
    renderPage(null);

    const main = screen.getByRole('main');
    for (const link of within(main).queryAllByRole('link')) {
      expect(link).not.toHaveAttribute('target', '_blank');
    }
  });

  it('sets the document title', () => {
    renderPage(null);
    expect(document.title).toBe('Linklater – Terms and conditions');
  });
});
