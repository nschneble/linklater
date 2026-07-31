/*
 * Tests for ExtensionAuthorizePage, the extension OAuth confirmation page.
 *
 * Host-bundle contract: the Authorize PrimaryButton keeps surface="mount"
 * (the default) so it tiers against the --mount-bg card; this pins the
 * default so a refactor can't silently override it to the wrong surface.
 */

import ExtensionAuthorizePage from './ExtensionAuthorizePage';
import { MemoryRouter } from 'react-router';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({
    user: {
      connectedProviders: [],
      cvdMode: false,
      dyslexicFont: false,
      email: 'alice@example.com',
      emailVerifiedAt: '2026-01-01T00:00:00.000Z',
      hasPassword: true,
      mode: 'light',
      multiFactorMethod: null,
      multiFactorPending: false,
      pendingEmail: null,
      theme: 'scanner-darkly',
      userId: 'user-1',
      welcomedAt: '2026-01-01T00:00:00.000Z',
    },
  }),
}));

describe('ExtensionAuthorizePage', () => {
  it('Authorize PrimaryButton declares surface="mount" – card is --mount-bg (default)', () => {
    render(
      <MemoryRouter>
        <ExtensionAuthorizePage />
      </MemoryRouter>,
    );
    const button = screen.getByRole('button', { name: /^authorize$/i });
    expect(button.getAttribute('data-surface')).toBe('mount');
  });
});
