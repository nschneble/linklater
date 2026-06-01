import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useRef } from 'react';
import { useMenuNavigation } from './useMenuNavigation';

beforeEach(() => vi.clearAllMocks());

function FakeMenu({ onClose }: { onClose: () => void }) {
  const menuReference = useRef<HTMLDivElement>(null);
  useMenuNavigation(menuReference, onClose);

  return (
    <div ref={menuReference} role="menu">
      <button type="button" role="menuitem">
        First
      </button>
      <button type="button" role="menuitem">
        Second
      </button>
      <button type="button" role="menuitem">
        Third
      </button>
    </div>
  );
}

describe('useMenuNavigation', () => {
  it('ArrowDown moves focus to next item', () => {
    render(<FakeMenu onClose={vi.fn()} />);
    const [first, second] = screen.getAllByRole('menuitem');
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(second);
  });

  it('ArrowUp moves focus to previous item', () => {
    render(<FakeMenu onClose={vi.fn()} />);
    const [first, second] = screen.getAllByRole('menuitem');
    second.focus();
    fireEvent.keyDown(second, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(first);
  });

  it('ArrowDown on last item wraps to first', () => {
    render(<FakeMenu onClose={vi.fn()} />);
    const items = screen.getAllByRole('menuitem');
    const last = items[items.length - 1];
    last.focus();
    fireEvent.keyDown(last, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(items[0]);
  });

  it('ArrowUp on first item wraps to last', () => {
    render(<FakeMenu onClose={vi.fn()} />);
    const items = screen.getAllByRole('menuitem');
    items[0].focus();
    fireEvent.keyDown(items[0], { key: 'ArrowUp' });
    expect(document.activeElement).toBe(items[items.length - 1]);
  });

  it('Escape calls onClose', () => {
    const onClose = vi.fn();
    render(<FakeMenu onClose={onClose} />);
    const [first] = screen.getAllByRole('menuitem');
    first.focus();
    fireEvent.keyDown(first, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('skips items inside an inert subtree when arrowing', () => {
    function MenuWithInertFlyout({ onClose }: { onClose: () => void }) {
      const menuReference = useRef<HTMLDivElement>(null);
      useMenuNavigation(menuReference, onClose);
      return (
        <div ref={menuReference} role="menu">
          <button type="button" role="menuitem">
            Top
          </button>
          <button type="button" role="menuitem">
            Trigger
          </button>
          <div role="menu" inert>
            <button type="button" role="menuitemradio" aria-checked="false">
              Hidden A
            </button>
            <button type="button" role="menuitemradio" aria-checked="false">
              Hidden B
            </button>
          </div>
          <button type="button" role="menuitem">
            Logout
          </button>
        </div>
      );
    }

    render(<MenuWithInertFlyout onClose={vi.fn()} />);
    const trigger = screen.getByRole('menuitem', { name: 'Trigger' });
    const logout = screen.getByRole('menuitem', { name: 'Logout' });

    trigger.focus();
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(logout);

    fireEvent.keyDown(logout, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(trigger);
  });
});
