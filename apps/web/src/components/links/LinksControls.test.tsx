/*
 * Tests for LinksControls — desktop action buttons inside LinksToolbar.
 *
 * Host-bundle contract — every IconButton AND PrimaryButton paints with
 * `surface="base"` via the data-surface attribute. LinksToolbar lives at
 * page level on `--base-bg`, so a silent revert to either default
 * (`mount`) would mis-tier the elevated lift / primary fill. Wave 28
 * caught this for IconButton; wave 42 extended to PrimaryButton.
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import LinksControls from './LinksControls';

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
  it('Stumble button declares surface="base" — page-level host (LinksToolbar = base)', () => {
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
});
