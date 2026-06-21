import { useEffect } from 'react';

/**
 * Sets `document.title` to `title` on mount and any time `title` changes.
 * Does NOT restore the previous title on unmount. Each top-level route
 * component is expected to call `useDocumentTitle` exactly once, so the
 * next-mount always re-establishes the page title (WCAG 2.4.2).
 */
export function useDocumentTitle(title: string): void {
  useEffect(() => {
    document.title = title;
  }, [title]);
}
