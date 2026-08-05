/**
 * Wrapper-contract coverage for the shared legal-page shell
 * (PolicyDocumentPage): single-h1 heading outline with <main> named from that
 * chrome heading, skip-link/main id pairing, the selectable-legal-text
 * guarantee, markdown sections as h2s, and the brand-or-theme chrome branch.
 * Each concrete page (PrivacyPolicyPage, TermsPage) tests only its
 * per-document copy on top of this shared contract.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import { render, screen } from '@testing-library/react';
import type { Components } from 'react-markdown';
import type { User } from '../../auth/AuthContext/types';

// auth drives the visual branch (brand chrome vs active theme); mock it
vi.mock('../../auth/AuthContext', () => ({
  useAuth: vi.fn(),
}));

import PolicyDocumentPage from './PolicyDocumentPage';
import { useAuth } from '../../auth/AuthContext';

const useAuthMock = vi.mocked(useAuth);

/** Minimal logged-in user; presence (non-null) drives the branch. */
const loggedInUser = { id: 'user-1', email: 'nick@example.com' } as User;

/** Two h2 sections (no h1) so the chrome heading stays the only level-1. */
const fixtureMarkdown = [
  '## Section one',
  '',
  'First section body.',
  '',
  '## Section two',
  '',
  'Second section body.',
].join('\n');

const fixtureComponents: Components = {};

function renderPage(user: User | null) {
  useAuthMock.mockReturnValue({ user } as ReturnType<typeof useAuth>);
  return render(
    <MemoryRouter initialEntries={['/policy']}>
      <PolicyDocumentPage
        documentTitle="Linklater – Policy fixture"
        heading="Policy fixture"
        anchorId="policy-fixture"
        headingId="policy-fixture-heading"
        markdown={fixtureMarkdown}
        markdownComponents={fixtureComponents}
        skipLinkText="Skip to policy fixture"
      />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PolicyDocumentPage', () => {
  it('renders exactly one h1 and names <main> from that chrome heading', () => {
    renderPage(null);

    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent('Policy fixture');

    const main = screen.getByRole('main');
    expect(main).toHaveAccessibleName('Policy fixture');
  });

  it('pairs the skip link with a focusable main landmark', () => {
    renderPage(null);

    const skipLink = screen.getByRole('link', {
      name: 'Skip to policy fixture',
    });
    expect(skipLink).toHaveAttribute('href', '#policy-fixture');

    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('id', 'policy-fixture');
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
    expect(sectionTitles).toContain('Section one');
    expect(sectionTitles).toContain('Section two');
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
});
