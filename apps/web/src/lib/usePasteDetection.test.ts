import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { usePasteDetection } from './usePasteDetection';

afterEach(() => vi.restoreAllMocks());

function firePasteOn(target: EventTarget, text: string) {
  const event = new Event('paste', { bubbles: true }) as ClipboardEvent;
  Object.defineProperty(event, 'clipboardData', {
    value: { getData: () => text },
    configurable: true,
  });
  target.dispatchEvent(event);
}

describe('usePasteDetection', () => {
  it('calls onSave with the URL when pasted outside an input', () => {
    const onSave = vi.fn();
    renderHook(() => usePasteDetection({ onSave }));

    firePasteOn(window, 'https://example.com/article');

    expect(onSave).toHaveBeenCalledWith('https://example.com/article');
  });

  it('trims leading and trailing whitespace from the pasted URL', () => {
    const onSave = vi.fn();
    renderHook(() => usePasteDetection({ onSave }));

    firePasteOn(window, '  https://example.com/article   ');

    expect(onSave).toHaveBeenCalledWith('https://example.com/article');
  });

  it('does not call onSave when pasted text is not a URL', () => {
    const onSave = vi.fn();
    renderHook(() => usePasteDetection({ onSave }));

    firePasteOn(window, 'just some plain text');

    expect(onSave).not.toHaveBeenCalled();
  });

  it('does not call onSave when pasted inside an INPUT element', () => {
    const onSave = vi.fn();
    renderHook(() => usePasteDetection({ onSave }));

    const input = document.createElement('input');
    document.body.appendChild(input);
    firePasteOn(input, 'https://example.com/article');
    document.body.removeChild(input);

    expect(onSave).not.toHaveBeenCalled();
  });

  it('does not call onSave when pasted inside a TEXTAREA element', () => {
    const onSave = vi.fn();
    renderHook(() => usePasteDetection({ onSave }));

    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    firePasteOn(textarea, 'https://example.com/article');
    document.body.removeChild(textarea);

    expect(onSave).not.toHaveBeenCalled();
  });

  it('does not call onSave when enabled is false', () => {
    const onSave = vi.fn();
    renderHook(() => usePasteDetection({ onSave, enabled: false }));

    firePasteOn(window, 'https://example.com/article');

    expect(onSave).not.toHaveBeenCalled();
  });

  it('removes the event listener on unmount', () => {
    const onSave = vi.fn();
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => usePasteDetection({ onSave }));
    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'paste',
      expect.any(Function),
    );
  });
});
