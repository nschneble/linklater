import { useEffect } from 'react';

/**
 * Sets `document.title` to `title` and restores the previous title on
 * unmount. Keeps screen-reader virtual-buffer page announcements in sync with
 * SPA route changes (WCAG 2.4.2 Page Titled).
 */
export function useDocumentTitle(title: string): void {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = title;
    return () => {
      document.title = previousTitle;
    };
  }, [title]);
}
