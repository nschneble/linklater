/**
 * Anti-regression coverage for the a11y contract on the privacy policy page,
 * mirroring the ApiDocsView test shape: landmarks, single-h1 heading outline,
 * skip-link/main id pairing, table semantics from the markdown pipeline, and
 * the selectable-legal-text guarantee.
 */

import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '../../auth/AuthContext/types';

// Auth drives the visual branch: logged out → brand chrome, logged
// in → the active theme. Mock it so tests can pick either branch.
vi.mock('../../auth/AuthContext', () => ({
  useAuth: vi.fn(),
}));

import PrivacyPolicyPage from './PrivacyPolicyPage';
import { useAuth } from '../../auth/AuthContext';

const useAuthMock = vi.mocked(useAuth);

/** Minimal logged-in user – only its presence (non-null) drives the branch. */
const loggedInUser = { id: 'user-1', email: 'nick@example.com' } as User;

function renderPage(user: User | null) {
  useAuthMock.mockReturnValue({ user } as ReturnType<typeof useAuth>);
  return render(
    <MemoryRouter initialEntries={['/privacy']}>
      <PrivacyPolicyPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PrivacyPolicyPage', () => {
  it('renders exactly one h1, with the markdown title demoted to the sr-only main label', () => {
    renderPage(null);

    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent('Privacy policy');

    const main = screen.getByRole('main');
    expect(main).toHaveAccessibleName('Privacy Policy');
  });

  it('pairs the skip link with a focusable main landmark', () => {
    renderPage(null);

    const skipLink = screen.getByRole('link', {
      name: 'Skip to privacy policy',
    });
    expect(skipLink).toHaveAttribute('href', '#privacy-policy');

    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('id', 'privacy-policy');
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
    expect(sectionTitles).toContain('1. Information We Collect');
    expect(sectionTitles).toContain("9. Children's Privacy");
  });

  it('renders the GDPR table with column headers inside a labeled, keyboard-scrollable region', () => {
    renderPage(null);

    const region = screen.getByRole('region', {
      name: 'How we use your information',
    });
    expect(region).toHaveAttribute('tabindex', '0');

    const table = within(region).getByRole('table');
    expect(table).toHaveAccessibleName(
      'Processing purposes, data used, and GDPR legal basis',
    );

    const columnHeaders = within(table).getAllByRole('columnheader');
    expect(columnHeaders.map((header) => header.textContent)).toEqual([
      'Purpose',
      'Data used',
      'GDPR legal basis',
    ]);
    for (const columnHeader of columnHeaders) {
      expect(columnHeader).toHaveAttribute('scope', 'col');
    }
  });

  it('renders <br/> in table cells as a real line break, not literal text', () => {
    renderPage(null);

    const region = screen.getByRole('region', {
      name: 'How we use your information',
    });
    const table = within(region).getByRole('table');

    expect(table.textContent).not.toContain('<br/>');
    expect(table.querySelectorAll('td br').length).toBeGreaterThan(0);
  });

  it('underlines in-content links and leaves external links same-tab', () => {
    renderPage(null);

    const googleLink = screen.getByRole('link', {
      name: "Google's privacy policy",
    });
    expect(googleLink.className).toContain('underline');
    expect(googleLink).not.toHaveAttribute('target');
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
    expect(document.title).toBe('Linklater – Privacy policy');
  });
});
