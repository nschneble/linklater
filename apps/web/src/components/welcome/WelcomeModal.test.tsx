/*
 * Tests for WelcomeModal – first-session onboarding modal.
 *
 * Host-bundle contract – both PrimaryButton instances (bookmarklet + Stumble)
 * paint with `surface="orbit"` via the data-surface attribute. The modal
 * panel itself is `--orbit-bg`, so a silent revert to the PrimaryButton
 * default (`mount`) would mis-tier the highlight fill against the orbit
 * surface. This shape is caught for IconButton and extended to
 * PrimaryButton (LinksControls / LinksMobileControls), and pinned for
 * WelcomeModal + ExtensionAuthorizePage.
 */

import WelcomeModal from './WelcomeModal';
import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

describe('WelcomeModal', () => {
  it('bookmarklet PrimaryButton declares surface="orbit" – modal panel is --orbit-bg', () => {
    render(
      <MemoryRouter>
        <WelcomeModal onClose={vi.fn()} />
      </MemoryRouter>,
    );
    const button = screen.getByRole('button', { name: /get the bookmarklet/i });
    expect(button.getAttribute('data-surface')).toBe('orbit');
  });

  it('Stumble PrimaryButton declares surface="orbit" – modal panel is --orbit-bg', () => {
    render(
      <MemoryRouter>
        <WelcomeModal onClose={vi.fn()} />
      </MemoryRouter>,
    );
    const button = screen.getByRole('button', { name: /try stumble!/i });
    expect(button.getAttribute('data-surface')).toBe('orbit');
  });
});
