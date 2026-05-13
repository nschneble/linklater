import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useLinksForm } from './useLinksForm';

afterEach(() => vi.restoreAllMocks());

function firePasteWithUrl(url: string) {
  const event = new Event('paste', { bubbles: true }) as ClipboardEvent;
  Object.defineProperty(event, 'clipboardData', {
    value: { getData: () => url },
    configurable: true,
  });
  window.dispatchEvent(event);
}

describe('useLinksForm', () => {
  it('showLinkForm starts as false', () => {
    const { result } = renderHook(() =>
      useLinksForm({ onDirectSave: vi.fn() }),
    );
    expect(result.current.showLinkForm).toBe(false);
  });

  it('handleToggleForm sets showLinkForm to true', () => {
    const { result } = renderHook(() =>
      useLinksForm({ onDirectSave: vi.fn() }),
    );
    act(() => result.current.handleToggleForm());
    expect(result.current.showLinkForm).toBe(true);
  });

  it('handleToggleForm toggles showLinkForm back to false', () => {
    const { result } = renderHook(() =>
      useLinksForm({ onDirectSave: vi.fn() }),
    );
    act(() => result.current.handleToggleForm());
    act(() => result.current.handleToggleForm());
    expect(result.current.showLinkForm).toBe(false);
  });

  it('calls onDirectSave when a URL is pasted and enabled is true (default)', () => {
    const onDirectSave = vi.fn().mockResolvedValue(undefined);
    renderHook(() => useLinksForm({ onDirectSave }));

    firePasteWithUrl('https://example.com/article');

    expect(onDirectSave).toHaveBeenCalledWith('https://example.com/article');
  });

  it('does not call onDirectSave when enabled is false', () => {
    const onDirectSave = vi.fn();
    renderHook(() => useLinksForm({ onDirectSave, enabled: false }));

    firePasteWithUrl('https://example.com/article');

    expect(onDirectSave).not.toHaveBeenCalled();
  });
});
