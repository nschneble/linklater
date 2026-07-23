/*
 * Tests for ExtensionAuthorizePage – extension OAuth confirmation page.
 *
 * Host-bundle contract – the Authorize PrimaryButton paints with
 * `surface="mount"` (the default) via the data-surface attribute. The card
 * itself is `--mount-bg`, so the default surface IS the correct tier here;
 * this test pins the default in place so a future refactor cannot silently
 * override it to the wrong surface. Locked in to match the
 * LinksControls / LinksMobileControls pattern.
 */

import ExtensionAuthorizePage from './ExtensionAuthorizePage';
import { MemoryRouter } from 'react-router-dom';
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
