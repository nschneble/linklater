/*
 * Tests for LinksMobileControls – mobile icon-only action buttons inside
 * LinksToolbar.
 *
 * Same `surface="base"` host-bundle contract as LinksControls (page-level
 * host = base). Mobile uses conditional render (`{filter === 'read' && …}`)
 * instead of the desktop hidden-prop pattern, so the assertions look slightly
 * different but the surface-prop pin is identical.
 */

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import LinksMobileControls from './LinksMobileControls';

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

describe('LinksMobileControls', () => {
  it('Stumble button declares surface="base" on unread tab', () => {
    render(<LinksMobileControls {...baseProps} />);
    const button = screen.getByRole('button', { name: /stumble!/i });
    expect(button.getAttribute('data-surface')).toBe('base');
  });

  it('Trash button declares surface="base" on read tab', () => {
    render(<LinksMobileControls {...baseProps} filter="read" linksCount={3} />);
    const button = screen.getByRole('button', {
      name: /remove all read links/i,
    });
    expect(button.getAttribute('data-surface')).toBe('base');
  });

  it('Add-link PrimaryButton declares surface="base" on unread tab', () => {
    render(<LinksMobileControls {...baseProps} />);
    const button = screen.getByRole('button', { name: /add link/i });
    expect(button.getAttribute('data-surface')).toBe('base');
  });

  it('Add-link trigger advertises the dialog it opens, not disclosure state', () => {
    render(<LinksMobileControls {...baseProps} />);
    const button = screen.getByRole('button', { name: /add link/i });
    expect(button.getAttribute('aria-haspopup')).toBe('dialog');
    expect(button.hasAttribute('aria-expanded')).toBe(false);
    expect(button.getAttribute('aria-controls')).toBeTruthy();
  });

  it('on unread tab – renders Stumble + Add link, omits trash entirely', () => {
    render(<LinksMobileControls {...baseProps} />);
    expect(
      screen.getByRole('button', { name: /stumble!/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /add link/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /remove all read links/i }),
    ).toBeNull();
  });

  it('on read tab – renders trash only, omits Stumble + Add link entirely', () => {
    render(<LinksMobileControls {...baseProps} filter="read" linksCount={3} />);
    expect(
      screen.getByRole('button', { name: /remove all read links/i }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /stumble!/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /add link/i })).toBeNull();
  });

  it('Paste & save renders icon-only on unread with an explicit label + surface="base"', () => {
    render(<LinksMobileControls {...baseProps} />);
    const button = screen.getByRole('button', { name: 'Paste & save' });
    expect(button.getAttribute('data-surface')).toBe('base');
    expect(button.getAttribute('title')).toBe('Paste & save');
  });

  it('Paste & save is omitted entirely on the read tab', () => {
    render(<LinksMobileControls {...baseProps} filter="read" linksCount={3} />);
    expect(screen.queryByRole('button', { name: /paste & save/i })).toBeNull();
  });

  it('clicking Paste & save invokes onPasteAndSave', () => {
    const onPasteAndSave = vi.fn();
    render(
      <LinksMobileControls {...baseProps} onPasteAndSave={onPasteAndSave} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Paste & save' }));
    expect(onPasteAndSave).toHaveBeenCalledTimes(1);
  });

  it('marks Paste & save aria-disabled + aria-busy while pasting', () => {
    render(<LinksMobileControls {...baseProps} pasting />);
    const button = screen.getByRole('button', { name: 'Paste & save' });
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button.hasAttribute('disabled')).toBe(false);
  });
});
