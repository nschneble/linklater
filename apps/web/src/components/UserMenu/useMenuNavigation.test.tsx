import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useMenuNavigation } from './useMenuNavigation';
import { useRef } from 'react';

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

  it('Tab calls onClose when onTabClose is not provided (trap/close fallback)', () => {
    const onClose = vi.fn();
    render(<FakeMenu onClose={onClose} />);
    const [first] = screen.getAllByRole('menuitem');
    first.focus();
    fireEvent.keyDown(first, { key: 'Tab' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('Tab calls onTabClose (not onClose) when provided, but Escape still calls onClose', () => {
    function FakeMenuWithTabClose({
      onClose,
      onTabClose,
    }: {
      onClose: () => void;
      onTabClose: () => void;
    }) {
      const menuReference = useRef<HTMLDivElement>(null);
      useMenuNavigation(menuReference, onClose, { onTabClose });
      return (
        <div ref={menuReference} role="menu">
          <button type="button" role="menuitem">
            First
          </button>
        </div>
      );
    }

    const onClose = vi.fn();
    const onTabClose = vi.fn();
    render(<FakeMenuWithTabClose onClose={onClose} onTabClose={onTabClose} />);
    const first = screen.getByRole('menuitem');
    first.focus();

    // Tab routes through onTabClose only; onClose must not fire (SC 2.4.3)
    fireEvent.keyDown(first, { key: 'Tab' });
    expect(onTabClose).toHaveBeenCalledOnce();
    expect(onClose).not.toHaveBeenCalled();

    // Escape still routes through onClose (UserMenu refocuses the avatar)
    fireEvent.keyDown(first, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
    expect(onTabClose).toHaveBeenCalledOnce();
  });

  it('trap mode is unaffected by onTabClose fallback (cycles focus, no close)', () => {
    function TrapMenu({ onClose }: { onClose: () => void }) {
      const menuReference = useRef<HTMLDivElement>(null);
      useMenuNavigation(menuReference, onClose, { tabBehavior: 'trap' });
      return (
        <div ref={menuReference} role="menu">
          <button type="button" role="menuitem">
            First
          </button>
          <button type="button" role="menuitem">
            Second
          </button>
        </div>
      );
    }

    const onClose = vi.fn();
    render(<TrapMenu onClose={onClose} />);
    const [first, second] = screen.getAllByRole('menuitem');
    first.focus();
    fireEvent.keyDown(first, { key: 'Tab' });
    // trap cycles focus and never closes
    expect(document.activeElement).toBe(second);
    expect(onClose).not.toHaveBeenCalled();
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
