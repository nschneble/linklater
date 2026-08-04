/**
 * Per-document coverage for the privacy policy page: its GDPR table region,
 * in-content link underline plus same-tab external link, and its document
 * title. The shared legal-shell contract (landmarks, single h1, skip link,
 * theme branch) is covered once in PolicyDocumentPage.test.tsx, and the
 * `<br/>` table transform in rehypeBreakTags.test.tsx.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import { render, screen, within } from '@testing-library/react';
import type { User } from '../../auth/AuthContext/types';

// auth drives the visual branch (brand chrome vs active theme); mock it
vi.mock('../../auth/AuthContext', () => ({
  useAuth: vi.fn(),
}));

import PrivacyPolicyPage from './PrivacyPolicyPage';
import { useAuth } from '../../auth/AuthContext';

const useAuthMock = vi.mocked(useAuth);

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

  it('underlines in-content links and leaves external links same-tab', () => {
    renderPage(null);

    const googleLink = screen.getByRole('link', {
      name: "Google's privacy policy",
    });
    expect(googleLink.className).toContain('underline');
    expect(googleLink).not.toHaveAttribute('target');
  });

  it('sets the document title', () => {
    renderPage(null);
    expect(document.title).toBe('Linklater – Privacy policy');
  });
});
