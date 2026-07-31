/*
 * Tests for WelcomeModal, the first-session onboarding modal.
 *
 * Host-bundle contract: both PrimaryButton instances paint surface="orbit"
 * so the highlight fill tiers against the orbit panel, not the mount default.
 */

import WelcomeModal from './WelcomeModal';
import { MemoryRouter } from 'react-router';
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
