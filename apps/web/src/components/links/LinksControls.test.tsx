/*
 * Tests for LinksControls: desktop action buttons inside LinksToolbar.
 *
 * Host-bundle contract: every IconButton and PrimaryButton paints with
 * `surface="base"` via the data-surface attribute. LinksToolbar lives at
 * page level on `--base-bg`, so a silent revert to either default
 * (`mount`) would mis-tier the elevated lift / primary fill.
 */

import { describe, expect, it, vi } from 'vitest';
import LinksControls from './LinksControls';
import { render, screen } from '@testing-library/react';

const baseProps = {
  filter: 'unread' as const,
  isClearingRead: false,
  linksCount: 3,
  randomLoading: false,
  showLinkForm: false,
  onClearRead: vi.fn(),
  onRandom: vi.fn(),
  onToggleForm: vi.fn(),
};

describe('LinksControls', () => {
  it('Stumble button declares surface="base" – page-level host (LinksToolbar = base)', () => {
    render(<LinksControls {...baseProps} />);
    const button = screen.getByRole('button', { name: /stumble!/i });
    expect(button.getAttribute('data-surface')).toBe('base');
  });

  it('Remove-all-read button declares surface="base"', () => {
    render(<LinksControls {...baseProps} filter="read" />);
    const button = screen.getByRole('button', { name: /remove all read/i });
    expect(button.getAttribute('data-surface')).toBe('base');
  });

  it('Add-link PrimaryButton declares surface="base"', () => {
    render(<LinksControls {...baseProps} />);
    const button = screen.getByRole('button', { name: /add link/i });
    expect(button.getAttribute('data-surface')).toBe('base');
  });

  it('Add-link trigger advertises the dialog it opens, not disclosure state', () => {
    // opens a dialog, so aria-haspopup="dialog" and no aria-expanded
    render(<LinksControls {...baseProps} />);
    const button = screen.getByRole('button', { name: /add link/i });
    expect(button.getAttribute('aria-haspopup')).toBe('dialog');
    expect(button.hasAttribute('aria-expanded')).toBe(false);
    expect(button.getAttribute('aria-controls')).toBeTruthy();
  });
});
