import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { usePasteAndSave } from './usePasteAndSave';

function mockClipboardReadText(implementation: () => Promise<string>) {
  const readText = vi.fn(implementation);
  Object.defineProperty(navigator, 'clipboard', {
    value: { readText },
    configurable: true,
  });
  return readText;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('usePasteAndSave', () => {
  it('saves a URL read from the clipboard', async () => {
    mockClipboardReadText(() => Promise.resolve('https://example.com/article'));
    const onDirectSave = vi.fn().mockResolvedValue(undefined);
    const showToast = vi.fn();

    const { result } = renderHook(() =>
      usePasteAndSave({ onDirectSave, showToast }),
    );

    await act(async () => {
      await result.current.handlePasteAndSave();
    });

    expect(onDirectSave).toHaveBeenCalledWith('https://example.com/article');
    expect(showToast).not.toHaveBeenCalled();
  });

  it('trims the clipboard text before saving', async () => {
    mockClipboardReadText(() =>
      Promise.resolve('  https://example.com/article  '),
    );
    const onDirectSave = vi.fn().mockResolvedValue(undefined);
    const showToast = vi.fn();

    const { result } = renderHook(() =>
      usePasteAndSave({ onDirectSave, showToast }),
    );

    await act(async () => {
      await result.current.handlePasteAndSave();
    });

    expect(onDirectSave).toHaveBeenCalledWith('https://example.com/article');
  });

  it('shows a warning toast and does not save when the clipboard has no URL', async () => {
    mockClipboardReadText(() => Promise.resolve('just some plain text'));
    const onDirectSave = vi.fn().mockResolvedValue(undefined);
    const showToast = vi.fn();

    const { result } = renderHook(() =>
      usePasteAndSave({ onDirectSave, showToast }),
    );

    await act(async () => {
      await result.current.handlePasteAndSave();
    });

    expect(onDirectSave).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith('No link in clipboard', 'warning');
  });

  it('shows a warning toast when the clipboard is empty', async () => {
    mockClipboardReadText(() => Promise.resolve('   '));
    const onDirectSave = vi.fn().mockResolvedValue(undefined);
    const showToast = vi.fn();

    const { result } = renderHook(() =>
      usePasteAndSave({ onDirectSave, showToast }),
    );

    await act(async () => {
      await result.current.handlePasteAndSave();
    });

    expect(onDirectSave).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith('No link in clipboard', 'warning');
  });

  it('shows an error toast and never throws when the clipboard read is rejected', async () => {
    mockClipboardReadText(() => Promise.reject(new Error('denied')));
    const onDirectSave = vi.fn().mockResolvedValue(undefined);
    const showToast = vi.fn();

    const { result } = renderHook(() =>
      usePasteAndSave({ onDirectSave, showToast }),
    );

    await act(async () => {
      await expect(
        result.current.handlePasteAndSave(),
      ).resolves.toBeUndefined();
    });

    expect(onDirectSave).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith("Couldn't read clipboard", 'error');
  });

  it('reports pending while the save is in flight, then clears it', async () => {
    let resolveSave: () => void = () => {};
    mockClipboardReadText(() => Promise.resolve('https://example.com'));
    const onDirectSave = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSave = resolve;
        }),
    );
    const showToast = vi.fn();

    const { result } = renderHook(() =>
      usePasteAndSave({ onDirectSave, showToast }),
    );

    let pending: Promise<void>;
    await act(async () => {
      pending = result.current.handlePasteAndSave();
      // Let the clipboard read microtask settle so the save starts.
      await Promise.resolve();
    });

    expect(result.current.pasting).toBe(true);

    await act(async () => {
      resolveSave();
      await pending;
    });

    expect(result.current.pasting).toBe(false);
  });

  it('ignores a second press while the first save is still in flight', async () => {
    let resolveSave: () => void = () => {};
    mockClipboardReadText(() => Promise.resolve('https://example.com'));
    const onDirectSave = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSave = resolve;
        }),
    );
    const showToast = vi.fn();

    const { result } = renderHook(() =>
      usePasteAndSave({ onDirectSave, showToast }),
    );

    await act(async () => {
      const first = result.current.handlePasteAndSave();
      await Promise.resolve();
      // Second press lands while the first save is still pending.
      await result.current.handlePasteAndSave();
      resolveSave();
      await first;
    });

    expect(onDirectSave).toHaveBeenCalledTimes(1);
  });
});
