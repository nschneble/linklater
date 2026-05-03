import { useEffect } from 'react';

interface UseKeyboardShortcutsOptions {
  enabled: boolean;
  onShowUnread: () => void;
  onShowRead: () => void;
  onSearch: () => void;
  onToggleForm: () => void;
  onStumble: () => void;
  onToggleShortcuts: () => void;
}

export function useKeyboardShortcuts({
  enabled,
  onShowUnread,
  onShowRead,
  onSearch,
  onToggleForm,
  onStumble,
  onToggleShortcuts,
}: UseKeyboardShortcutsOptions) {
  useEffect(() => {
    if (!enabled) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const target = event.target as HTMLElement;
      const isTypingField =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      if (isTypingField) return;

      switch (event.key.toLowerCase()) {
        case '1':
          event.preventDefault();
          onShowUnread();
          break;
        case '2':
          event.preventDefault();
          onShowRead();
          break;
        case 'q':
          event.preventDefault();
          onSearch();
          break;
        case 'a':
          event.preventDefault();
          onToggleForm();
          break;
        case 's':
          event.preventDefault();
          onStumble();
          break;
        case 'z':
          event.preventDefault();
          onToggleShortcuts();
          break;
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [
    enabled,
    onShowUnread,
    onShowRead,
    onSearch,
    onToggleForm,
    onStumble,
    onToggleShortcuts,
  ]);
}
