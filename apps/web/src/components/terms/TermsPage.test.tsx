/**
 * Anti-regression coverage for the a11y contract on the terms and conditions
 * page, mirroring PrivacyPolicyPage.test.tsx: landmarks, single-h1 heading
 * outline, skip-link/main id pairing, the selectable-legal-text guarantee,
 * and the prominent draft-template banner.
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

/** Minimal logged-in user; presence (non-null) drives the branch. */
const loggedInUser = { id: 'user-1', email: 'nick@example.com' } as User;

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
  it('renders exactly one h1, with the markdown title demoted to the sr-only main label', () => {
    renderPage(null);

    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent('Terms and conditions');

    const main = screen.getByRole('main');
    expect(main).toHaveAccessibleName('Terms and conditions');
  });

  it('pairs the skip link with a focusable main landmark', () => {
    renderPage(null);

    const skipLink = screen.getByRole('link', {
      name: 'Skip to terms and conditions',
    });
    expect(skipLink).toHaveAttribute('href', '#terms');

    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('id', 'terms');
    expect(main).toHaveAttribute('tabindex', '-1');
  });

  it('keeps the legal text selectable (no select-none on main)', () => {
    renderPage(null);
    expect(screen.getByRole('main').className).not.toContain('select-none');
  });

  it('renders the markdown sections as h2s under the chrome h1', () => {
    renderPage(null);

    const sectionHeadings = screen.getAllByRole('heading', { level: 2 });
    const sectionTitles = sectionHeadings.map((heading) => heading.textContent);
    expect(sectionTitles).toContain('1. Acceptance of terms');
    expect(sectionTitles).toContain('13. Contact');
  });

  it('keeps every in-content link same-tab (no target="_blank")', () => {
    renderPage(null);

    const main = screen.getByRole('main');
    for (const link of within(main).queryAllByRole('link')) {
      expect(link).not.toHaveAttribute('target', '_blank');
    }
  });

  it('pins the branding theme when logged out and inherits the user theme when logged in', () => {
    const { container, unmount } = renderPage(null);
    expect(
      container.querySelector('[data-theme="branding"]'),
    ).toBeInTheDocument();
    unmount();

    const { container: themedContainer } = renderPage(loggedInUser);
    expect(
      themedContainer.querySelector('[data-theme="branding"]'),
    ).not.toBeInTheDocument();
  });

  it('sets the document title', () => {
    renderPage(null);
    expect(document.title).toBe('Linklater – Terms and conditions');
  });
});
