import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';

afterEach(() => vi.restoreAllMocks());

function makeOptions(overrides: Record<string, unknown> = {}) {
  return {
    enabled: true,
    isShortcutsModalOpen: false,
    onShowUnread: vi.fn(),
    onShowRead: vi.fn(),
    onSearch: vi.fn(),
    onToggleForm: vi.fn(),
    onStumble: vi.fn(),
    onToggleShortcuts: vi.fn(),
    ...overrides,
  };
}

function fireKey(key: string, extraInit: KeyboardEventInit = {}) {
  document.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, ...extraInit }),
  );
}

describe('useKeyboardShortcuts', () => {
  it('key 1 calls onShowUnread', () => {
    const options = makeOptions();
    renderHook(() => useKeyboardShortcuts(options));
    fireKey('1');
    expect(options.onShowUnread).toHaveBeenCalledOnce();
  });

  it('key 2 calls onShowRead', () => {
    const options = makeOptions();
    renderHook(() => useKeyboardShortcuts(options));
    fireKey('2');
    expect(options.onShowRead).toHaveBeenCalledOnce();
  });

  it('key q calls onSearch', () => {
    const options = makeOptions();
    renderHook(() => useKeyboardShortcuts(options));
    fireKey('q');
    expect(options.onSearch).toHaveBeenCalledOnce();
  });

  it('key a calls onToggleForm', () => {
    const options = makeOptions();
    renderHook(() => useKeyboardShortcuts(options));
    fireKey('a');
    expect(options.onToggleForm).toHaveBeenCalledOnce();
  });

  it('key d calls onStumble', () => {
    const options = makeOptions();
    renderHook(() => useKeyboardShortcuts(options));
    fireKey('d');
    expect(options.onStumble).toHaveBeenCalledOnce();
  });

  it('key z calls onToggleShortcuts', () => {
    const options = makeOptions();
    renderHook(() => useKeyboardShortcuts(options));
    fireKey('z');
    expect(options.onToggleShortcuts).toHaveBeenCalledOnce();
  });

  it('ignores keys when enabled is false', () => {
    const options = makeOptions({ enabled: false });
    renderHook(() => useKeyboardShortcuts(options));
    fireKey('1');
    fireKey('a');
    expect(options.onShowUnread).not.toHaveBeenCalled();
    expect(options.onToggleForm).not.toHaveBeenCalled();
  });

  it('ignores keys when a modifier key is held', () => {
    const options = makeOptions();
    renderHook(() => useKeyboardShortcuts(options));
    fireKey('a', { metaKey: true });
    fireKey('1', { ctrlKey: true });
    expect(options.onToggleForm).not.toHaveBeenCalled();
    expect(options.onShowUnread).not.toHaveBeenCalled();
  });

  it('ignores keys when target is an input field', () => {
    const options = makeOptions();
    renderHook(() => useKeyboardShortcuts(options));

    const input = document.createElement('input');
    document.body.appendChild(input);
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'a', bubbles: true }),
    );
    document.body.removeChild(input);

    expect(options.onToggleForm).not.toHaveBeenCalled();
  });

  it('when shortcuts modal is open, only z closes it', () => {
    const options = makeOptions({ isShortcutsModalOpen: true });
    renderHook(() => useKeyboardShortcuts(options));

    fireKey('1');
    fireKey('a');
    expect(options.onShowUnread).not.toHaveBeenCalled();
    expect(options.onToggleForm).not.toHaveBeenCalled();

    fireKey('z');
    expect(options.onToggleShortcuts).toHaveBeenCalledOnce();
  });

  it('Escape calls onEscape when provided', () => {
    const onEscape = vi.fn();
    const options = makeOptions({ onEscape });
    renderHook(() => useKeyboardShortcuts(options));
    fireKey('Escape');
    expect(onEscape).toHaveBeenCalledOnce();
  });

  it('Escape calls onEscape even when target is an input field', () => {
    const onEscape = vi.fn();
    const options = makeOptions({ onEscape });
    renderHook(() => useKeyboardShortcuts(options));

    const input = document.createElement('input');
    document.body.appendChild(input);
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    document.body.removeChild(input);

    expect(onEscape).toHaveBeenCalledOnce();
  });

  it('Escape does nothing when onEscape is not provided', () => {
    const options = makeOptions();
    renderHook(() => useKeyboardShortcuts(options));
    fireKey('Escape');
    expect(options.onToggleForm).not.toHaveBeenCalled();
    expect(options.onToggleShortcuts).not.toHaveBeenCalled();
  });

  it('removes the event listener on unmount', () => {
    const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');
    const options = makeOptions();
    const { unmount } = renderHook(() => useKeyboardShortcuts(options));
    unmount();
    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'keydown',
      expect.any(Function),
    );
  });
});
