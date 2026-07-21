/*
 * Tests for LinksControls – desktop action buttons inside LinksToolbar.
 *
 * Host-bundle contract – every IconButton AND PrimaryButton paints with
 * `surface="base"` via the data-surface attribute. LinksToolbar lives at
 * page level on `--base-bg`, so a silent revert to either default
 * (`mount`) would mis-tier the elevated lift / primary fill. This is
 * caught for IconButton and extended to PrimaryButton.
 */

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import LinksControls from './LinksControls';

const baseProps = {
  filter: 'unread' as const,
  isClearingRead: false,
  linksCount: 3,
  pasting: false,
  randomLoading: false,
  showLinkForm: false,
  onClearRead: vi.fn(),
  onPasteAndSave: vi.fn(),
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
    // The trigger opens a role="dialog" aria-modal panel, so it declares
    // aria-haspopup="dialog" and must NOT carry aria-expanded (which would
    // imply an in-place disclosure).
    render(<LinksControls {...baseProps} />);
    const button = screen.getByRole('button', { name: /add link/i });
    expect(button.getAttribute('aria-haspopup')).toBe('dialog');
    expect(button.hasAttribute('aria-expanded')).toBe(false);
    expect(button.getAttribute('aria-controls')).toBeTruthy();
  });

  it('Paste & save button renders on the unread tab with surface="base"', () => {
    render(<LinksControls {...baseProps} />);
    const button = screen.getByRole('button', { name: /paste & save/i });
    expect(button.getAttribute('data-surface')).toBe('base');
  });

  it('Paste & save takes its accessible name from its visible text, not a label', () => {
    render(<LinksControls {...baseProps} />);
    const button = screen.getByRole('button', { name: 'Paste & save' });
    expect(button.hasAttribute('aria-label')).toBe(false);
    // One-shot action: no disclosure ARIA copied from the adjacent Add link.
    expect(button.hasAttribute('aria-haspopup')).toBe(false);
    expect(button.hasAttribute('aria-expanded')).toBe(false);
    expect(button.hasAttribute('aria-pressed')).toBe(false);
  });

  it('Paste & save is hidden from assistive tech on the read tab', () => {
    render(<LinksControls {...baseProps} filter="read" />);
    expect(screen.queryByRole('button', { name: /paste & save/i })).toBeNull();
  });

  it('clicking Paste & save invokes onPasteAndSave', () => {
    const onPasteAndSave = vi.fn();
    render(<LinksControls {...baseProps} onPasteAndSave={onPasteAndSave} />);
    fireEvent.click(screen.getByRole('button', { name: /paste & save/i }));
    expect(onPasteAndSave).toHaveBeenCalledTimes(1);
  });

  it('marks Paste & save aria-disabled + aria-busy while pasting', () => {
    render(<LinksControls {...baseProps} pasting />);
    const button = screen.getByRole('button', { name: /paste & save/i });
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(button.getAttribute('aria-busy')).toBe('true');
    // aria-disabled (not native disabled) so the onClick guard governs re-entry.
    expect(button.hasAttribute('disabled')).toBe(false);
  });
});
