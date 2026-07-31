import { renderHook, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useDocumentTitle } from './useDocumentTitle';

describe('useDocumentTitle', () => {
  afterEach(() => {
    cleanup();
  });

  it('sets document.title to the provided title', () => {
    renderHook(() =>
      useDocumentTitle('Linklater – Save links now, read them later.'),
    );
    expect(document.title).toBe('Linklater – Save links now, read them later.');
  });

  it('updates document.title when the title argument changes', () => {
    const { rerender } = renderHook(
      ({ title }: { title: string }) => useDocumentTitle(title),
      {
        initialProps: { title: 'Linklater – Save links now, read them later.' },
      },
    );
    expect(document.title).toBe('Linklater – Save links now, read them later.');

    rerender({ title: 'Linklater – Settings' });
    expect(document.title).toBe('Linklater – Settings');
  });

  it('does NOT restore the previous title on unmount', () => {
    // every route calls useDocumentTitle on mount; next mount resets it
    document.title = 'Linklater – Save links now, read them later.';

    const { unmount } = renderHook(() =>
      useDocumentTitle('Linklater – Settings'),
    );
    expect(document.title).toBe('Linklater – Settings');

    unmount();
    expect(document.title).toBe('Linklater – Settings');
  });
});
