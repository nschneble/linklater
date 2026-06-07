import { renderHook, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useDocumentTitle } from './useDocumentTitle';

describe('useDocumentTitle', () => {
  afterEach(() => {
    cleanup();
  });

  it('sets document.title to the provided title', () => {
    renderHook(() => useDocumentTitle('My Page — Linklater'));
    expect(document.title).toBe('My Page — Linklater');
  });

  it('updates document.title when the title argument changes', () => {
    const { rerender } = renderHook(
      ({ title }: { title: string }) => useDocumentTitle(title),
      { initialProps: { title: 'First — Linklater' } },
    );
    expect(document.title).toBe('First — Linklater');

    rerender({ title: 'Second — Linklater' });
    expect(document.title).toBe('Second — Linklater');
  });

  it('restores the previous title on unmount', () => {
    document.title = 'Original Title';

    const { unmount } = renderHook(() =>
      useDocumentTitle('Temporary — Linklater'),
    );
    expect(document.title).toBe('Temporary — Linklater');

    unmount();
    expect(document.title).toBe('Original Title');
  });
});
